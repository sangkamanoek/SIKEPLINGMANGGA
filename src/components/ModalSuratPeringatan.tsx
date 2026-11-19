import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  X,
  FileText,
  Printer,
  Download,
  Award,
  AlertCircle,
  Calendar,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { UserAccount, AbsensiApelHarian, JadwalPoskoItem } from '../types';
import { KEPLING_ACCOUNTS, getEffectiveProfile } from '../data/keplingList';
import { getLocalAbsensiApelList } from '../lib/absensiApelService';
import { getLocalJadwalPoskoList, isKeplingPoskoDutyScored } from '../lib/jadwalPoskoService';
import { KopSuratResmi } from './KopSuratResmi';
import { printOfficialDocument, downloadPdfDocument } from '../utils/printHelper';
import { formatTanggalSingkatIndonesia } from '../lib/absensiAgendaService';

interface ModalSuratPeringatanProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface KeplingDisiplinRecord {
  keplingId: string;
  nomorLingkungan: number;
  lingkungan: string;
  namaKepling: string;
  telepon: string;
  apelTotal: number;
  apelHadir: number;
  apelTerlambat: number;
  apelIzin: number;
  apelSakit: number;
  apelAlpa: number;
  apelPercentage: number;
  poskoTotal: number;
  poskoHadir: number;
  poskoTidakHadir: number;
  totalPelanggaran: number;
  rekomendasiTingkat: 'SP-1' | 'SP-2' | 'SP-3' | 'TEGARAN_PEMBINAAN';
  alasanSp: string[];
}

