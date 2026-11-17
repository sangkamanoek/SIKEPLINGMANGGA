import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  MapPin,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
} from 'recharts';
import { SpptPbbItem } from '../data/pbbSampleData';

export const NOP_BERMASALAH_PRESET_CATEGORIES = [
  'Objek Pajak Tidak Ditemukan',
  'WP Sudah Meninggal / Pindah',
  'Nama Berbeda dengan Sertifikat',
  'Alamat Tidak Jelas',
  'NOP Ganda',
  'Bangunan Sudah Runtuh/Dihapus',
  'Sengketa Lahan',
] as const;

interface RekapNopBermasalahViewProps {
  spptList: SpptPbbItem[];
  selectedYear: number;
  isKepling: boolean;
  keplingLingkunganNum?: number;
  canEditWp: boolean;
  onManageBermasalah: (item: SpptPbbItem) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

export const RekapNopBermasalahView: React.FC<RekapNopBermasalahViewProps> = ({
  spptList,
  selectedYear,
  isKepling,
  keplingLingkunganNum,
  canEditWp,
  onManageBermasalah,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterLingkungan, setFilterLingkungan] = useState<string>(
    isKepling && keplingLingkunganNum ? String(keplingLingkunganNum) : 'all'
  );
  const [filterJenisMasalah, setFilterJenisMasalah] = useState<string>('all');

  // State untuk Popup Klik Lingkungan dari Diagram / Grid 24 Lingkungan
  const [popupLingkunganNum, setPopupLingkunganNum] = useState<number | null>(null);
  const [popupSearch, setPopupSearch] = useState<string>('');

  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onShowToast) onShowToast(msg, type);
  };

  // Semua NOP yang ditandai bermasalah (urut berdasarkan lingkungan lalu nama)
  const allBermasalahItems = useMemo(() => {
    return spptList
      .filter(
        (item) =>
          Boolean(item.isBermasalah) &&
          (!isKepling || !keplingLingkunganNum || Number(item.lingkungan) === keplingLingkunganNum)
      )
      .sort((a, b) => {
        if ((a.lingkungan || 0) !== (b.lingkungan || 0)) {
          return (a.lingkungan || 0) - (b.lingkungan || 0);
        }
        return (a.namaWp || '').localeCompare(b.namaWp || '');
      });
  }, [spptList, isKepling, keplingLingkunganNum]);

  // Rekap 24 Lingkungan (selalu 1 s/d 24 lengkap untuk diagram)
  const rekap24Lingkungan = useMemo(() => {
    const map: Record<
      number,
      {
        lingkungan: number;
        label: string;
        totalWp: number;
        jumlahBermasalah: number;
        nominalBermasalah: number;
        items: SpptPbbItem[];
      }
    > = {};

    for (let i = 1; i <= 24; i++) {
      map[i] = {
        lingkungan: i,
        label: `L.${i}`,
        totalWp: 0,
        jumlahBermasalah: 0,
        nominalBermasalah: 0,
        items: [],
      };
    }

    spptList.forEach((item) => {
      const ling = Number(item.lingkungan) || 0;
      if (ling >= 1 && ling <= 24 && map[ling]) {
        map[ling].totalWp += 1;
        if (item.isBermasalah) {
          map[ling].jumlahBermasalah += 1;
          map[ling].nominalBermasalah += Number(item.pbbTerutang) || 0;
          map[ling].items.push(item);
        }
      }
    });

    return Array.from({ length: 24 }, (_, idx) => {
      const row = map[idx + 1];
      const pct = row.totalWp > 0 ? (row.jumlahBermasalah / row.totalWp) * 100 : 0;
      return {
        ...row,
        persentaseBermasalah: pct,
      };
    });
  }, [spptList]);

  // Baris lingkungan yang dapat dilihat (terisolasi untuk Kepling)
  const visibleLingkunganRows = useMemo(() => {
    if (isKepling && keplingLingkunganNum) {
      return rekap24Lingkungan.filter((r) => r.lingkungan === keplingLingkunganNum);
    }
    return rekap24Lingkungan;
  }, [rekap24Lingkungan, isKepling, keplingLingkunganNum]);

  // NOP Bermasalah yang belum masuk lingkungan (lingkungan === 0)
  const unmappedBermasalahItems = useMemo(() => {
    if (isKepling) return [];
    return allBermasalahItems.filter((item) => !item.lingkungan || item.lingkungan === 0);
  }, [allBermasalahItems, isKepling]);

  // Rekap per Jenis Masalah (7 kategori preset + Ketik Manual / Lainnya)
  const rekapPerJenisMasalah = useMemo(() => {
    const counts: Record<string, { kategori: string; count: number; nominal: number }> = {};

    NOP_BERMASALAH_PRESET_CATEGORIES.forEach((cat) => {
      counts[cat] = { kategori: cat, count: 0, nominal: 0 };
    });
    counts['__CUSTOM__'] = {
      kategori: 'Masalah Lainnya (Ketik Manual)',
      count: 0,
      nominal: 0,
    };

    allBermasalahItems.forEach((item) => {
      const note = (item.masalahNote || '').trim();
      const matchedPreset = NOP_BERMASALAH_PRESET_CATEGORIES.find((cat) => cat === note);
      const key = matchedPreset ? matchedPreset : '__CUSTOM__';
      counts[key].count += 1;
      counts[key].nominal += Number(item.pbbTerutang) || 0;
    });

    return Object.entries(counts).map(([key, val]) => ({
      key,
      ...val,
    }));
  }, [allBermasalahItems]);

  // Daftar tersaring untuk tabel utama tab Rekap NOP Bermasalah
  const filteredBermasalahList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allBermasalahItems.filter((item) => {
      if (filterLingkungan !== 'all') {
        if (String(item.lingkungan || 0) !== filterLingkungan) return false;
      }
      if (filterJenisMasalah !== 'all') {
        const note = (item.masalahNote || '').trim();
        if (filterJenisMasalah === '__CUSTOM__') {
          if (NOP_BERMASALAH_PRESET_CATEGORIES.includes(note as any)) return false;
        } else if (note !== filterJenisMasalah) {
          return false;
        }
      }
      if (q) {
        const matchNop = (item.nop || '').toLowerCase().includes(q);
        const matchNama = (item.namaWp || '').toLowerCase().includes(q);
        const matchAlamat = (item.alamatOp || '').toLowerCase().includes(q);
        const matchNote = (item.masalahNote || '').toLowerCase().includes(q);
        if (!matchNop && !matchNama && !matchAlamat && !matchNote) return false;
      }
      return true;
    });
  }, [allBermasalahItems, filterLingkungan, filterJenisMasalah, searchQuery]);

  // Total nominal bermasalah keseluruhan
  const totalNominalBermasalah = useMemo(() => {
    return allBermasalahItems.reduce((acc, item) => acc + (Number(item.pbbTerutang) || 0), 0);
  }, [allBermasalahItems]);

  // Data untuk Popup ketika mengklik 1 Lingkungan pada Diagram / Grid
  const popupData = useMemo(() => {
    if (popupLingkunganNum === null) return null;
    const lingRow = rekap24Lingkungan.find((r) => r.lingkungan === popupLingkunganNum);
    const items =
      popupLingkunganNum === 0
        ? unmappedBermasalahItems
        : lingRow?.items || [];

    const q = popupSearch.trim().toLowerCase();
    const filteredItems = q
      ? items.filter(
          (i) =>
            (i.nop || '').toLowerCase().includes(q) ||
            (i.namaWp || '').toLowerCase().includes(q) ||
            (i.alamatOp || '').toLowerCase().includes(q) ||
            (i.masalahNote || '').toLowerCase().includes(q)
        )
      : items;

    const totalNominal = items.reduce((acc, i) => acc + (Number(i.pbbTerutang) || 0), 0);

    return {
      lingkungan: popupLingkunganNum,
      totalWpLingkungan: lingRow?.totalWp || 0,
      items,
      filteredItems,
      totalNominal,
    };
  }, [popupLingkunganNum, popupSearch, rekap24Lingkungan, unmappedBermasalahItems]);

  const handleOpenLingkunganPopup = (lingNum: number) => {
    if (isKepling && keplingLingkunganNum && lingNum !== keplingLingkunganNum) return;
    setPopupLingkunganNum(lingNum);
    setPopupSearch('');
  };

  // Export File Excel (.xlsx) lengkap (Daftar + Rekap 24 Lingkungan + Rekap Jenis Masalah)
  const buildAndDownloadExcel = (
    itemsToExport: SpptPbbItem[],
    filenamePrefix: string,
    includeSummarySheets: boolean
  ) => {
    if (itemsToExport.length === 0) {
      notify('Belum ada NOP Bermasalah untuk diekspor ke Excel.', 'info');
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Daftar Lengkap NOP Bermasalah
      const daftarRows = itemsToExport.map((item, idx) => ({
        'No': idx + 1,
        'NOP': item.nop || '-',
        'Nama Wajib Pajak (WP)': item.namaWp || '-',
        'Alamat Objek Pajak': item.alamatOp || '-',
        'Lingkungan': item.lingkungan > 0 ? `Lingkungan ${item.lingkungan}` : 'Belum Dipetakan (0)',
        'Golongan Buku': item.buku || '-',
        'PBB Terutang (Rp)': Number(item.pbbTerutang) || 0,
        'Status Pembayaran': item.status === 'Sudah Bayar' ? 'Sudah Bayar' : 'Belum Bayar',
        'Jenis / Detail Masalah': item.masalahNote || 'Dilaporkan bermasalah',
        'Keterangan Tambahan': item.keterangan || '-',
        'Terakhir Diperbarui': item.updatedAt ? item.updatedAt.slice(0, 10) : '-',
      }));

      const wsDaftar = XLSX.utils.json_to_sheet(daftarRows);
      wsDaftar['!cols'] = [
        { wch: 6 },
        { wch: 24 },
        { wch: 30 },
        { wch: 34 },
        { wch: 18 },
        { wch: 14 },
        { wch: 18 },
        { wch: 16 },
        { wch: 38 },
        { wch: 24 },
        { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(workbook, wsDaftar, 'Daftar NOP Bermasalah');

      if (includeSummarySheets) {
        // Sheet 2: Rekap Lingkungan
        const rekapLingRows = visibleLingkunganRows.map((r) => ({
          'Lingkungan': `Lingkungan ${r.lingkungan}`,
          'Total WP': r.totalWp,
          'Jumlah NOP Bermasalah': r.jumlahBermasalah,
          'Persentase Bermasalah (%)': Number(r.persentaseBermasalah.toFixed(2)),
          'Total Ketetapan PBB Bermasalah (Rp)': r.nominalBermasalah,
        }));
        const wsLing = XLSX.utils.json_to_sheet(rekapLingRows);
        wsLing['!cols'] = [
          { wch: 18 },
          { wch: 14 },
          { wch: 24 },
          { wch: 24 },
          { wch: 34 },
        ];
        XLSX.utils.book_append_sheet(
          workbook,
          wsLing,
          isKepling ? `Rekap Lingkungan ${keplingLingkunganNum}` : 'Rekap 24 Lingkungan'
        );

        // Sheet 3: Rekap per Jenis Masalah
        const rekapJenisRows = rekapPerJenisMasalah.map((j, idx) => ({
          'No': idx + 1,
          'Kategori / Jenis Masalah': j.kategori,
          'Jumlah NOP': j.count,
          'Total Ketetapan PBB (Rp)': j.nominal,
        }));
        const wsJenis = XLSX.utils.json_to_sheet(rekapJenisRows);
        wsJenis['!cols'] = [
          { wch: 6 },
          { wch: 38 },
          { wch: 14 },
          { wch: 26 },
        ];
        XLSX.utils.book_append_sheet(workbook, wsJenis, 'Rekap Jenis Masalah');
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `${filenamePrefix}_${selectedYear}_${dateStr}.xlsx`);
      notify(`Berhasil mengekspor ${itemsToExport.length} NOP Bermasalah ke file Excel (.xlsx)!`, 'success');
    } catch (err) {
      console.error('Error exporting NOP Bermasalah Excel:', err);
      notify('Gagal mengekspor file Excel NOP Bermasalah.', 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner & Tombol Ekspor Excel */}
      <div className="bg-gradient-to-r from-rose-700 via-rose-800 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-rose-500/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/30 border border-rose-300/40 text-rose-100 text-[10px] font-black uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
            <span>Monitoring Kendala Lapangan PBB-P2 • Tahun {selectedYear}</span>
          </div>
          <h3 className="text-base sm:text-lg font-black tracking-tight">
            {isKepling
              ? `Rekapitulasi & Diagram NOP Bermasalah Lingkungan ${keplingLingkunganNum}`
              : 'Rekapitulasi & Diagram NOP Bermasalah 24 Lingkungan'}
          </h3>
          <p className="text-xs text-rose-100/90 max-w-2xl">
            {isKepling
              ? 'Daftar rekapitulasi kendala NOP khusus wilayah lingkungan Anda. Klik batang diagram atau kartu wilayah untuk melihat popup rincian.'
              : 'Setiap NOP yang ditandai bermasalah oleh Kepala Lingkungan otomatis terekap di sini. Klik batang lingkungan pada diagram atau kartu lingkungan di bawah untuk melihat popup daftar NOP & Wajib Pajak.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              buildAndDownloadExcel(
                filteredBermasalahList.length > 0 && (filterLingkungan !== 'all' || filterJenisMasalah !== 'all' || searchQuery)
                  ? filteredBermasalahList
                  : allBermasalahItems,
                filterLingkungan !== 'all'
                  ? `Daftar_NOP_Bermasalah_Lingkungan_${filterLingkungan}`
                  : 'Rekap_Daftar_NOP_Bermasalah_Kelurahan_Mangga',
                true
              )
            }
            disabled={allBermasalahItems.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs shadow-lg transition-all cursor-pointer border border-emerald-300"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Excel NOP Bermasalah (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Angka Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-rose-700 uppercase">Total NOP Bermasalah</p>
            <p className="text-xl font-black text-rose-950 mt-0.5">
              {allBermasalahItems.length.toLocaleString('id-ID')}{' '}
              <span className="text-xs font-semibold text-slate-500">NOP</span>
            </p>
          </div>
          <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-amber-800 uppercase">Lingkungan Terdampak</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">
              {isKepling ? (
                visibleLingkunganRows.some((r) => r.jumlahBermasalah > 0) ? (
                  '1 Lingkungan'
                ) : (
                  '0 Lingkungan'
                )
              ) : (
                <>
                  {rekap24Lingkungan.filter((r) => r.jumlahBermasalah > 0).length}{' '}
                  <span className="text-xs font-semibold text-slate-500">/ 24 Lingkungan</span>
                </>
              )}
            </p>
          </div>
          <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-600 uppercase">Total Potensi PBB Bermasalah</p>
            <p className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
              {formatRupiah(totalNominalBermasalah)}
            </p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* DIAGRAM NOP BERMASALAH UNTUK 24 LINGKUNGAN (KLIK -> POPUP) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {isKepling
                  ? `Diagram NOP Bermasalah Lingkungan ${keplingLingkunganNum}`
                  : 'Diagram NOP Bermasalah 24 Lingkungan (Klik Batang / Kartu untuk Lihat Daftar)'}
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Arahkan kursor untuk melihat ringkasan atau <span className="font-bold text-rose-700">klik lingkungan mana saja</span> untuk membuka popup daftar NOP &amp; Wajib Pajaknya.
            </p>
          </div>
          {isKepling && (
            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-[10px] font-black text-amber-900 self-start">
              Mode Kepling: Menampilkan data Lingkungan {keplingLingkunganNum}
            </span>
          )}
        </div>

        {/* Bar Chart */}
        <div className="h-64 w-full bg-slate-50/70 rounded-xl border border-slate-200/80 p-2 sm:p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={visibleLingkunganRows}
              margin={{ top: 12, right: 12, left: -12, bottom: 4 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const clickedRow = state.activePayload[0].payload;
                  if (clickedRow && typeof clickedRow.lingkungan === 'number') {
                    handleOpenLingkunganPopup(clickedRow.lingkungan);
                  }
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="lingkungan"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `L.${val}`}
                tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                interval={0}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
              />
              <RechartsTooltip
                cursor={{ fill: 'rgba(244, 63, 94, 0.08)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-rose-200 p-3 rounded-xl shadow-xl text-xs space-y-1 min-w-[210px]">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                          <span className="font-black text-slate-900">Lingkungan {data.lingkungan}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              data.jumlahBermasalah > 0
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {data.jumlahBermasalah} NOP Bermasalah
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Total WP Terdaftar:</span>
                          <span className="font-bold text-slate-800">{data.totalWp} WP</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Nominal Bermasalah:</span>
                          <span className="font-bold text-rose-700">{formatRupiah(data.nominalBermasalah)}</span>
                        </div>
                        <p className="text-[10px] text-rose-600 font-bold pt-1 border-t border-slate-100">
                          👆 Klik batang untuk buka popup daftar NOP &amp; WP
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="jumlahBermasalah"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
                className="cursor-pointer"
                onClick={(barData: any) => {
                  const ling = barData?.lingkungan ?? barData?.payload?.lingkungan;
                  if (typeof ling === 'number') {
                    handleOpenLingkunganPopup(ling);
                  }
                }}
              >
                {visibleLingkunganRows.map((entry) => {
                  const fill =
                    entry.jumlahBermasalah >= 5
                      ? '#be123c'
                      : entry.jumlahBermasalah >= 1
                      ? '#f43f5e'
                      : '#cbd5e1';
                  return (
                    <Cell
                      key={`cell-bermasalah-${entry.lingkungan}`}
                      fill={fill}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda Warna Diagram */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-bold text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#be123c]" />
            <span>Tinggi (≥ 5 NOP Bermasalah)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#f43f5e]" />
            <span>Ada Kendala (1 - 4 NOP Bermasalah)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#cbd5e1]" />
            <span>Aman (0 Bermasalah)</span>
          </span>
        </div>

        {/* Grid Lingkungan */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[11px] font-black text-slate-700 uppercase mb-2">
            {isKepling
              ? `Kotak Wilayah Anda (Lingk ${keplingLingkunganNum}):`
              : 'Klik Kotak Lingkungan (1 - 24) untuk Membuka Popup Daftar NOP & WP:'}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
            {visibleLingkunganRows.map((row) => {
              const hasIssue = row.jumlahBermasalah > 0;
              return (
                <button
                  key={row.lingkungan}
                  type="button"
                  onClick={() => handleOpenLingkunganPopup(row.lingkungan)}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 hover:scale-103 shadow-2xs ${
                    hasIssue
                      ? 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-950'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                  title={`Klik untuk melihat daftar NOP Bermasalah di Lingkungan ${row.lingkungan}`}
                >
                  <span className="text-[10px] font-black uppercase">Lingk {row.lingkungan}</span>
                  <span
                    className={`text-xs font-black px-1.5 py-0.5 rounded-full ${
                      hasIssue ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {row.jumlahBermasalah}
                  </span>
                </button>
              );
            })}
          </div>
          {!isKepling && unmappedBermasalahItems.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => handleOpenLingkunganPopup(0)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Lihat {unmappedBermasalahItems.length} NOP Bermasalah Belum Dipetakan (Lingkungan 0)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* REKAPITULASI PER JENIS MASALAH (KLIK UNTUK FILTER) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Filter className="w-4 h-4 text-rose-600" />
            <span>Rekap Berdasarkan Jenis Masalah (Klik Kartu untuk Menyaring Daftar)</span>
          </h4>
          {filterJenisMasalah !== 'all' && (
            <button
              type="button"
              onClick={() => setFilterJenisMasalah('all')}
              className="text-xs font-bold text-rose-700 hover:underline cursor-pointer"
            >
              Tampilkan Semua Jenis Masalah
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {rekapPerJenisMasalah.map((cat) => {
            const isSelected = filterJenisMasalah === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setFilterJenisMasalah(isSelected ? 'all' : cat.key)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? 'bg-rose-600 text-white border-rose-700 shadow-md'
                    : cat.count > 0
                    ? 'bg-rose-50/60 hover:bg-rose-100/70 border-rose-200 text-slate-900'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold leading-snug">{cat.kategori}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-black shrink-0 ${
                      isSelected
                        ? 'bg-white text-rose-700'
                        : cat.count > 0
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {cat.count}
                  </span>
                </div>
                <span className={`text-[10px] font-semibold ${isSelected ? 'text-rose-100' : 'text-slate-500'}`}>
                  Ketetapan: {formatRupiah(cat.nominal)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* DAFTAR LENGKAP NOP BERMASALAH */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-rose-600" />
              <span>Daftar Lengkap NOP Bermasalah ({filteredBermasalahList.length} NOP)</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Data ini dapat langsung diekspor menjadi file Microsoft Excel (.xlsx) menggunakan tombol di atas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto min-w-0 sm:min-w-[210px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari NOP, Nama WP, atau Masalah..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {!isKepling && (
              <select
                value={filterLingkungan}
                onChange={(e) => setFilterLingkungan(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="all">Semua Lingkungan (1-24)</option>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>
                    Lingkungan {n}
                  </option>
                ))}
                <option value="0">Belum Dipetakan (0)</option>
              </select>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-rose-50 text-rose-950 font-black uppercase text-[10px] tracking-wider border-b border-rose-200">
              <tr>
                <th className="py-3 px-3 text-center w-10">No</th>
                <th className="py-3 px-3">NOP</th>
                <th className="py-3 px-3">Nama Wajib Pajak</th>
                <th className="py-3 px-3">Alamat OP</th>
                <th className="py-3 px-3 text-center">Lingk</th>
                <th className="py-3 px-3 text-right">PBB Terutang</th>
                <th className="py-3 px-3 text-center">Status Bayar</th>
                <th className="py-3 px-3">Jenis / Detail Masalah</th>
                {canEditWp && <th className="py-3 px-3 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredBermasalahList.length === 0 ? (
                <tr>
                  <td colSpan={canEditWp ? 9 : 8} className="py-10 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <p className="font-bold text-slate-700">
                        {allBermasalahItems.length === 0
                          ? 'Belum ada NOP yang ditandai bermasalah.'
                          : 'Tidak ada NOP bermasalah yang cocok dengan filter pencarian Anda.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBermasalahList.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-rose-50/40 transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">{item.nop}</td>
                    <td className="py-2.5 px-3 font-black text-slate-900 uppercase">{item.namaWp || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 uppercase">{item.alamatOp || '-'}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800 whitespace-nowrap">
                      {item.lingkungan > 0 ? `Lingk ${item.lingkungan}` : 'Lingk 0'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-800 whitespace-nowrap">
                      {formatRupiah(item.pbbTerutang)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                          item.status === 'Sudah Bayar'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-red-100 text-red-800 border-red-200'
                        }`}
                      >
                        {item.status === 'Sudah Bayar' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>LUNAS</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>BELUM</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-200 font-bold text-[11px]">
                        <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                        <span>{item.masalahNote || 'Dilaporkan bermasalah'}</span>
                      </span>
                    </td>
                    {canEditWp && (
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onManageBermasalah(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 border border-slate-300 hover:border-rose-300 text-[10px] font-black transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Kelola</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP DAFTAR NOP & WP BERMASALAH KETIKA LINGKUNGAN DIKLIK */}
      {popupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/65 backdrop-blur-xs animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Popup Header */}
            <div className="bg-gradient-to-r from-rose-700 to-rose-800 text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-900/60 rounded-xl border border-rose-400/40">
                  <MapPin className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-tight">
                    {popupData.lingkungan === 0
                      ? 'Daftar NOP & WP Bermasalah — Belum Dipetakan (Lingkungan 0)'
                      : `Daftar NOP & WP Bermasalah — Lingkungan ${popupData.lingkungan}`}
                  </h3>
                  <p className="text-[11px] text-rose-100 font-medium">
                    Ditemukan <strong className="text-white">{popupData.items.length} NOP bermasalah</strong>{' '}
                    {popupData.lingkungan > 0 ? `dari ${popupData.totalWpLingkungan} total WP` : ''} • Total PBB:{' '}
                    <strong className="text-amber-300">{formatRupiah(popupData.totalNominal)}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPopupLingkunganNum(null)}
                className="p-1.5 rounded-lg hover:bg-rose-900/70 text-rose-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Popup Toolbar */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="relative w-full sm:flex-1 min-w-0 sm:min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={popupSearch}
                  onChange={(e) => setPopupSearch(e.target.value)}
                  placeholder="Cari NOP, Nama WP, Alamat, atau Jenis Masalah..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  buildAndDownloadExcel(
                    popupData.items,
                    `NOP_Bermasalah_Lingkungan_${popupData.lingkungan}`,
                    false
                  )
                }
                disabled={popupData.items.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black transition-all shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Excel Lingkungan {popupData.lingkungan} (.xlsx)</span>
              </button>
            </div>

            {/* Popup List / Table */}
            <div className="p-4 overflow-y-auto flex-1">
              {popupData.filteredItems.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-sm font-black text-slate-800">
                    {popupData.items.length === 0
                      ? `Tidak ada NOP Bermasalah di Lingkungan ${popupData.lingkungan}`
                      : 'Tidak ada NOP yang cocok dengan pencarian Anda.'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {popupData.items.length === 0
                      ? 'Seluruh objek pajak pada lingkungan ini berstatus normal.'
                      : 'Coba ubah kata kunci pencarian di atas.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-rose-50 text-rose-950 font-black uppercase text-[10px] border-b border-rose-200">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">No</th>
                        <th className="py-2.5 px-3">NOP</th>
                        <th className="py-2.5 px-3">Nama Wajib Pajak</th>
                        <th className="py-2.5 px-3">Alamat OP</th>
                        <th className="py-2.5 px-3 text-right">PBB Terutang</th>
                        <th className="py-2.5 px-3">Masalah</th>
                        {canEditWp && <th className="py-2.5 px-3 text-center">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {popupData.filteredItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-rose-50/40">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">{item.nop}</td>
                          <td className="py-2.5 px-3 font-black text-slate-900 uppercase">{item.namaWp || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-600 uppercase">{item.alamatOp || '-'}</td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-800 whitespace-nowrap">
                            {formatRupiah(item.pbbTerutang)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-200 font-bold text-[11px]">
                              {item.masalahNote || 'Dilaporkan bermasalah'}
                            </span>
                          </td>
                          {canEditWp && (
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => onManageBermasalah(item)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 border border-slate-300 text-[10px] font-black cursor-pointer"
                              >
                                Ubah / Cabut
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Popup Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setPopupLingkunganNum(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black cursor-pointer"
              >
                Tutup Popup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
