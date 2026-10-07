import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  FileText,
  Users,
  Award,
  HeartHandshake,
  Calendar,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  Flower2,
  ShieldCheck,
  Building,
  MapPin,
  Clock,
  Layers,
  Baby,
} from 'lucide-react';
import { UserAccount } from '../types';
import {
  subscribePkkKeuangan,
  formatRupiah,
  POS_ANGGARAN_LABELS,
} from '../lib/pkkKeuanganService';
import {
  subscribePkkKegiatan,
  POKJA_LABELS,
} from '../lib/pkkKegiatanService';
import {
  subscribeDasaWisma,
} from '../lib/pkkDasaWismaService';

interface PkkHubDashboardProps {
  currentUser: UserAccount;
  onNavigateTab: (tab: 'keuangan_pkk' | 'kegiatan_pkk' | 'dasa_wisma' | 'posyandu_pkk') => void;
}

export const PkkHubDashboard: React.FC<PkkHubDashboardProps> = ({
  currentUser,
  onNavigateTab,
}) => {
  const [transaksiList, setTransaksiList] = useState<any[]>([]);
  const [kegiatanList, setKegiatanList] = useState<any[]>([]);
  const [dawisList, setDawisList] = useState<any[]>([]);
  const [activePokjaInfo, setActivePokjaInfo] = useState<'I' | 'II' | 'III' | 'IV'>('I');

  useEffect(() => {
    const unsub1 = subscribePkkKeuangan((items) => setTransaksiList(items));
    const unsub2 = subscribePkkKegiatan((items) => setKegiatanList(items));
    const unsub3 = subscribeDasaWisma((items) => setDawisList(items));
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  // Financial Stats
  const finStats = useMemo(() => {
    let totalPenerimaan = 0;
    let totalPengeluaran = 0;
    transaksiList.forEach((tx) => {
      if (tx.jenis === 'PENERIMAAN') totalPenerimaan += tx.jumlah;
      else if (tx.jenis === 'PENGELUARAN') totalPengeluaran += tx.jumlah;
    });
    const saldoKas = totalPenerimaan - totalPengeluaran;
    return { totalPenerimaan, totalPengeluaran, saldoKas };
  }, [transaksiList]);

  // Dawis Stats
  const dawisStats = useMemo(() => {
    let totalKk = 0;
    let totalJiwa = 0;
    let totalBalita = 0;
    let totalLansia = 0;
    dawisList.forEach((d) => {
      totalKk += d.jumlahKk || 0;
      totalJiwa += d.jumlahJiwa || 0;
      totalBalita += d.jumlahBalita || 0;
      totalLansia += d.jumlahLansia || 0;
    });
    return { totalKk, totalJiwa, totalBalita, totalLansia, totalKelompok: dawisList.length };
  }, [dawisList]);

  // Determine user title badge
  const userRoleLabel = useMemo(() => {
    if (currentUser.role === 'ketua_pkk_kelurahan') {
      return 'Ketua TP-PKK Kelurahan';
    }
    if (currentUser.role === 'ketua_pokja') {
      return 'Ketua Pokja PKK';
    }
    if (currentUser.role === 'ketua_pkk_lingkungan') {
      return `Ketua PKK ${currentUser.lingkungan}`;
    }
    return 'Pengurus TP-PKK';
  }, [currentUser]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Hero Welcome Banner TP-PKK */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-tosca-800 via-tosca-700 to-tosca-800 text-white shadow-xl p-6 sm:p-8 border border-tosca-600/30">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-8 w-72 h-72 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-tosca-100 text-xs font-bold tracking-wide shadow-xs">
              <div className="w-6 h-6 rounded-full bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                <img
                  src="/logo_pkk.jpg"
                  alt="Logo PKK"
                  className="w-full h-full object-cover scale-[0.94] transform"
                />
              </div>
              <span>TIM PENGGERAK PKK KELURAHAN MANGGA</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Selamat Bertugas,</span>
              <span className="text-amber-300">{currentUser.nama}</span>
            </h1>
            <p className="text-xs sm:text-sm text-tosca-100 max-w-2xl leading-relaxed">
              SI-MANGGA • Sistem Informasi & Manajemen Terpadu PKK Kelurahan Mangga. Mengelola Buku Kas Umum, Laporan 4 Pokja, Pendataan Dasa Wisma, dan Integrasi Posyandu di 24 Lingkungan.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-tosca-900/60 border border-tosca-500/40 text-[11px] font-bold text-tosca-200">
                {userRoleLabel}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-white/15 border border-white/20 text-[11px] font-semibold text-white">
                📍 {currentUser.lingkungan}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-tosca-900/60 border border-tosca-500/40 text-[11px] font-mono text-tosca-200">
                ID: {currentUser.id}
              </span>
            </div>
          </div>

          {/* Quick Saldo Card */}
          <div className="bg-white/10 backdrop-blur-md border border-white/25 rounded-2xl p-5 shrink-0 shadow-lg min-w-[260px]">
            <div className="flex items-center justify-between text-xs text-tosca-200 mb-1">
              <span className="font-semibold flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-amber-300" />
                <span>Saldo Kas PKK Terkini</span>
              </span>
              <span className="text-[10px] bg-tosca-900/80 px-1.5 py-0.5 rounded text-amber-200 font-mono">
                BKU 2026
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {formatRupiah(finStats.saldoKas)}
            </div>
            <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between text-[11px] text-tosca-100">
              <span className="flex items-center gap-1 text-tosca-300">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Masuk: {formatRupiah(finStats.totalPenerimaan)}</span>
              </span>
              <span className="flex items-center gap-1 text-rose-300">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Keluar: {formatRupiah(finStats.totalPengeluaran)}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Main Action Modules (Segregated specifically for PKK) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Module 1: Buku Kas Umum (BKU) */}
        <div
          onClick={() => onNavigateTab('keuangan_pkk')}
          className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-tosca-500 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-tosca-50 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div>
            <div className="w-12 h-12 rounded-xl bg-tosca-100 text-tosca-800 flex items-center justify-center mb-4 group-hover:bg-tosca-700 group-hover:text-white transition-colors">
              <Wallet className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900 group-hover:text-tosca-800 transition-colors">
                Laporan Keuangan PKK
              </h2>
              <span className="text-[10px] font-black text-tosca-800 bg-tosca-50 px-2 py-0.5 rounded-full border border-tosca-200">
                {transaksiList.length} Transaksi
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Buku Kas Umum (BKU), penerimaan iuran, belanja operasional 4 Pokja, pencatatan kwitansi dan export rekapitulasi keuangan kas PKK.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-tosca-700 group-hover:translate-x-1 transition-transform">
            <span>Buka Buku Kas Umum</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Module 2: Laporan Kegiatan 4 Pokja */}
        <div
          onClick={() => onNavigateTab('kegiatan_pkk')}
          className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-tosca-500 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-tosca-50 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div>
            <div className="w-12 h-12 rounded-xl bg-tosca-100 text-tosca-800 flex items-center justify-center mb-4 group-hover:bg-tosca-700 group-hover:text-white transition-colors">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900 group-hover:text-tosca-800 transition-colors">
                Laporan Kegiatan PKK
              </h2>
              <span className="text-[10px] font-black text-tosca-800 bg-tosca-50 px-2 py-0.5 rounded-full border border-tosca-200">
                {kegiatanList.length} Kegiatan
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Pencatatan dan dokumentasi kegiatan Pokja I, Pokja II, Pokja III, Pokja IV, serta kegiatan TP-PKK di tingkat 24 lingkungan secara real-time.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-tosca-700 group-hover:translate-x-1 transition-transform">
            <span>Catat & Lihat Kegiatan</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Module 3: Dasa Wisma */}
        <div
          onClick={() => onNavigateTab('dasa_wisma')}
          className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-tosca-500 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div>
            <div className="w-12 h-12 rounded-xl bg-tosca-100 text-tosca-800 flex items-center justify-center mb-4 group-hover:bg-tosca-700 group-hover:text-white transition-colors">
              <Users className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900 group-hover:text-tosca-800 transition-colors">
                Data Dasa Wisma
              </h2>
              <span className="text-[10px] font-black text-tosca-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                {dawisStats.totalKelompok} Dasa Wisma
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Database kelompok Dasa Wisma binaan PKK di 24 lingkungan. Rekap data keluarga, ibu hamil, balita, lansia, jamban sehat, dan pekarangan toga.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-tosca-700 group-hover:translate-x-1 transition-transform">
            <span>Buka Data Dasa Wisma</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Module 4: Laporan Posyandu (Pokja IV) */}
        <div
          onClick={() => onNavigateTab('posyandu_pkk')}
          className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-rose-500 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div>
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center mb-4 group-hover:bg-rose-700 group-hover:text-white transition-colors">
              <Baby className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-900 group-hover:text-rose-800 transition-colors">
                Laporan Posyandu
              </h2>
              <span className="text-[10px] font-black text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                Pokja IV
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Pencatatan kegiatan pelayanan kesehatan Posyandu balita dan lansia di 24 lingkungan. Pemantauan stunting dan kesehatan ibu & anak.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-700 group-hover:translate-x-1 transition-transform">
            <span>Buka Laporan Posyandu</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 10 Program Pokok PKK Interactive Guide */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-slate-900">
                10 Program Pokok PKK & Pembagian Tugas 4 Pokja
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pedoman resmi pelaksanaan program Tim Penggerak PKK Kelurahan Mangga TA 2026.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
            {(['I', 'II', 'III', 'IV'] as const).map((pk) => (
              <button
                key={pk}
                type="button"
                onClick={() => setActivePokjaInfo(pk)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  activePokjaInfo === pk
                    ? 'bg-tosca-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pokja {pk}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 animate-in fade-in">
          {activePokjaInfo === 'I' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-tosca-50/60 border border-tosca-200/80 space-y-2">
                <span className="inline-block text-[11px] font-black text-tosca-800 bg-tosca-100 px-2 py-0.5 rounded">
                  Program 1 & 2
                </span>
                <h3 className="font-bold text-sm text-tosca-950">
                  Penghayatan dan Pengamalan Pancasila & Gotong Royong
                </h3>
                <ul className="text-xs text-slate-600 space-y-1.5 pt-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-tosca-600 shrink-0 mt-0.5" />
                    <span>Pola Asuh Anak dan Remaja di Era Digital (PAAREDI).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-tosca-600 shrink-0 mt-0.5" />
                    <span>Pencegahan Kekerasan Dalam Rumah Tangga (PKDRT) & Perlindungan Anak.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-tosca-600 shrink-0 mt-0.5" />
                    <span>Pembinaan Kesadaran Bela Negara (PKBN) dan ketahanan keluarga.</span>
                  </li>
                </ul>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="inline-block text-[11px] font-black text-slate-800 bg-slate-200 px-2 py-0.5 rounded">
                  Fokus Lapangan
                </span>
                <h3 className="font-bold text-sm text-slate-900">
                  Kegiatan Sosial & Keagamaan di Lingkungan
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Pengajian rutin bulanan, kebaktian keluarga, pembinaan kelompok rukun kematian, gotong royong kebersihan lingkungan berkala bersama Kepala Lingkungan.
                </p>
              </div>
            </div>
          )}

          {activePokjaInfo === 'II' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-tosca-50/60 border border-tosca-200/80 space-y-2">
                <span className="inline-block text-[11px] font-black text-tosca-800 bg-tosca-100 px-2 py-0.5 rounded">
                  Program 3 & 4
                </span>
                <h3 className="font-bold text-sm text-tosca-950">
                  Pendidikan dan Keterampilan & Pengembangan Kehidupan Berkoperasi
                </h3>
                <ul className="text-xs text-slate-600 space-y-1.5 pt-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-tosca-600 shrink-0 mt-0.5" />
                    <span>Gerakan Gemar Membaca & Pembinaan Sudut Baca Dasa Wisma.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-tosca-600 shrink-0 mt-0.5" />
                    <span>Bina Keluarga Balita (BKB) Holistik Integratif.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-tosca-600 shrink-0 mt-0.5" />
                    <span>Peningkatan Usaha Peningkatan Pendapatan Keluarga (UP2K) PKK.</span>
                  </li>
                </ul>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="inline-block text-[11px] font-black text-slate-800 bg-slate-200 px-2 py-0.5 rounded">
                  Fokus Lapangan
                </span>
                <h3 className="font-bold text-sm text-slate-900">
                  Pemberdayaan Ekonomi Ibu Rumah Tangga
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Pelatihan pembuatan produk kuliner lokal, kerajinan tangan, pembinaan kelompok simpan pinjam UP2K PKK, dan bazar UMKM warga Kelurahan Mangga.
                </p>
              </div>
            </div>
          )}

          {activePokjaInfo === 'III' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-tosca-50/60 border border-tosca-200/80 space-y-2">
                <span className="inline-block text-[11px] font-black text-tosca-800 bg-tosca-100 px-2 py-0.5 rounded">
                  Program 5, 6 & 7
                </span>
                <h3 className="font-bold text-sm text-tosca-950">
                  Pangan, Sandang, Perumahan dan Tata Laksana Rumah Tangga
                </h3>
                <ul className="text-xs text-slate-600 space-y-1.5 pt-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-tosca-600 shrink-0 mt-0.5" />
                    <span>Gerakan AKU HATINYA PKK (Amalkan dan Kukuhkan Halaman Asri Teratur Indah dan Nyaman).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-tosca-600 shrink-0 mt-0.5" />
                    <span>Pemanfaatan Pekarangan dengan Tanaman Obat Keluarga (TOGA) & Sayuran.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-tosca-600 shrink-0 mt-0.5" />
                    <span>Sosialisasi Menu Seimbang B2SA (Beragam, Bergizi, Seimbang, dan Aman).</span>
                  </li>
                </ul>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="inline-block text-[11px] font-black text-slate-800 bg-slate-200 px-2 py-0.5 rounded">
                  Fokus Lapangan
                </span>
                <h3 className="font-bold text-sm text-slate-900">
                  Ketahanan Pangan Keluarga & Rumah Layak Huni
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Lomba pekarangan asri antar dasawisma lingkungan, edukasi pakaian sopan dan rapi, tata kelola sanitasi dapur rumah tangga bersih bebas jentik.
                </p>
              </div>
            </div>
          )}

          {activePokjaInfo === 'IV' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-tosca-50/60 border border-tosca-200/80 space-y-2">
                <span className="inline-block text-[11px] font-black text-tosca-800 bg-tosca-100 px-2 py-0.5 rounded">
                  Program 8, 9 & 10
                </span>
                <h3 className="font-bold text-sm text-tosca-950">
                  Kesehatan, Kelestarian Lingkungan Hidup, & Perencanaan Sehat
                </h3>
                <ul className="text-xs text-slate-600 space-y-1.5 pt-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-tosca-600 shrink-0 mt-0.5" />
                    <span>Revitalisasi Posyandu & Integrasi Layanan Primer (ILP) Balita hingga Lansia.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-tosca-600 shrink-0 mt-0.5" />
                    <span>Pencegahan dan Penurunan Angka Stunting Warga Kelurahan Mangga.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-tosca-600 shrink-0 mt-0.5" />
                    <span>Perilaku Hidup Bersih dan Sehat (PHBS) & Gerakan Keluarga Berencana (KB).</span>
                  </li>
                </ul>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="inline-block text-[11px] font-black text-slate-800 bg-slate-200 px-2 py-0.5 rounded">
                  Fokus Lapangan
                </span>
                <h3 className="font-bold text-sm text-slate-900">
                  Pemberian Makanan Tambahan (PMT) & Skrining PTM
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Pemantauan status gizi balita setiap bulan, pendampingan ibu hamil berisiko tinggi (Kekurangan Energi Kronis/KEK), dan pemeriksaan tensi rutin lansia.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout: Recent Activities & Recent Cash Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Kegiatan PKK */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-tosca-700" />
                <h3 className="font-bold text-sm text-slate-900">
                  Aktivitas & Kegiatan PKK Terkini
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('kegiatan_pkk')}
                className="text-xs font-bold text-tosca-700 hover:text-tosca-900 cursor-pointer"
              >
                Lihat Semua ({kegiatanList.length})
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {kegiatanList.slice(0, 3).map((act) => (
                <div
                  key={act.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-tosca-300 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-tosca-800 bg-tosca-100/70 px-2 py-0.5 rounded">
                      {POKJA_LABELS[act.pokja as keyof typeof POKJA_LABELS] || act.pokja}
                    </span>
                    <span className="text-slate-500 font-medium">
                      📅 {act.tanggal}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                    {act.namaKegiatan}
                  </h4>
                  <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                    {act.uraianHasil}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>📍 {act.lokasi}</span>
                    <span>Pelapor: {act.pelaporNama}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('kegiatan_pkk')}
            className="w-full mt-4 py-2.5 rounded-xl border border-tosca-300 bg-tosca-50 hover:bg-tosca-100 text-tosca-800 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>+ Laporkan Kegiatan Baru</span>
          </button>
        </div>

        {/* Recent BKU Transactions */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-tosca-700" />
                <h3 className="font-bold text-sm text-slate-900">
                  Arus Kas BKU PKK Terkini
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('keuangan_pkk')}
                className="text-xs font-bold text-tosca-700 hover:text-tosca-900 cursor-pointer"
              >
                Buku Kas ({transaksiList.length})
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {transaksiList.slice(0, 4).map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.jenis === 'PENERIMAAN'
                          ? 'bg-tosca-100 text-tosca-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {tx.jenis === 'PENERIMAAN' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                        {tx.uraian}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {tx.tanggal} • {POS_ANGGARAN_LABELS[tx.posAnggaran as keyof typeof POS_ANGGARAN_LABELS] || tx.posAnggaran}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-black font-mono block ${
                        tx.jenis === 'PENERIMAAN' ? 'text-tosca-700' : 'text-rose-700'
                      }`}
                    >
                      {tx.jenis === 'PENERIMAAN' ? '+' : '-'} {formatRupiah(tx.jumlah)}
                    </span>
                    <span className="text-[9.5px] text-slate-400 font-mono">
                      {tx.nomorBukti || 'Kuitansi'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('keuangan_pkk')}
            className="w-full mt-4 py-2.5 rounded-xl border border-tosca-300 bg-tosca-50 hover:bg-tosca-100 text-tosca-800 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>+ Catat Transaksi Kas Baru</span>
          </button>
        </div>
      </div>
    </div>
  );
};
