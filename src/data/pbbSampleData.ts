export interface SpptPbbItem {
  id: string;
  no?: number;
  nop: string;
  namaWp: string;
  alamatObjek?: string;
  alamatOp?: string;
  lingkungan?: number;
  buku?: string | number;
  pbbTerutang?: number;
  ketetapan?: number;
  terbayar?: number;
  jumlahBayar?: number | null;
  status: 'LUNAS' | 'BELUM_LUNAS' | 'Sudah Bayar' | 'Belum Bayar' | string;
  keterangan?: string;
  tglBayar?: string | null;
  updatedAt?: string;
  isDiskon?: boolean;
  diskonPembayaran?: number;
  persenDiskon?: number;
}

export const INITIAL_PBB_SUMMARY = { totalKetetapan: 0, totalTerbayar: 0, persentase: 0 };
export const SAMPLE_SPPT_ITEMS: SpptPbbItem[] = [];
export const PBB_SAMPLE_DATA = [];
