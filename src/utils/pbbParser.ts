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
  keterangan?: string;
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
    if (!line || line.startsWith('NO,') || line.startsWith(',,,') || line.includes('DAFTAR OBJEK') || line.includes('Tahun 2025')) {
      return;
    }

    // parse CSV line preserving quoted values
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current) parts.push(current.trim());

    if (parts.length >= 8) {
      const nop = parts[1] || '';
      const buku = (parts[2] || 'I, II, III').replace(/"/g, '');
      const namaWp = (parts[3] || '').replace(/"/g, '');
      const alamatOp = (parts[4] || '').replace(/"/g, '');
      const pbbStr = parts[5] ? parts[5].replace(/[^0-9]/g, '') : '0';
      const statusStr = parts[6] || 'Belum Bayar';
      const lingStr = parts[7] ? parts[7].replace(/[^0-9]/g, '') : '1';

      const pbbVal = parseInt(pbbStr, 10);
      const lingVal = parseInt(lingStr, 10);

      if (!isNaN(pbbVal) && !isNaN(lingVal) && lingVal >= 1 && lingVal <= 24 && nop) {
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
          status: isLunas ? 'Sudah Bayar' : 'Belum Bayar',
          lingkungan: lingVal,
        });
      }
    }
  });

  return { summary, spptItems };
}
