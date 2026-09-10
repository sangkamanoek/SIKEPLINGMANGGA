import { LaporanHarianItem, SheetMetadata } from '../types';
import { ALL_ACCOUNTS, getEffectivePassword } from '../data/keplingList';
import { isReportBeforeSept7 } from './reportsApi';

const SPREADSHEET_TITLE = 'SI KEPLING MANGGA';
export const USERNAME_SHEET_TAB_NAME = 'Username & Password';
const SHEET_TAB_NAME = 'Laporan Harian';

const HEADERS = [
  'Waktu Input',
  'Hari',
  'Tanggal',
  'Nama Kepling',
  'Jabatan',
  'Wilayah (Kelurahan / Kecamatan)',
  'Opsir PBB (WP)',
  'Perlinsos (KK)',
  'IKD (Orang)',
  'BPJS Ketenagakerjaan (Orang)',
  'Poskamling / Siskamling',
  'Kegiatan Lainnya / Catatan',
  'Jumlah Dokumentasi',
];

export const USERNAME_HEADERS = [
  'No',
  'Role Akun',
  'Wilayah / Lingkungan',
  'Nama Petugas',
  'Jabatan Resmi',
  'Username / ID Login',
  'Password Akun',
  'Catatan Akses',
];

/**
 * Searches for existing database spreadsheet or creates a new one
 */
export async function getOrCreateSpreadsheet(accessToken: string): Promise<SheetMetadata> {
  // 1. Try to search Google Drive for an existing spreadsheet named SI KEPLING MANGGA
  const query = encodeURIComponent(`name = '${SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`;

  try {
    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const file = searchData.files[0];
        // Ensure the Username & Password tab is created & populated, and purge any legacy reports
        try {
          await ensureUsernameSheetAndPopulate(accessToken, file.id);
          await purgePreSept7ReportsFromSheet(accessToken, file.id);
        } catch (err) {
          console.warn('Syncing tabs to existing sheet:', err);
        }

        return {
          spreadsheetId: file.id,
          spreadsheetUrl: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
          title: file.name,
        };
      }
    }
  } catch (err) {
    console.warn('Drive search error, falling back to direct create:', err);
  }

  // 2. If not found, create new spreadsheet with:
  // Sheet 1: Username & Password (index 0)
  // Sheet 2: Laporan Harian (index 1)
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: SPREADSHEET_TITLE,
      },
      sheets: [
        {
          properties: {
            sheetId: 0,
            title: USERNAME_SHEET_TAB_NAME,
            index: 0,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
        {
          properties: {
            sheetId: 1,
            title: SHEET_TAB_NAME,
            index: 1,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Gagal membuat Google Spreadsheet: ${errorText}`);
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Write Sheet 1 (Username & Password) rows & style
  await ensureUsernameSheetAndPopulate(accessToken, spreadsheetId);

  // Write Sheet 2 (Laporan Harian) header row & style
  await appendHeaderRow(accessToken, spreadsheetId, 1);

  return {
    spreadsheetId,
    spreadsheetUrl,
    title: SPREADSHEET_TITLE,
  };
}

async function appendHeaderRow(accessToken: string, spreadsheetId: string, sheetId: number = 1) {
  const range = `'${SHEET_TAB_NAME}'!A1:M1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [HEADERS],
    }),
  });

  // Style header row with green background
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: HEADERS.length,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.08, green: 0.45, blue: 0.28 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    fontSize: 10,
                  },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: HEADERS.length,
              },
            },
          },
        ],
      }),
    });
  } catch (err) {
    console.warn('Styling header row error (non-fatal):', err);
  }
}

/**
 * Ensures the "Username & Password" sheet exists and is populated with all user accounts & passwords.
 */