export const ModalSuratPeringatan: React.FC<ModalSuratPeringatanProps> = ({
  isOpen,
  onClose,
  currentUser,
  onShowToast,
}) => {
  const [selectedKeplingId, setSelectedKeplingId] = useState<string>('');
  const [tingkatSp, setTingkatSp] = useState<'SP-1' | 'SP-2' | 'SP-3'>('SP-1');
  const [nomorSurat, setNomorSurat] = useState<string>('800 / _____ / KEL-MANGGA / XI / 2026');
  const [alasanTambahan, setAlasanTambahan] = useState<string>('');
  const [signerJabatan, setSignerJabatan] = useState<string>('Lurah Mangga');
  const [signerNama, setSignerNama] = useState<string>('Feriyanto Arapenta Tarigan, A.Md');
  const [signerNip, setSignerNip] = useState<string>('198502152010011012');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onShowToast) onShowToast(msg, type);
  };

  const apelList = useMemo(() => getLocalAbsensiApelList(), []);
  const poskoList = useMemo(() => getLocalJadwalPoskoList(), []);

  const keplingDisiplinList: KeplingDisiplinRecord[] = useMemo(() => {
    return KEPLING_ACCOUNTS.map((acc, index) => {
      const eff = getEffectiveProfile(acc);
      const nama = eff.nama || acc.nama;
      const noLing = acc.nomorLingkungan || index + 1;

      let apelTotal = apelList.length;
      let apelHadir = 0;
      let apelTerlambat = 0;
      let apelIzin = 0;
      let apelSakit = 0;
      let apelAlpa = 0;

      apelList.forEach((rec) => {
        const entry =
          rec.entries?.[acc.id] ||
          Object.values(rec.entries || {}).find(
            (e) =>
              e.nomorLingkungan === noLing ||
              e.namaKepling?.trim().toLowerCase() === nama.trim().toLowerCase()
          );
        const st = entry?.status || 'Hadir';
        if (st === 'Hadir') apelHadir += 1;
        else if (st === 'Terlambat') apelTerlambat += 1;
        else if (st === 'Izin') apelIzin += 1;
        else if (st === 'Sakit') apelSakit += 1;
        else if (st === 'Alpa') apelAlpa += 1;
      });

      const apelPct = apelTotal > 0 ? Math.round((apelHadir / apelTotal) * 100) : 100;

      let poskoTotal = 0;
      let poskoHadir = 0;
      let poskoTidakHadir = 0;

      poskoList.forEach((p) => {
        const pt = (p.petugasKepling || []).find(
          (x) =>
            x.keplingId === acc.id ||
            x.nomorLingkungan === noLing ||
            x.namaKepling?.trim().toLowerCase() === nama.trim().toLowerCase()
        );
        if (pt) {
          poskoTotal += 1;
          if (pt.statusKehadiran === 'Tidak Hadir') {
            poskoTidakHadir += 1;
          } else if (isKeplingPoskoDutyScored(p, pt)) {
            poskoHadir += 1;
          }
        }
      });

      const totalPelanggaran = apelAlpa * 3 + poskoTidakHadir * 2 + apelTerlambat;

      const alasanSp: string[] = [];
      if (apelAlpa > 0) {
        alasanSp.push(`Tidak hadir tanpa keterangan (Alpa) pada Apel Pagi sebanyak ${apelAlpa} kali`);
      }
      if (poskoTidakHadir > 0) {
        alasanSp.push(`Tidak hadir (mangkir) pada kegiatan posko/piket sebanyak ${poskoTidakHadir} kali`);
      }
      if (apelTerlambat >= 3) {
        alasanSp.push(`Sering terlambat mengikuti Apel Pagi sebanyak ${apelTerlambat} kali`);
      }

      let rekomendasiTingkat: 'SP-1' | 'SP-2' | 'SP-3' | 'TEGARAN_PEMBINAAN' = 'TEGARAN_PEMBINAAN';
      if (apelAlpa >= 3 || poskoTidakHadir >= 2 || totalPelanggaran >= 8) {
        rekomendasiTingkat = 'SP-3';
      } else if (apelAlpa === 2 || poskoTidakHadir === 1 || totalPelanggaran >= 5) {
        rekomendasiTingkat = 'SP-2';
      } else if (apelAlpa === 1 || apelTerlambat >= 3 || totalPelanggaran >= 2) {
        rekomendasiTingkat = 'SP-1';
      }

      return {
        keplingId: acc.id,
        nomorLingkungan: noLing,
        lingkungan: acc.lingkungan,
        namaKepling: nama,
        telepon: eff.telepon || acc.telepon || '',
        apelTotal,
        apelHadir,
        apelTerlambat,
        apelIzin,
        apelSakit,
        apelAlpa,
        apelPercentage: apelPct,
        poskoTotal,
        poskoHadir,
        poskoTidakHadir,
        totalPelanggaran,
        rekomendasiTingkat,
        alasanSp,
      };
    });
  }, [apelList, poskoList]);

  // Kepling yang bermasalah (ada pelanggaran)
  const keplingBermasalahList = useMemo(() => {
    return keplingDisiplinList
      .filter((k) => k.apelAlpa > 0 || k.poskoTidakHadir > 0 || k.apelTerlambat >= 2)
      .sort((a, b) => b.totalPelanggaran - a.totalPelanggaran);
  }, [keplingDisiplinList]);

  const selectedKeplingData = useMemo(() => {
    return keplingDisiplinList.find((k) => k.keplingId === selectedKeplingId) || null;
  }, [keplingDisiplinList, selectedKeplingId]);

  React.useEffect(() => {
    if (selectedKeplingData) {
      if (selectedKeplingData.rekomendasiTingkat !== 'TEGARAN_PEMBINAAN') {
        setTingkatSp(selectedKeplingData.rekomendasiTingkat as any);
      }
    }
  }, [selectedKeplingData]);

  if (!isOpen) return null;

  const handlePrintSp = () => {
    if (!selectedKeplingData) {
      notify('Pilih Kepala Lingkungan terlebih dahulu.', 'error');
      return;
    }
    printOfficialDocument('lembar-surat-peringatan-kepling', `Surat_Peringatan_${tingkatSp}_${selectedKeplingData.namaKepling}`);
  };

  const handleDownloadSpPdf = async () => {
    if (!selectedKeplingData) {
      notify('Pilih Kepala Lingkungan terlebih dahulu.', 'error');
      return;
    }
    setIsDownloadingPdf(true);
    try {
      await downloadPdfDocument(
        'lembar-surat-peringatan-kepling',
        `Surat_Peringatan_${tingkatSp}_Lingk_${selectedKeplingData.nomorLingkungan}.pdf`
      );
      notify('Surat Peringatan berhasil diunduh sebagai PDF!', 'success');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-900 via-slate-900 to-rose-950 text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-500/30 border border-rose-400/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black tracking-tight truncate">
                Rekomendasi &amp; Penerbitan Surat Peringatan (SP) Kedisiplinan Kepling
              </h3>
              <p className="text-[11px] text-rose-200 truncate">
                Evaluasi otomatis ketidakhadiran Apel Pagi &amp; Kegiatan Posko / Agenda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 bg-slate-50/60 flex-1">
          {/* Top Summary Banner */}
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Deteksi Otomatis Pelanggaran Kedisiplinan ({keplingBermasalahList.length} Kepling Memiliki Catatan Alpa/Mangkir)
              </span>
            </div>
            <p className="text-xs text-rose-800 leading-relaxed">
              Sistem secara otomatis memindai absensi Apel Pagi dan penugasan Posko. Kepala Lingkungan dengan catatan <strong>Alpa Apel Pagi</strong> atau <strong>Mangkir Posko</strong> diberikan rekomendasi tingkat Surat Peringatan (SP-1, SP-2, atau SP-3) sesuai tingkat kedisiplinan.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: List Kepling Bermasalah */}
            <div className="lg:col-span-5 space-y-3">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wide block">
                Pilih Kepala Lingkungan Sasaran Surat Peringatan:
              </label>

              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {keplingDisiplinList.map((k) => {
                  const isSelected = k.keplingId === selectedKeplingId;
                  const hasPelanggaran = k.apelAlpa > 0 || k.poskoTidakHadir > 0 || k.apelTerlambat >= 3;

                  return (
                    <div
                      key={k.keplingId}
                      onClick={() => setSelectedKeplingId(k.keplingId)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/30 shadow-xs'
                          : hasPelanggaran
                          ? 'bg-white border-amber-300 hover:bg-amber-50/50'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-black text-slate-900">
                            Lingk. {k.nomorLingkungan} — {k.namaKepling}
                          </div>
                          <div className="text-[10px] text-slate-600 mt-0.5">
                            Apel: {k.apelPercentage}% (Hadir {k.apelHadir}, Alpa <strong className="text-rose-700">{k.apelAlpa}</strong>) • Posko Mangkir: <strong className="text-rose-700">{k.poskoTidakHadir}</strong>
                          </div>
                        </div>

                        {k.rekomendasiTingkat !== 'TEGARAN_PEMBINAAN' ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                              k.rekomendasiTingkat === 'SP-3'
                                ? 'bg-rose-600 text-white'
                                : k.rekomendasiTingkat === 'SP-2'
                                ? 'bg-amber-600 text-white'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            Rekom {k.rekomendasiTingkat}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                            Disiplin Baik
                          </span>
                        )}
                      </div>

                      {k.alasanSp.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-rose-800 font-semibold space-y-0.5">
                          {k.alasanSp.map((al, idx) => (
                            <div key={idx} className="flex items-start gap-1">
                              <span>•</span>
                              <span>{al}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Preview Surat Peringatan Resmi */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wide block">
                  Pengaturan &amp; Pratinjau Surat Peringatan Resmi:
                </label>
                {selectedKeplingData && (
                  <div className="flex items-center gap-1.5">
                    {(['SP-1', 'SP-2', 'SP-3'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setTingkatSp(lvl)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer transition-colors ${
                          tingkatSp === lvl
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedKeplingData ? (
                <div className="space-y-3">
                  {/* Form config for SP */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Nomor Surat Peringatan
                      </label>
                      <input
                        type="text"
                        value={nomorSurat}
                        onChange={(e) => setNomorSurat(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-900 bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Tambahan Alasan / Catatan Pembinaan
                      </label>
                      <input
                        type="text"
                        value={alasanTambahan}
                        onChange={(e) => setAlasanTambahan(e.target.value)}
                        placeholder="cth. Peringatan keras untuk perbaikan kinerja bulan depan"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-900 bg-slate-50"
                      />
                    </div>
                  </div>

                  {/* Kertas A4 Preview SP */}
                  <div className="bg-slate-200 p-3 sm:p-5 rounded-2xl overflow-y-auto max-h-[440px] flex justify-center">
                    <div
                      id="lembar-surat-peringatan-kepling"
                      className="bg-white w-full max-w-[760px] p-6 sm:p-10 shadow-xl border border-slate-300 text-black space-y-4"
                      style={{
                        fontFamily: "'Times New Roman', Times, serif",
                        color: '#000000',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <KopSuratResmi />

                      <div style={{ textAlign: 'center', marginTop: '12px', marginBottom: '16px' }}>
                        <div
                          style={{
                            fontSize: '13.5pt',
                            fontWeight: 'bold',
                            textDecoration: 'underline',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          SURAT PERINGATAN {tingkatSp} ({tingkatSp === 'SP-1' ? 'PERTAMA' : tingkatSp === 'SP-2' ? 'KEDUA' : 'KETIGA'})
                        </div>
                        <div style={{ fontSize: '10pt', marginTop: '3px' }}>
                          Nomor : {nomorSurat.trim()}
                        </div>
                      </div>

                      <div style={{ fontSize: '11pt', lineHeight: '1.5', textAlign: 'justify' }}>
                        <p style={{ marginBottom: '10px' }}>
                          Lurah Kelurahan Mangga Kecamatan Medan Tuntungan dengan ini menerbitkan Surat Peringatan {tingkatSp} ({tingkatSp === 'SP-1' ? 'Pertama' : tingkatSp === 'SP-2' ? 'Kedua' : 'Ketiga'}) kepada:
                        </p>

                        <table style={{ width: '100%', marginBottom: '12px', fontSize: '11pt', marginLeft: '10px' }}>
                          <tbody>
                            <tr>
                              <td style={{ width: '140px', padding: '3px 0', verticalAlign: 'top', fontWeight: 'bold' }}>Nama Lengkap</td>
                              <td style={{ width: '15px', verticalAlign: 'top' }}>:</td>
                              <td style={{ padding: '3px 0', fontWeight: 'bold' }}>{selectedKeplingData.namaKepling}</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '3px 0', verticalAlign: 'top', fontWeight: 'bold' }}>Jabatan</td>
                              <td style={{ verticalAlign: 'top' }}>:</td>
                              <td style={{ padding: '3px 0' }}>Kepala Lingkungan {selectedKeplingData.lingkungan} Kelurahan Mangga</td>
                            </tr>
                            <tr>
                              <td style={{ padding: '3px 0', verticalAlign: 'top', fontWeight: 'bold' }}>Nomor Telepon</td>
                              <td style={{ verticalAlign: 'top' }}>:</td>
                              <td style={{ padding: '3px 0' }}>{selectedKeplingData.telepon || '-'}</td>
                            </tr>
                          </tbody>
                        </table>

                        <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                          LATAR BELAKANG / DASAR PELANGGARAN:
                        </p>
                        <p style={{ marginBottom: '10px' }}>
                          Berdasarkan rekapitulasi absensi elektronik dan pemantauan kinerja kedisiplinan Kelurahan Mangga, yang bersangkutan terbukti melakukan pelanggaran disiplin kerja berupa:
                        </p>
                        <ul style={{ marginLeft: '24px', marginBottom: '12px', listStyleType: 'disc' }}>
                          {selectedKeplingData.alasanSp.map((al, idx) => (
                            <li key={idx} style={{ marginBottom: '4px' }}>
                              {al}.
                            </li>
                          ))}
                          {selectedKeplingData.apelAlpa === 0 && selectedKeplingData.poskoTidakHadir === 0 && (
                            <li style={{ marginBottom: '4px' }}>
                              Kurangnya kedisiplinan dan kehadiran dalam apel pagi serta penugasan posko kelurahan.
                            </li>
                          )}
                          {alasanTambahan.trim() && (
                            <li style={{ marginBottom: '4px' }}>
                              {alasanTambahan.trim()}.
                            </li>
                          )}
                        </ul>

                        <p style={{ marginBottom: '10px' }}>
                          Tindakan tersebut di atas melanggar ketentuan kedisiplinan dan kewajiban Kepala Lingkungan dalam mendukung tugas-tugas pemerintahan, ketenteraman, dan pelayanan masyarakat di Kelurahan Mangga.
                        </p>

                        <p style={{ marginBottom: '16px', fontWeight: 'bold' }}>
                          DEMIKIAN PERINGATAN INI DISAMPAIKAN UNTUK DITAATI DAN DILAKSANAKAN DENGAN PENUH TANGGUNG JAWAB:
                        </p>
                        <ol style={{ marginLeft: '24px', marginBottom: '20px', listStyleType: 'decimal' }}>
                          <li style={{ marginBottom: '6px' }}>
                            Kepala Lingkungan agar segera memperbaiki kedisiplinan, wajib hadir tepat waktu pada setiap Apel Pagi, dan aktif melaksanakan tugas piket posko sesuai jadwal.
                          </li>
                          <li style={{ marginBottom: '6px' }}>
                            Apabila dalam jangka waktu 30 hari ke depan masih ditemukan pelanggaran serupa atau mangkir tanpa keterangan sah, maka akan diambil tindakan tegas berupa peningkatan sanksi hingga usulan pemberhentian sesuai peraturan yang berlaku.
                          </li>
                        </ol>
                      </div>

                      {/* Tanda Tangan */}
                      <div
                        className="avoid-break"
                        style={{
                          marginTop: '24px',
                          display: 'flex',
                          justifyContent: 'flex-end',
                          fontSize: '11pt',
                        }}
                      >
                        <div style={{ width: '270px', textAlign: 'center' }}>
                          <div>Medan, {formatTanggalSingkatIndonesia(new Date().toISOString().split('T')[0])}</div>
                          <div style={{ fontWeight: 'bold', marginTop: '2px' }}>
                            {signerJabatan || 'Lurah Mangga'}
                          </div>
                          <div style={{ height: '62px' }} />
                          <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                            {signerNama || 'Feriyanto Arapenta Tarigan, A.Md'}
                          </div>
                          {signerNip && <div style={{ fontSize: '10pt', marginTop: '1px' }}>NIP. {signerNip}</div>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Print & Download Toolbar */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleDownloadSpPdf}
                      disabled={isDownloadingPdf}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black text-xs cursor-pointer shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>{isDownloadingPdf ? 'Membuat PDF...' : 'Unduh Surat Peringatan (.pdf)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintSp}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs cursor-pointer shadow-sm"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Cetak / Print Surat Peringatan</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
                  <UserCheck className="w-12 h-12 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-black text-slate-800">
                    Belum Ada Kepala Lingkungan yang Dipilih
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Silakan klik salah satu nama Kepala Lingkungan di sebelah kiri untuk melihat rekam jejak kedisiplinan dan menerbitkan Surat Peringatan (SP-1 / SP-2 / SP-3).
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
