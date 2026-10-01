import React, { useState } from 'react';
import { RealisasiPembangunan, UserAccount } from '../types';
import { Printer, Download, X, CheckCircle2, MapPin, Calendar, Building, Sparkles, FileText, Layers } from 'lucide-react';
import { downloadProjectPhotosAsZip, downloadImage, getHighResImageUrl } from '../lib/imageDownloader';

interface CetakLaporanPembangunanModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: RealisasiPembangunan[];
  currentUser: UserAccount;
  initialSelectedId?: string | null;
}

export const CetakLaporanPembangunanModal: React.FC<CetakLaporanPembangunanModalProps> = ({
  isOpen,
  onClose,
  items,
  currentUser,
  initialSelectedId = null,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialSelectedId || 'all');
  const [selectedLingkungan, setSelectedLingkungan] = useState<string>('all');
  const [printViewMode, setPrintViewMode] = useState<'per_laporan' | 'rekap_tabel'>('per_laporan');
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipProgressText, setZipProgressText] = useState('');
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter items based on selection
  const filteredItems = items.filter((item) => {
    if (selectedProjectId !== 'all' && item.id !== selectedProjectId) {
      return false;
    }
    if (selectedLingkungan !== 'all' && item.lingkunganNomor !== Number(selectedLingkungan)) {
      return false;
    }
    return true;
  });

  const totalBiaya = filteredItems.reduce((acc, curr) => acc + (curr.biayaEstimasiRp || 0), 0);
  const totalSelesai = filteredItems.filter((i) => i.statusRealisasi === 'SELESAI_100%').length;
  const totalProses = filteredItems.filter((i) => i.statusRealisasi === 'PROSES_PENGERJAAN').length;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadAllZip = async () => {
    if (filteredItems.length === 0) return;
    setIsDownloadingZip(true);
    setZipProgressText('Menyiapkan foto HD...');

    const success = await downloadProjectPhotosAsZip(
      filteredItems,
      `Dokumentasi_Infrastruktur_Mangga_${selectedProjectId !== 'all' ? `Proyek_${selectedProjectId}` : 'Semua_Laporan'}.zip`,
      (txt) => setZipProgressText(txt)
    );

    setIsDownloadingZip(false);
    setZipProgressText('');

    if (success) {
      setDownloadSuccessToast('Seluruh foto dokumentasi resolusi tinggi berhasil diunduh (.ZIP)!');
      setTimeout(() => setDownloadSuccessToast(null), 4000);
    }
  };

  const getStagePhotos = (urls: string[] | undefined, fallbackUrl: string | undefined) => {
    return Array.from(new Set([...(urls || []), ...(fallbackUrl ? [fallbackUrl] : [])])).filter(Boolean);
  };

  const currentDateFormatted = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-start overflow-y-auto p-0 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto print:overflow-visible">
      
      {/* Print Specific CSS to enforce EXACT 1 Page Per Report on A4 */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 6mm 8mm 6mm 8mm !important;
        }
        @media print {
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
          }
          .no-print, .print\\:hidden {
            display: none !important;
          }
          .laporan-single-page {
            width: 100% !important;
            max-width: 194mm !important;
            height: 278mm !important;
            max-height: 278mm !important;
            margin: 0 auto !important;
            padding: 4mm 2mm !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
          }
          .laporan-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          .laporan-last-page {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .photo-thumb-box {
            height: 58px !important;
            max-height: 58px !important;
          }
          .photo-thumb-box-sm {
            height: 52px !important;
            max-height: 52px !important;
          }
        }
      `}</style>

      {/* ACTION BAR (Hidden during printing) */}
      <div className="sticky top-0 z-50 w-full max-w-5xl bg-slate-900 border-b border-slate-700/80 px-4 py-3 rounded-none sm:rounded-t-2xl shadow-2xl flex flex-wrap items-center justify-between gap-3 text-white backdrop-blur-md print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600 text-white">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
              <span>Cetak Laporan Realisasi Infrastruktur</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                1 Halaman Pas / Laporan
              </span>
            </h2>
            <p className="text-[11px] text-slate-300">
              Format baku kedinasan: 1 Halaman A4 per Proyek lengkap dengan Kop Resmi, Spesifikasi &amp; Foto Dokumentasi 3 Tahapan (3-4-3).
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Mode Selector */}
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setPrintViewMode('per_laporan')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                printViewMode === 'per_laporan' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              📄 1 Halaman per Laporan ({filteredItems.length})
            </button>
            <button
              type="button"
              onClick={() => setPrintViewMode('rekap_tabel')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                printViewMode === 'rekap_tabel' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              📊 Rekap Tabel A4
            </button>
          </div>

          {/* Project Selector Filter */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold max-w-[200px] truncate"
          >
            <option value="all">Semua Proyek ({items.length} Halaman)</option>
            {items.map((it, i) => (
              <option key={it.id} value={it.id}>
                #{i + 1} Lk.{it.lingkunganNomor} - {it.namaProyek.slice(0, 28)}...
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleDownloadAllZip}
            disabled={isDownloadingZip}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-60"
            title="Unduh satu paket arsip ZIP seluruh foto resolusi tinggi"
          >
            <Download className={`w-3.5 h-3.5 ${isDownloadingZip ? 'animate-bounce' : ''}`} />
            <span>{isDownloadingZip ? (zipProgressText || 'Mengunduh...') : 'Unduh Foto HD (.ZIP)'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak 1 Halaman / PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title="Tutup Pratinjau"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* TOAST SUCCESS */}
      {downloadSuccessToast && (
        <div className="fixed top-16 right-6 z-60 bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-slide-up print:hidden">
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>{downloadSuccessToast}</span>
        </div>
      )}

      {/* PRINT CONTAINER WITH EXACT 1-PAGE A4 ENFORCEMENT */}
      <div className="w-full max-w-5xl bg-slate-200 p-2 sm:p-6 space-y-6 print:p-0 print:m-0 print:bg-white print:w-full print:space-y-0">
        
        {/* ========================================================================= */}
        {/* MODE A: 1 HALAMAN A4 PER LAPORAN PROYEK                                  */}
        {/* ========================================================================= */}
        {printViewMode === 'per_laporan' && (
          <div className="space-y-6 print:space-y-0">
            {filteredItems.map((item, idx) => {
              const sebelumList = getStagePhotos(item.fotoSebelumList, item.fotoSebelumUrl);
              const prosesList = getStagePhotos(item.fotoProsesList, item.fotoProsesUrl);
              const sesudahList = getStagePhotos(item.fotoSesudahList, item.fotoSesudahUrl);
              const isLast = idx === filteredItems.length - 1;

              return (
                <div
                  key={item.id}
                  className={`laporan-single-page ${isLast ? 'laporan-last-page' : 'laporan-page-break'} w-full max-w-[210mm] mx-auto bg-white text-slate-900 p-5 sm:p-6 rounded-2xl shadow-xl print:p-2 print:m-0 print:shadow-none print:w-full print:rounded-none print:border-none flex flex-col justify-between`}
                  style={{
                    pageBreakAfter: isLast ? 'auto' : 'always',
                    breakAfter: isLast ? 'auto' : 'page',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                    minHeight: '265mm',
                    maxHeight: '280mm',
                  }}
                >
                  {/* TOP CONTAINER: KOP + METADATA + FOTO */}
                  <div className="space-y-1.5">
                    {/* 1. KOP SURAT RESMI PEMERINTAH KOTA MEDAN */}
                    <div className="border-b-2 border-slate-950 pb-1.5 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-11 h-11 shrink-0 flex items-center justify-center">
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/e/eb/Lambang_Kota_Medan.png"
                            alt="Logo Pemko Medan"
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                            className="w-11 h-11 object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="text-center">
                          <h3 className="text-[10px] font-bold tracking-wider text-slate-800 uppercase leading-tight">
                            PEMERINTAH KOTA MEDAN • KECAMATAN MEDAN TUNTUNGAN
                          </h3>
                          <h1 className="text-sm font-black text-blue-950 tracking-tight uppercase leading-tight">
                            KELURAHAN MANGGA
                          </h1>
                          <p className="text-[8px] text-slate-600 font-medium leading-tight">
                            Jl. Bunga Ncole No. 5, Kelurahan Mangga, Kec. Medan Tuntungan, Kota Medan 20135
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 2. JUDUL LEMBAR LAPORAN */}
                    <div className="text-center space-y-0.5 pt-0.5">
                      <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase underline tracking-wide">
                        LEMBAR LAPORAN REALISASI PEMBANGUNAN &amp; DOKUMENTASI FISIK
                      </h2>
                      <p className="text-[8.5px] font-bold text-slate-600">
                        Tahun Anggaran 2026 • Wilayah Lingkungan {item.lingkunganNomor} Kelurahan Mangga
                      </p>
                    </div>

                    {/* 3. TABEL SPESIFIKASI PROYEK */}
                    <div className="border border-slate-400 rounded overflow-hidden bg-slate-50 text-[8.5px] leading-tight">
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr className="border-b border-slate-300">
                            <td className="p-1 font-bold text-slate-600 w-28 bg-slate-100 border-r border-slate-300">
                              Nama Proyek / Kegiatan
                            </td>
                            <td className="p-1 font-black text-slate-950" colSpan={3}>
                              {item.namaProyek}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-300">
                            <td className="p-1 font-bold text-slate-600 bg-slate-100 border-r border-slate-300">
                              Lokasi Detail
                            </td>
                            <td className="p-1 font-semibold text-slate-800">
                              📍 {item.lokasiDetail} (Lingkungan {item.lingkunganNomor})
                            </td>
                            <td className="p-1 font-bold text-slate-600 w-24 bg-slate-100 border-l border-r border-slate-300">
                              Volume Fisik
                            </td>
                            <td className="p-1 font-black text-slate-900 w-28">
                              {item.volumeRealisasi || '-'}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-300">
                            <td className="p-1 font-bold text-slate-600 bg-slate-100 border-r border-slate-300">
                              Sumber Dana / Pelaksana
                            </td>
                            <td className="p-1 font-semibold text-slate-800">
                              {item.sumberDana} {item.pelaksanaTeknis ? `(${item.pelaksanaTeknis})` : ''}
                            </td>
                            <td className="p-1 font-bold text-slate-600 bg-slate-100 border-l border-r border-slate-300">
                              Estimasi Anggaran
                            </td>
                            <td className="p-1 font-black text-slate-950">
                              {item.biayaEstimasiRp ? `Rp ${item.biayaEstimasiRp.toLocaleString('id-ID')}` : '-'}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-1 font-bold text-slate-600 bg-slate-100 border-r border-slate-300">
                              Periode Pengerjaan
                            </td>
                            <td className="p-1 font-semibold text-slate-800">
                              {item.tanggalMulai ? `${item.tanggalMulai} s.d. ${item.tanggalSelesai || 'Selesai'}` : '-'}
                            </td>
                            <td className="p-1 font-bold text-slate-600 bg-slate-100 border-l border-r border-slate-300">
                              Status Fisik
                            </td>
                            <td className="p-1 font-black text-emerald-800">
                              <span className={`px-1.5 py-0.2 rounded text-[7.5px] font-black uppercase ${
                                item.statusRealisasi === 'SELESAI_100%'
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : item.statusRealisasi === 'PROSES_PENGERJAAN'
                                  ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}>
                                {item.statusRealisasi === 'SELESAI_100%' ? '✅ 100% TUNTAS' : item.statusRealisasi === 'PROSES_PENGERJAAN' ? '⏳ PROSES 50%' : '💡 USULAN'}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 4. DOKUMENTASI FOTO LAPANGAN 3 TAHAPAN (3-4-3) */}
                    <div className="space-y-1.5 pt-0.5">
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-900 border-l-3 border-blue-700 pl-1.5 flex items-center justify-between">
                        <span>DOKUMENTASI VISUAL 3 TAHAP PELAKSANAAN</span>
                        <span className="text-[7.5px] font-bold text-slate-500 lowercase">
                          (3 foto awal • 4 foto proses • 3 foto selesai)
                        </span>
                      </div>

                      {/* TAHAP 1: KONDISI AWAL (0%) - 3 FOTO */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[7.5px] font-black text-rose-950 uppercase leading-none">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
                            1. Kondisi Awal Sebelum Pengerjaan (0%)
                          </span>
                          <span className="text-slate-500">{sebelumList.length} Foto</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {sebelumList.slice(0, 3).map((photoUrl, pIdx) => (
                            <div key={pIdx} className="space-y-0.5">
                              <div className="photo-thumb-box rounded border border-slate-300 overflow-hidden h-15 sm:h-16 bg-slate-100">
                                <img
                                  src={getHighResImageUrl(photoUrl)}
                                  alt={`Awal ${pIdx + 1}`}
                                  referrerPolicy="no-referrer"
                                  crossOrigin="anonymous"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span className="block text-[7px] text-center font-bold text-slate-600 truncate">
                                Foto 1.{pIdx + 1}: Titik 0% Awal
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* TAHAP 2: PROSES PENGERJAAN (50%) - 4 FOTO */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[7.5px] font-black text-blue-950 uppercase leading-none">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
                            2. Proses Pengerjaan Lapangan (Sedang Berjalan 50%)
                          </span>
                          <span className="text-slate-500">{prosesList.length} Foto</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {prosesList.slice(0, 4).map((photoUrl, pIdx) => (
                            <div key={pIdx} className="space-y-0.5">
                              <div className="photo-thumb-box-sm rounded border border-slate-300 overflow-hidden h-14 sm:h-15 bg-slate-100">
                                <img
                                  src={getHighResImageUrl(photoUrl)}
                                  alt={`Proses ${pIdx + 1}`}
                                  referrerPolicy="no-referrer"
                                  crossOrigin="anonymous"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span className="block text-[7px] text-center font-bold text-slate-600 truncate">
                                Foto 2.{pIdx + 1}: Progres Fisik
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* TAHAP 3: KONDISI SELESAI (100%) - 3 FOTO */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[7.5px] font-black text-emerald-950 uppercase leading-none">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                            3. Hasil Akhir Pembangunan Selesai (100%)
                          </span>
                          <span className="text-slate-500">{sesudahList.length} Foto</span>
                        </div>
                        {sesudahList.length > 0 ? (
                          <div className="grid grid-cols-3 gap-1">
                            {sesudahList.slice(0, 3).map((photoUrl, pIdx) => (
                              <div key={pIdx} className="space-y-0.5">
                                <div className="photo-thumb-box rounded border border-slate-300 overflow-hidden h-15 sm:h-16 bg-slate-100">
                                  <img
                                    src={getHighResImageUrl(photoUrl)}
                                    alt={`Selesai ${pIdx + 1}`}
                                    referrerPolicy="no-referrer"
                                    crossOrigin="anonymous"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <span className="block text-[7px] text-center font-bold text-slate-600 truncate">
                                  Foto 3.{pIdx + 1}: Hasil Akhir 100%
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-1.5 bg-slate-50 border border-dashed border-slate-300 rounded text-center text-[7.5px] text-slate-500 font-medium">
                            {item.statusRealisasi === 'PROSES_PENGERJAAN'
                              ? 'Proyek sedang berjalan di lapangan (foto 100% diunggah saat tuntas)'
                              : 'Belum ada foto tuntas'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CATATAN LAPANGAN */}
                    {item.keterangan && (
                      <div className="p-1 rounded bg-slate-50 border border-slate-300 text-[7.5px] text-slate-700 leading-tight">
                        <strong>Catatan Verifikator Lapangan:</strong> {item.keterangan}
                      </div>
                    )}
                  </div>

                  {/* BOTTOM CONTAINER: LEMBAR TANDA TANGAN RESMI */}
                  <div className="pt-1.5 border-t-2 border-slate-900 space-y-1 text-[8.5px] leading-tight">
                    <div className="flex items-center justify-between font-semibold text-slate-700 text-[7.5px]">
                      <span>Medan, {currentDateFormatted}</span>
                      <span>Klasifikasi: Dokumen Kedinasan Resmi • Hal. {idx + 1} dari {filteredItems.length}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-6 text-center pt-0.5">
                      <div>
                        <p className="font-bold text-slate-900 text-[8px]">
                          Mengetahui / Menyetujui,<br />
                          <strong>LURAH KELURAHAN MANGGA</strong>
                        </p>
                        <div className="h-10 sm:h-12 flex items-center justify-center">
                          {/* Signature space */}
                        </div>
                        <div className="space-y-0.2">
                          <p className="font-black text-slate-950 underline uppercase text-[8.5px]">
                            WILLY YANUS GINTING, S.STP
                          </p>
                          <p className="text-[7px] text-slate-600">
                            Penata Tingkat I / NIP. 19850115 200412 1 001
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 text-[8px]">
                          Petugas Lapangan / Verifikator,<br />
                          <strong>KASI TRANTIBUM / KEPALA LINGKUNGAN {item.lingkunganNomor}</strong>
                        </p>
                        <div className="h-10 sm:h-12 flex items-center justify-center">
                          {/* Signature space */}
                        </div>
                        <div className="space-y-0.2">
                          <p className="font-black text-slate-950 underline uppercase text-[8.5px]">
                            {item.createdByName || currentUser.nama || 'KEPALA LINGKUNGAN'}
                          </p>
                          <p className="text-[7px] text-slate-600">
                            Kelurahan Mangga - Kec. Medan Tuntungan
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE B: REKAPITULASI TABEL WILAYAH (1 HALAMAN)                           */}
        {/* ========================================================================= */}
        {printViewMode === 'rekap_tabel' && (
          <div
            className="laporan-single-page laporan-last-page w-full max-w-[210mm] mx-auto bg-white text-slate-900 p-5 sm:p-6 rounded-2xl shadow-xl space-y-3 print:p-2 print:m-0 print:shadow-none print:w-full print:rounded-none flex flex-col justify-between"
            style={{ minHeight: '265mm', maxHeight: '280mm' }}
          >
            <div className="space-y-2.5">
              {/* Kop Surat */}
              <div className="border-b-2 border-slate-950 pb-1.5 text-center">
                <div className="flex items-center justify-center gap-3">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/e/eb/Lambang_Kota_Medan.png"
                    alt="Logo Pemko Medan"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="w-11 h-11 object-contain"
                  />
                  <div className="text-center">
                    <h3 className="text-[10px] font-bold text-slate-800 uppercase">PEMERINTAH KOTA MEDAN • KECAMATAN MEDAN TUNTUNGAN</h3>
                    <h1 className="text-sm font-black text-blue-950 uppercase">KELURAHAN MANGGA</h1>
                    <p className="text-[8px] text-slate-600">Jl. Bunga Ncole No. 5, Kelurahan Mangga, Kec. Medan Tuntungan, Kota Medan 20135</p>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center space-y-0.5">
                <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase underline">
                  REKAPITULASI REALISASI PEMBANGUNAN &amp; INFRASTRUKTUR WILAYAH
                </h2>
                <p className="text-[9px] font-bold text-slate-600">
                  Tahun Anggaran 2026 • Monitoring 24 Lingkungan Kelurahan Mangga
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-2 p-2 rounded-lg bg-slate-50 border border-slate-300 text-[9px]">
                <div>
                  <span className="text-[7.5px] font-bold text-slate-500 uppercase block">Total Proyek</span>
                  <span className="text-xs font-black text-slate-900">{filteredItems.length} Kegiatan</span>
                </div>
                <div>
                  <span className="text-[7.5px] font-bold text-slate-500 uppercase block">Selesai 100%</span>
                  <span className="text-xs font-black text-emerald-700">{totalSelesai} Lokasi</span>
                </div>
                <div>
                  <span className="text-[7.5px] font-bold text-slate-500 uppercase block">Proses Pengerjaan</span>
                  <span className="text-xs font-black text-blue-700">{totalProses} Lokasi</span>
                </div>
                <div>
                  <span className="text-[7.5px] font-bold text-slate-500 uppercase block">Total Nilai Anggaran</span>
                  <span className="text-xs font-black text-slate-950">
                    {totalBiaya > 0 ? `Rp ${totalBiaya.toLocaleString('id-ID')}` : 'Rp 0'}
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-[8px] text-left border-collapse">
                  <thead className="bg-slate-100 font-black text-slate-900 border-b border-slate-300">
                    <tr>
                      <th className="p-1 border-r border-slate-300 text-center w-7">No</th>
                      <th className="p-1 border-r border-slate-300 w-12 text-center">Lingk.</th>
                      <th className="p-1 border-r border-slate-300">Nama Kegiatan &amp; Lokasi</th>
                      <th className="p-1 border-r border-slate-300 w-28">Sumber Dana</th>
                      <th className="p-1 border-r border-slate-300 w-16 text-center">Volume</th>
                      <th className="p-1 border-r border-slate-300 w-22 text-right">Anggaran</th>
                      <th className="p-1 text-center w-18">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-1 border-r border-slate-300 text-center font-bold">{idx + 1}</td>
                        <td className="p-1 border-r border-slate-300 text-center font-bold">Lk. {item.lingkunganNomor}</td>
                        <td className="p-1 border-r border-slate-300">
                          <div className="font-bold text-slate-950">{item.namaProyek}</div>
                          <div className="text-[7.5px] text-slate-500">📍 {item.lokasiDetail}</div>
                        </td>
                        <td className="p-1 border-r border-slate-300 text-[7.5px]">{item.sumberDana}</td>
                        <td className="p-1 border-r border-slate-300 text-center font-semibold">{item.volumeRealisasi || '-'}</td>
                        <td className="p-1 border-r border-slate-300 text-right font-bold">
                          {item.biayaEstimasiRp ? `Rp ${item.biayaEstimasiRp.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="p-1 text-center">
                          <span className={`px-1 py-0.2 rounded text-[7px] font-black uppercase ${
                            item.statusRealisasi === 'SELESAI_100%'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : item.statusRealisasi === 'PROSES_PENGERJAAN'
                              ? 'bg-blue-100 text-blue-900 border border-blue-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}>
                            {item.statusRealisasi === 'SELESAI_100%' ? '100% Tuntas' : item.statusRealisasi === 'PROSES_PENGERJAAN' ? 'Proses 50%' : 'Usulan'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signature */}
            <div className="pt-1.5 border-t-2 border-slate-900 space-y-1 text-[8.5px]">
              <div className="flex items-center justify-between font-semibold text-slate-700 text-[7.5px]">
                <span>Medan, {currentDateFormatted}</span>
                <span>Klasifikasi: Dokumen Rekapitulasi Resmi</span>
              </div>
              <div className="grid grid-cols-2 gap-6 text-center pt-0.5">
                <div>
                  <p className="font-bold text-slate-900 text-[8px]">
                    Mengetahui / Menyetujui,<br />
                    <strong>LURAH KELURAHAN MANGGA</strong>
                  </p>
                  <div className="h-10 sm:h-12 flex items-center justify-center"></div>
                  <div className="space-y-0.2">
                    <p className="font-black text-slate-950 underline uppercase text-[8.5px]">
                      WILLY YANUS GINTING, S.STP
                    </p>
                    <p className="text-[7px] text-slate-600">
                      Penata Tingkat I / NIP. 19850115 200412 1 001
                    </p>
                  </div>
                </div>

                <div>
                  <p className="font-bold text-slate-900 text-[8px]">
                    Petugas Verifikator Lapangan,<br />
                    <strong>KASI TRANTIBUM &amp; PEMBANGUNAN</strong>
                  </p>
                  <div className="h-10 sm:h-12 flex items-center justify-center"></div>
                  <div className="space-y-0.2">
                    <p className="font-black text-slate-950 underline uppercase text-[8.5px]">
                      {currentUser.role === 'kasi' ? currentUser.namaLengkap : 'STAF SEKSI TRANTIBUM'}
                    </p>
                    <p className="text-[7px] text-slate-600">
                      Kelurahan Mangga - Kec. Medan Tuntungan
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