export async function ensureUsernameSheetAndPopulate(
  accessToken: string,
  spreadsheetId: string
): Promise<{ success: boolean; sheetTitle: string }> {
  // 1. Get spreadsheet metadata to see existing sheets
  let usernameSheetId: number | undefined;
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (metaRes.ok) {
      const metaData = await metaRes.json();
      const sheets = metaData.sheets || [];
      const existingUsernameSheet = sheets.find(
        (s: any) => s.properties?.title?.toLowerCase() === USERNAME_SHEET_TAB_NAME.toLowerCase()
      );
      if (existingUsernameSheet) {
        usernameSheetId = existingUsernameSheet.properties?.sheetId;
      }
    }
  } catch (err) {
    console.warn('Error checking existing sheet tabs:', err);
  }

  // 2. If Username sheet doesn't exist, create it
  if (usernameSheetId === undefined) {
    try {
      const addSheetRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: USERNAME_SHEET_TAB_NAME,
                    gridProperties: {
                      frozenRowCount: 1,
                    },
                  },
                },
              },
            ],
          }),
        }
      );

      if (addSheetRes.ok) {
        const addSheetData = await addSheetRes.json();
        usernameSheetId = addSheetData.replies?.[0]?.addSheet?.properties?.sheetId;
      }
    } catch (err) {
      console.warn('Error creating Username tab:', err);
    }
  }

  // 3. Populate accounts data (Super Admin + 24 Kepling)
  const rows = ALL_ACCOUNTS.map((acc, idx) => {
    const isSuper = acc.role === 'super_admin';
    return [
      idx + 1,
      isSuper ? 'SUPER ADMIN' : 'KEPALA LINGKUNGAN',
      acc.lingkungan || 'Kantor Kelurahan Mangga',
      acc.nama,
      acc.jabatan,
      acc.id,
      getEffectivePassword(acc),
      isSuper ? 'Akses Penuh / Master Lurah' : `Akses Khusus Lingkungan ${acc.nomorLingkungan}`,
    ];
  });

  const values = [USERNAME_HEADERS, ...rows];
  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${USERNAME_SHEET_TAB_NAME}'!A1:H${values.length}?valueInputOption=USER_ENTERED`;

  await fetch(writeUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  // 4. Style header row with official emerald green theme
  if (usernameSheetId !== undefined) {
    try {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: usernameSheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: USERNAME_HEADERS.length,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.08, green: 0.45, blue: 0.28 },
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                      fontSize: 10,
                    },
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: usernameSheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: USERNAME_HEADERS.length,
                },
              },
            },
          ],
        }),
      });
    } catch (err) {
      console.warn('Styling Username tab header row error (non-fatal):', err);
    }
  }

  return {
    success: true,
    sheetTitle: USERNAME_SHEET_TAB_NAME,
  };
}

/**
 * Purges any report rows in the spreadsheet dated before 7 September 2026.
 */
export async function purgePreSept7ReportsFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{ removedCount: number }> {
  try {
    const range = `'${SHEET_TAB_NAME}'!A2:M1000`;
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    const res = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { removedCount: 0 };
    const data = await res.json();
    const rows: string[][] = data.values || [];
    if (rows.length === 0) return { removedCount: 0 };

    const validRows = rows.filter((row) => {
      const tanggalStr = row[2] || '';
      const createdStr = row[0] || '';
      const dummyReport: LaporanHarianItem = {
        id: 'chk',
        hari: row[1] || '',
        tanggal: tanggalStr,
        createdAt: createdStr,
        namaKepling: row[3] || '',
        jabatan: row[4] || '',
        kelurahan: '',
        kecamatan: '',
        kinerja: {
          opsirPbbWp: '',
          perlinsosKk: '',
          ikdOrang: '',
          bpjsKetenagakerjaanOrang: '',
        },
        jumlahDokumentasi: 0,
      };
      return !isReportBeforeSept7(dummyReport);
    });

    if (validRows.length < rows.length) {
      const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
      await fetch(clearUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (validRows.length > 0) {
        const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_TAB_NAME}'!A2:M${validRows.length + 1}?valueInputOption=USER_ENTERED`;
        await fetch(putUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: validRows }),
        });
      }

      return { removedCount: rows.length - validRows.length };
    }
    return { removedCount: 0 };
  } catch (err) {
    console.warn('purgePreSept7ReportsFromSheet error:', err);
    return { removedCount: 0 };
  }
}

/**
 * Appends a report record to the Google Sheet
 */
