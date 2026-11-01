import { printOfficialDocument } from './printHelper';
import { PKK_LOGO_BASE64 } from '../assets/logoPkkBase64';

/**
 * Standard ID Card Dimensions (CR80 Specification):
 * Width: 85.60 mm
 * Height: 53.98 mm
 */

export const generateSinglePkkCardHtml = (item: any, options?: { regNo?: string; kelurahan?: string; kecamatan?: string; kota?: string; provinsi?: string }): string => {
  if (!item) return '';

  const photo = item.pasphotoUrl || item.fotoUrl || PKK_LOGO_BASE64;
  const regNo = options?.regNo || `12.71.10.2001.${String(item.id || '0045').replace(/[^0-9]/g, '').slice(-4).padStart(4, '0')}`;
  const namaFormatted = (item.nama || 'NUR AINI, S.Pd.').toUpperCase();
  const jabatanFormatted = (item.jabatan || 'ANGGOTA TP PKK KELURAHAN').toUpperCase();
  const ttlFormatted = `${(item.tempatLahir || 'MEDAN').toUpperCase()}, ${item.tanggalLahir || '16-04-1991'}`;
  const genderFormatted = item.jenisKelamin === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN';
  const alamatFormatted = (item.alamat || 'JL. BUNGA RINTE NO. 12, LINGKUNGAN IV').toUpperCase();
  const kelurahanFormatted = (options?.kelurahan || item.kelurahan || 'MANGGA').toUpperCase();
  const kecamatanFormatted = (options?.kecamatan || item.kecamatan || 'MEDAN TUNTUNGAN').toUpperCase();
  const kotaFormatted = (options?.kota || item.kota || 'KOTA MEDAN').toUpperCase();
  const provinsiFormatted = (options?.provinsi || item.provinsi || 'SUMATERA UTARA').toUpperCase();

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    `KTA-PKK|${regNo}|${namaFormatted}|${jabatanFormatted}|KELURAHAN_${kelurahanFormatted}`
  )}`;

  return `
    <div class="kta-card-root" style="
      width: 85.6mm;
      height: 53.98mm;
      box-sizing: border-box;
      border-radius: 3.5mm;
      overflow: hidden;
      position: relative;
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 45%, #bae6fd 100%);
      border: 1.5px solid #0284c7;
      margin: 0 auto;
      page-break-inside: avoid;
      break-inside: avoid;
      display: flex;
      flex-direction: column;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
    ">
      <!-- HEADER BANNER -->
      <div style="
        background: linear-gradient(90deg, #0284c7 0%, #0369a1 100%);
        padding: 1.2mm 2.4mm;
        color: #ffffff;
        display: flex;
        align-items: center;
        border-bottom: 0.7mm solid #f59e0b;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        box-sizing: border-box;
        flex-shrink: 0;
      ">
        <!-- Logo PKK Resmi -->
        <div style="
          width: 9.2mm;
          height: 9.2mm;
          border-radius: 50%;
          background: #ffffff;
          border: 0.3mm solid #ffffff;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 2px rgba(0,0,0,0.25);
          overflow: hidden;
          padding: 0.2mm;
          box-sizing: border-box;
        ">
          <img src="${PKK_LOGO_BASE64}" alt="PKK" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
        </div>
        <!-- Centered Header Titles (Identik dengan image) -->
        <div style="line-height: 1.15; flex: 1; text-align: center; margin-right: 9.2mm;">
          <div style="font-size: 7.2pt; font-weight: 900; letter-spacing: 0.4px; color: #ffffff; text-transform: uppercase;">
            KARTU TANDA ANGGOTA
          </div>
          <div style="font-size: 4.8pt; font-weight: 800; color: #e0f2fe; text-transform: uppercase;">
            PEMBERDAYAAN KESEJAHTERAAN KELUARGA (PKK)
          </div>
          <div style="font-size: 5.6pt; font-weight: 900; color: #fde047; text-transform: uppercase; margin-top: 0.25mm; letter-spacing: 0.3px;">
            KELURAHAN ${kelurahanFormatted}
          </div>
        </div>
      </div>

      <!-- MAIN CARD BODY -->
      <div style="
        padding: 1.5mm 2.2mm 1.5mm 2.2mm;
        display: flex;
        gap: 2mm;
        flex: 1;
        min-height: 0;
        align-items: flex-start;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
      ">
        <!-- LEFT COLUMN: PASPHOTO & BADGE -->
        <div style="
          width: 17mm;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          height: 100%;
          box-sizing: border-box;
        ">
          <!-- PASPHOTO (3x4 aspect ratio) -->
          <div style="
            width: 16.5mm;
            height: 22mm;
            border-radius: 1.2mm;
            border: 1.2px solid #0284c7;
            overflow: hidden;
            background: #ffffff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
          ">
            <img src="${photo}" alt="Foto" style="width: 100%; height: 100%; object-fit: ${photo === PKK_LOGO_BASE64 ? 'contain; padding: 1.2mm' : 'cover'}; object-position: top; display: block;" />
          </div>

          <!-- POJOK KIRI BAWAH: BADGE MEDAN UNTUK SEMUA (Exact match to image: MEDAN + stacked UNTUK/SEMUA) -->
          <div style="
            display: inline-flex;
            align-items: stretch;
            border: 0.4px solid #0f172a;
            border-radius: 0.7mm;
            overflow: hidden;
            box-shadow: 0 1px 2px rgba(0,0,0,0.25);
            margin-top: auto;
            margin-bottom: 0.2mm;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          ">
            <div style="
              background: #991b1b;
              color: #ffffff;
              font-weight: 900;
              font-size: 3.4pt;
              padding: 0.6mm 1.3mm;
              display: flex;
              align-items: center;
              justify-content: center;
              letter-spacing: 0.2px;
            ">
              MEDAN
            </div>
            <div style="
              background: #1e3a8a;
              color: #ffffff;
              font-weight: 900;
              font-size: 2.5pt;
              padding: 0.4mm 1.1mm;
              display: flex;
              flex-direction: column;
              justify-content: center;
              line-height: 1.05;
              text-align: center;
              letter-spacing: 0.1px;
            ">
              <span>UNTUK</span>
              <span>SEMUA</span>
            </div>
          </div>
        </div>

        <!-- DETAILS LIST (Right-aligned labels matching image_5ea1aef7) -->
        <div style="
          flex: 1;
          min-width: 0;
          padding-right: 12.5mm;
          font-size: 3.8pt;
          line-height: 1.22;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          box-sizing: border-box;
        ">
          <div style="display: flex; align-items: baseline; margin-bottom: 0.25mm;">
            <div style="width: 21mm; flex-shrink: 0; text-align: right; color: #1e293b; font-weight: 800; padding-right: 1.2mm;">NO. REGISTRASI</div>
            <div style="width: 1.2mm; flex-shrink: 0; text-align: center; color: #475569; font-weight: 900;">:</div>
            <div style="flex: 1; min-width: 0; font-weight: 900; color: #0369a1; padding-left: 1.2mm; word-break: break-all;">${regNo}</div>
          </div>

          <div style="display: flex; align-items: baseline; margin-bottom: 0.25mm;">
            <div style="width: 21mm; flex-shrink: 0; text-align: right; color: #1e293b; font-weight: 800; padding-right: 1.2mm;">NAMA</div>
            <div style="width: 1.2mm; flex-shrink: 0; text-align: center; color: #475569; font-weight: 900;">:</div>
            <div style="flex: 1; min-width: 0; font-weight: 900; color: #0284c7; padding-left: 1.2mm; word-break: break-word;">${namaFormatted}</div>
          </div>

          <div style="display: flex; align-items: baseline; margin-bottom: 0.25mm;">
            <div style="width: 21mm; flex-shrink: 0; text-align: right; color: #1e293b; font-weight: 800; padding-right: 1.2mm;">JABATAN</div>
            <div style="width: 1.2mm; flex-shrink: 0; text-align: center; color: #475569; font-weight: 900;">:</div>
            <div style="flex: 1; min-width: 0; font-weight: 800; color: #0f766e; padding-left: 1.2mm; word-break: break-word;">${jabatanFormatted}</div>
          </div>

          <div style="display: flex; align-items: baseline; margin-bottom: 0.25mm;">
            <div style="width: 21mm; flex-shrink: 0; text-align: right; color: #1e293b; font-weight: 800; padding-right: 1.2mm;">TEMPAT/TGL LAHIR</div>
            <div style="width: 1.2mm; flex-shrink: 0; text-align: center; color: #475569; font-weight: 900;">:</div>
            <div style="flex: 1; min-width: 0; padding-left: 1.2mm; word-break: break-word;">${ttlFormatted}</div>
          </div>

          <div style="display: flex; align-items: baseline; margin-bottom: 0.25mm;">
            <div style="width: 21mm; flex-shrink: 0; text-align: right; color: #1e293b; font-weight: 800; padding-right: 1.2mm;">JENIS KELAMIN</div>
            <div style="width: 1.2mm; flex-shrink: 0; text-align: center; color: #475569; font-weight: 900;">:</div>
            <div style="flex: 1; min-width: 0; padding-left: 1.2mm;">${genderFormatted}</div>
          </div>

          <!-- ALAMAT with distinct vertical gap matching image_5ea1aef7 -->
          <div style="display: flex; align-items: baseline; margin-bottom: 1.1mm;">
            <div style="width: 21mm; flex-shrink: 0; text-align: right; color: #1e293b; font-weight: 800; padding-right: 1.2mm;">ALAMAT</div>
            <div style="width: 1.2mm; flex-shrink: 0; text-align: center; color: #475569; font-weight: 900;">:</div>
            <div style="flex: 1; min-width: 0; padding-left: 1.2mm; word-break: break-word;">${alamatFormatted}</div>
          </div>

          <!-- REGION DATA BLOCK -->
          <div style="display: flex; align-items: baseline; margin-bottom: 0.25mm;">
            <div style="width: 21mm; flex-shrink: 0; text-align: right; color: #1e293b; font-weight: 800; padding-right: 1.2mm;">DESA/KELURAHAN</div>
            <div style="width: 1.2mm; flex-shrink: 0; text-align: center; color: #475569; font-weight: 900;">:</div>
            <div style="flex: 1; min-width: 0; font-weight: 800; padding-left: 1.2mm;">${kelurahanFormatted}</div>
          </div>

          <div style="display: flex; align-items: baseline; margin-bottom: 0.25mm;">
            <div style="width: 21mm; flex-shrink: 0; text-align: right; color: #1e293b; font-weight: 800; padding-right: 1.2mm;">KECAMATAN</div>
            <div style="width: 1.2mm; flex-shrink: 0; text-align: center; color: #475569; font-weight: 900;">:</div>
            <div style="flex: 1; min-width: 0; font-weight: 800; padding-left: 1.2mm;">${kecamatanFormatted}</div>
          </div>

          <div style="display: flex; align-items: baseline; margin-bottom: 0.25mm;">
            <div style="width: 21mm; flex-shrink: 0; text-align: right; color: #1e293b; font-weight: 800; padding-right: 1.2mm;">KABUPATEN/KOTA</div>
            <div style="width: 1.2mm; flex-shrink: 0; text-align: center; color: #475569; font-weight: 900;">:</div>
            <div style="flex: 1; min-width: 0; font-weight: 800; padding-left: 1.2mm;">${kotaFormatted}</div>
          </div>

          <div style="display: flex; align-items: baseline;">
            <div style="width: 21mm; flex-shrink: 0; text-align: right; color: #1e293b; font-weight: 800; padding-right: 1.2mm;">PROVINSI</div>
            <div style="width: 1.2mm; flex-shrink: 0; text-align: center; color: #475569; font-weight: 900;">:</div>
            <div style="flex: 1; min-width: 0; font-weight: 800; padding-left: 1.2mm;">${provinsiFormatted}</div>
          </div>
        </div>

        <!-- BOTTOM RIGHT QR CODE -->
        <div style="
          position: absolute;
          right: 2.2mm;
          bottom: 1.4mm;
          width: 10.5mm;
          text-align: center;
          z-index: 10;
        ">
          <div style="
            width: 10mm;
            height: 10mm;
            background: #ffffff;
            padding: 0.3mm;
            border-radius: 0.8mm;
            border: 0.3mm solid #94a3b8;
            margin: 0 auto;
            box-sizing: border-box;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          ">
            <img src="${qrUrl}" alt="QR" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
          </div>
          <div style="
            font-size: 2.5pt;
            font-weight: 900;
            color: #0284c7;
            margin-top: 0.25mm;
            line-height: 1;
            text-align: center;
            letter-spacing: -0.1px;
          ">
            SCAN VERIFIKASI
          </div>
        </div>
      </div>
    </div>
  `;
};

export const generateBatchPkkCardHtml = (
  items: any[],
  options?: { kelurahan?: string; kecamatan?: string; kota?: string; provinsi?: string }
): string => {
  if (!Array.isArray(items) || items.length === 0) return '';

  const kel = options?.kelurahan || 'MANGGA';
  const kec = options?.kecamatan || 'MEDAN TUNTUNGAN';

  const cardsHtml = items
    .map(
      (item) => `
      <div style="
        display: inline-block;
        margin: 2.5mm;
        padding: 2.5mm;
        border: 1.5px dashed #0284c7;
        border-radius: 4.5mm;
        background: #ffffff;
        page-break-inside: avoid;
        break-inside: avoid;
        box-shadow: 0 2px 6px rgba(0,0,0,0.06);
      ">
        ${generateSinglePkkCardHtml(item, options)}
      </div>
    `
    )
    .join('');

  return `
    <div style="width: 190mm; margin: 0 auto; padding: 6mm 0; font-family: Arial, sans-serif;">
      <div style="text-align: center; margin-bottom: 5mm; border-bottom: 2px solid #0284c7; padding-bottom: 3mm;">
        <h2 style="font-size: 13pt; font-weight: 900; color: #0369a1; margin: 0; text-transform: uppercase;">
          LEMBAR CETAK KARTU TANDA ANGGOTA PKK — KELURAHAN ${kel.toUpperCase()}
        </h2>
        <p style="font-size: 8.5pt; color: #475569; margin-top: 1mm;">
          Kecamatan ${kec.toUpperCase()} • Total ${items.length} Kartu Siap Cetak & Potong (Ukuran Standar ID Card 85.6mm x 53.98mm)
        </p>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 2mm; justify-content: center;">
        ${cardsHtml}
      </div>
    </div>
  `;
};

export const generatePkkCardPdf = async (item: any, photoUrl?: string | null) => {
  if (!item) return;

  const cardId = `kta-card-print-${Date.now()}`;
  const singleCardHtml = generateSinglePkkCardHtml({
    ...item,
    pasphotoUrl: photoUrl || item.pasphotoUrl || item.fotoUrl,
  });

  const pageWrapperHtml = `
    <div style="width: 100%; display: flex; justify-content: center; align-items: center; padding: 20mm 0 10mm 0; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid;">
      <div style="
        padding: 3.8mm;
        border: 2px dashed #0284c7;
        border-radius: 5.5mm;
        background: #ffffff;
        display: inline-block;
        box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        page-break-inside: avoid;
        break-inside: avoid;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      ">
        ${singleCardHtml}
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.id = cardId;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.innerHTML = pageWrapperHtml;
  document.body.appendChild(container);

  try {
    printOfficialDocument(cardId, `KTA_${(item.nama || 'Anggota').replace(/[^a-zA-Z0-9]/g, '_')}`);
  } finally {
    setTimeout(() => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }, 1500);
  }
};
