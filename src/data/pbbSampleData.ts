export interface SpptPbbItem {
  id: string;
  no: number;
  nop: string;
  buku: string;
  namaWp: string;
  alamatOp: string;
  pbbTerutang: number;
  jumlahBayar?: number | null; // Realisasi nominal yang dibayarkan jika ada pemotongan
  status: 'Sudah Bayar' | 'Belum Bayar';
  lingkungan: number;
  keterangan?: string | null;
  updatedAt?: string;
}

export interface RekapLingkunganPbb {
  lingkungan: number;
  totalWp: number;
  totalLunas: number;
  totalBelumLunas: number;
  targetNominal: number;
  realisasiNominal: number;
  persentaseRealisasi: number;
  persentaseWpLunas: number;
}

// Data awal realisasi SPPT PBB Kelurahan Mangga (Dikosongkan 0 agar 100% terhitung otomatis dari CSV yang diimpor)
export const INITIAL_PBB_SUMMARY: Record<number, { targetNominal: number; realisasiNominal: number; totalWp: number; wpLunas: number }> = {
  1: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  2: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  3: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  4: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  5: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  6: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  7: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  8: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  9: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  10: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  11: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  12: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  13: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  14: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  15: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  16: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  17: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  18: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  19: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  20: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  21: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  22: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  23: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 },
  24: { targetNominal: 0, realisasiNominal: 0, totalWp: 0, wpLunas: 0 }
};

// Sample SPPT Detail per WP (Dikosongkan agar pengguna dapat entri manual / import via CSV)
export const SAMPLE_SPPT_ITEMS: SpptPbbItem[] = [];