export async function appendLaporanToSheet(
  accessToken: string,
  spreadsheetId: string,
  item: LaporanHarianItem
): Promise<{ success: boolean; updatedRange?: string }> {
  const range = `'${SHEET_TAB_NAME}'!A:M`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const poskamlingSummary =
    item.kinerja.poskamlingStatus && item.kinerja.poskamlingStatus !== 'Tidak Ada Giat'
      ? `${item.kinerja.poskamlingStatus}${item.kinerja.poskamlingLokasi ? ` (Lokasi: ${item.kinerja.poskamlingLokasi})` : ''}${item.kinerja.poskamlingPetugas ? ` [Petugas: ${item.kinerja.poskamlingPetugas}]` : ''}${item.kinerja.poskamlingKeterangan ? ` - ${item.kinerja.poskamlingKeterangan}` : ''}`
      : 'Tidak Ada Giat';

  const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  const rowValues = [
    now,
    item.hari,
    item.tanggal,
    item.namaKepling,
    item.jabatan,
    `${item.kelurahan || 'Kel. Mangga'}, ${item.kecamatan || 'Kec. Medan Tuntungan'}`,
    item.kinerja.opsirPbbWp ? `${item.kinerja.opsirPbbWp} WP${item.kinerja.opsirPbbKeterangan ? ` (${item.kinerja.opsirPbbKeterangan})` : ''}` : '-',
    item.kinerja.perlinsosKk ? `${item.kinerja.perlinsosKk} KK${item.kinerja.perlinsosKeterangan ? ` (${item.kinerja.perlinsosKeterangan})` : ''}` : '-',
    item.kinerja.ikdOrang ? `${item.kinerja.ikdOrang} Orang${item.kinerja.ikdKeterangan ? ` (${item.kinerja.ikdKeterangan})` : ''}` : '-',
    item.kinerja.bpjsKetenagakerjaanOrang ? `${item.kinerja.bpjsKetenagakerjaanOrang} Orang${item.kinerja.bpjsKetenagakerjaanKeterangan ? ` (${item.kinerja.bpjsKetenagakerjaanKeterangan})` : ''}` : '-',
    poskamlingSummary,
    item.kinerja.kegiatanLainnya || '-',
    item.jumlahDokumentasi || 0,
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowValues],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal menyimpan baris ke Google Sheets: ${errText}`);
  }

  const result = await res.json();
  return {
    success: true,
    updatedRange: result.updates?.updatedRange,
  };
}

/**
 * Fetches existing reports from the Google Sheet
 */
export async function fetchLaporanFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<LaporanHarianItem[]> {
  const range = `'${SHEET_TAB_NAME}'!A2:M500`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];

  return rows.map((row, index) => {
    // Check if row has 13 columns (with Poskamling) or legacy 12 columns
    const hasPoskamling = row.length >= 13;
    const poskamlingText = hasPoskamling ? (row[10] || '') : '';
    const poskamlingAdaGiat = poskamlingText.trim() !== '' && poskamlingText.trim() !== 'Tidak Ada Giat' && poskamlingText.trim() !== '-';

    return {
      id: `sheet-row-${index + 2}`,
      createdAt: row[0] || '',
      hari: row[1] || '',
      tanggal: row[2] || '',
      namaKepling: row[3] || '',
      jabatan: row[4] || '',
      kelurahan: (row[5] || '').split(',')[0]?.trim() || 'Kelurahan Mangga',
      kecamatan: (row[5] || '').split(',')[1]?.trim() || 'Kecamatan Medan Tuntungan',
      kinerja: {
        opsirPbbWp: row[6] || '',
        perlinsosKk: row[7] || '',
        ikdOrang: row[8] || '',
        bpjsKetenagakerjaanOrang: row[9] || '',
        poskamlingAdaGiat: poskamlingAdaGiat,
        poskamlingStatus: poskamlingAdaGiat ? poskamlingText : 'Tidak Ada Giat',
        poskamlingKeterangan: poskamlingAdaGiat ? poskamlingText : '',
        kegiatanLainnya: hasPoskamling ? (row[11] || '') : (row[10] || ''),
      },
      jumlahDokumentasi: parseInt(hasPoskamling ? (row[12] || '0') : (row[11] || '0'), 10) || 0,
      sheetRowIndex: index + 2,
    };
  })
    .filter((report) => !isReportBeforeSept7(report)) // Enforce cutoff 7 September 2026
    .reverse(); // Most recent first
}
