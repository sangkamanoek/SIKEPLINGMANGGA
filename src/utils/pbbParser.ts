export interface SpptPbbItem {
  id: string;
  no: number;
  nop: string;
  buku: string;
  namaWp: string;
  alamatOp: string;
  pbbTerutang: number;
  status: 'Sudah Bayar' | 'Belum Bayar';
  lingkungan: number;
  jumlahBayar?: number | null;
  isDiskon?: boolean;
  diskonPembayaran?: number;
  persenDiskon?: number;
  keterangan?: string | null;
  updatedAt?: string;
}

export interface SummaryLingkungan {
  targetNominal: number;
  realisasiNominal: number;
  totalWp: number;
  wpLunas: number;
}

export function parsePbbCsv(csvText: string) {
  const lines = csvText.split('\n');
  const summary: Record<number, SummaryLingkungan> = {};

  for (let i = 1; i <= 24; i++) {
    summary[i] = { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 };
  }

  const spptItems: SpptPbbItem[] = [];
  let count = 0;

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith('NO,') ||
      line.startsWith(',,,') ||
      line.toLowerCase().includes('kecamatan') ||
      line.toLowerCase().includes('kelurahan') ||
      line.includes('DAFTAR OBJEK') ||
      line.toLowerCase().includes('pbb (rp)')
    ) {
      return;
    }

    // Determine delimiter (tab, semicolon, or comma)
    let delimiter = ',';
    if (line.includes('\t')) delimiter = '\t';
    else if (line.includes(';') && !line.includes(',')) delimiter = ';';

    // parse line preserving quoted values
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current) parts.push(current.trim());

    if (parts.length >= 7) {
      let nop = '';
      let buku = 'I, II, III';
      let namaWp = '';
      let alamatOp = '';
      let pbbVal = 0;
      let statusStr = 'Belum Bayar';
      let lingVal = 1;

      // Format A: Standard 8 columns [No, NOP, Buku, Nama, Alamat, PBB, Status, Lingk]
      if (parts.length >= 8 && parts[7] && !isNaN(parseInt(parts[7].replace(/[^0-9]/g, ''), 10))) {
        nop = parts[1] || '';
        buku = (parts[2] || 'I, II, III').replace(/"/g, '');
        namaWp = (parts[3] || '').replace(/"/g, '');
        alamatOp = (parts[4] || '').replace(/"/g, '');
        pbbVal = parseInt(parts[5] ? parts[5].replace(/[^0-9]/g, '') : '0', 10) || 0;
        statusStr = parts[6] || 'Belum Bayar';
        lingVal = parseInt(parts[7].replace(/[^0-9]/g, ''), 10) || 1;
      }
      // Format B: 7 columns [Nomor, NOP, Tahun, Nama WP, Alamat OP, PBB (Rp), Status]
      else {
        nop = parts[1] || parts[0] || '';
        namaWp = (parts[3] || parts[2] || '').replace(/"/g, '');
        alamatOp = (parts[4] || '').replace(/"/g, '');
        pbbVal = parseInt(parts[5] ? parts[5].replace(/[^0-9]/g, '') : '0', 10) || 0;
        statusStr = parts[6] || parts[5] || 'Belum Bayar';

        // Infer Lingkungan from NOP block (e.g. 12.75.010.009.001-... -> 1)
        const blockMatch = nop.match(/\.009\.(\d{3})-/i) || nop.replace(/[^0-9]/g, '').match(/009(\d{3})/);
        if (blockMatch) {
          const bNum = parseInt(blockMatch[1], 10);
          if (bNum >= 1 && bNum <= 24) {
            lingVal = bNum;
          }
        }
      }

      if (!isNaN(pbbVal) && lingVal >= 1 && lingVal <= 24 && nop && nop.replace(/[^0-9]/g, '').length >= 15) {
        count++;
        const isLunas = statusStr.toLowerCase().includes('lunas') || statusStr.toLowerCase().includes('sudah');

        summary[lingVal].totalWp += 1;
        summary[lingVal].targetNominal += pbbVal;
        if (isLunas) {
          summary[lingVal].wpLunas += 1;
          summary[lingVal].realisasiNominal += pbbVal;
        }

        spptItems.push({
          id: `sppt_${count}`,
          no: count,
          nop,
          buku,
          namaWp,
          alamatOp,
          pbbTerutang: pbbVal,
          jumlahBayar: isLunas ? pbbVal : null,
          status: isLunas ? 'Sudah Bayar' : 'Belum Bayar',
          lingkungan: lingVal,
        });
      }
    }
  });

  return { summary, spptItems };
}
