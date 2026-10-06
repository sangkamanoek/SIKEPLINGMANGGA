import React, { useState } from 'react';
import { LaporanMonitoringInfrastruktur } from '../types';
import { KopSuratResmi } from './KopSuratResmi';
import { printOfficialDocument } from '../utils/printHelper';
import { formatMonitoringForWhatsApp } from '../lib/monitoringInfrastrukturService';
import {
  Printer,
  X,
  MapPin,
  Calendar,
  User,
  FileText,
  ExternalLink,
  Tag,
  Building,
  CheckCircle2,
  Clock,
  Layers,
  Share2,
  Copy,
  Check,
} from 'lucide-react';
import { formatTanggalIndonesia } from '../lib/formatter';

interface CetakMonitoringInfrastrukturModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: LaporanMonitoringInfrastruktur | null;
}

export const CetakMonitoringInfrastrukturModal: React.FC<CetakMonitoringInfrastrukturModalProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !report) return null;

  const handlePrint = () => {
    const safeTitle = `Laporan_Monitoring_${report.nomorLaporan.replace(/[/\\?%*:|"<>]/g, '_')}_A4`;
    printOfficialDocument('lembar-cetak-monitoring-infra', safeTitle);
  };

  const handleShareWhatsApp = () => {
    const text = formatMonitoringForWhatsApp(report);
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopyTextOnly = () => {
    const text = formatMonitoringForWhatsApp(report);
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const parseDisplayDate = (dStr: string) => {
    try {
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) {
        return formatTanggalIndonesia(d);
      }
    } catch {
      // fallback
    }
    return dStr;
  };

  const isSudahDitangani = report.statusTindakLanjut === 'SELESAI_DIPERBAIKI';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl text-white">
        {/* Top Control Bar (Hidden during printing) */}
        <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                <span>Pratinjau Resmi Laporan Monitoring</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                  Format Kedinasan A4
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Dokumen resmi pemantauan fisik lapangan dengan 3 sudut pandang &amp; opsi bagikan ke WhatsApp.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer border border-emerald-400/30"
              title="Kirim Format Laporan Resmi ke WhatsApp"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Share2 className="w-4 h-4" />}
              <span>{copied ? 'Tersalin & Membuka WA' : 'Laporan WA'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer border border-blue-400/30"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak PDF (A4)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Container Body (A4 Styled Sheet) */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 bg-slate-200 flex justify-center">
          <div
            id="lembar-cetak-monitoring-infra"
            className="bg-white text-slate-900 w-full max-w-[210mm] p-6 sm:p-8 rounded-2xl shadow-xl space-y-4 print:p-4 print:m-0 print:shadow-none print:w-full print:rounded-none"
            style={{
              fontFamily: 'sans-serif',
              boxSizing: 'border-box',
            }}
          >
            {/* 1. Official Government Header */}
            <KopSuratResmi />

            {/* 2. Document Title */}
            <div className="text-center space-y-1 pb-1 border-b-2 border-black">
              <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-black">
                LAPORAN HASIL MONITORING INFRASTRUKTUR
              </h3>
              <p className="text-xs font-mono font-bold text-slate-800">
                NOMOR: {report.nomorLaporan}
              </p>
            </div>

            {/* 3. Parameter Table (Official 6 Required Points + Status) */}
            <div className="pt-2">
              <table className="w-full text-xs border-collapse border border-slate-900">
                <tbody>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 px-3 font-bold bg-slate-100 w-44 border-r border-slate-800">
                      1. Nomor Laporan
                    </td>
                    <td className="py-2 px-3 font-mono font-black text-slate-950 text-sm">
                      {report.nomorLaporan}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 px-3 font-bold bg-slate-100 border-r border-slate-800">
                      2. Subjek Laporan
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-950 text-sm text-blue-950">
                      {report.subjek}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 px-3 font-bold bg-slate-100 border-r border-slate-800">
                      3. Lokasi
                    </td>
                    <td className="py-2 px-3 text-slate-950">
                      <strong>{report.lokasi}</strong>
                      {report.lingkunganNomor && (
                        <span className="ml-2 text-slate-700">
                          (Wilayah Lingkungan {report.lingkunganNomor})
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 px-3 font-bold bg-slate-100 border-r border-slate-800">
                      4. Koordinat / Google Maps
                    </td>
                    <td className="py-2 px-3 text-slate-950 break-all font-mono text-[11px]">
                      {report.koordinatUrl ? (
                        <a
                          href={report.koordinatUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 underline font-semibold inline-flex items-center gap-1"
                        >
                          <span>{report.koordinatUrl}</span>
                          <ExternalLink className="w-3 h-3 inline print:hidden" />
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 px-3 font-bold bg-slate-100 border-r border-slate-800">
                      5. Tanggal Pelaporan
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-950">
                      {parseDisplayDate(report.tanggal)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 px-3 font-bold bg-slate-100 border-r border-slate-800">
                      6. Dari (Pelapor)
                    </td>
                    <td className="py-2 px-3 font-black text-slate-950 text-sm">
                      {report.pelapor}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 px-3 font-bold bg-slate-100 border-r border-slate-800">
                      Status Penanganan
                    </td>
                    <td className="py-2 px-3 font-bold">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-black ${
                        isSudahDitangani
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}>
                        {isSudahDitangani ? 'Sudah Ditangani' : 'Belum Ditangani'}
                      </span>
                    </td>
                  </tr>
                  {report.keterangan && (
                    <tr>
                      <td className="py-2 px-3 font-bold bg-slate-100 border-r border-slate-800 align-top">
                        Catatan &amp; Uraian Situasi
                      </td>
                      <td className="py-2 px-3 text-slate-800 leading-relaxed text-justify">
                        {report.keterangan}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 4. Photo Documentation (3 Angles) */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-700" />
                  <span>DOKUMENTASI FOTO LAPANGAN (3 SUDUT PANDANG / ANGLE BERBEDA)</span>
                </h4>
                <span className="text-[10px] font-bold text-slate-500">
                  Dokumentasi Lapangan Terverifikasi
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Angle 1 */}
                <div className="border border-slate-300 rounded-xl p-2 bg-slate-50 text-center space-y-1.5 flex flex-col justify-between">
                  <span className="text-[10px] font-black uppercase text-blue-900 block truncate">
                    {report.fotoAngle1Label || 'Angle 1: Tampak Depan'}
                  </span>
                  <div className="w-full h-36 bg-slate-200 rounded-lg overflow-hidden border border-slate-300 flex items-center justify-center">
                    {report.fotoAngle1Url ? (
                      <img
                        src={report.fotoAngle1Url}
                        alt="Foto Angle 1"
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400">Tidak ada foto</span>
                    )}
                  </div>
                </div>

                {/* Angle 2 */}
                <div className="border border-slate-300 rounded-xl p-2 bg-slate-50 text-center space-y-1.5 flex flex-col justify-between">
                  <span className="text-[10px] font-black uppercase text-blue-900 block truncate">
                    {report.fotoAngle2Label || 'Angle 2: Tampak Samping'}
                  </span>
                  <div className="w-full h-36 bg-slate-200 rounded-lg overflow-hidden border border-slate-300 flex items-center justify-center">
                    {report.fotoAngle2Url ? (
                      <img
                        src={report.fotoAngle2Url}
                        alt="Foto Angle 2"
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400">Tidak ada foto</span>
                    )}
                  </div>
                </div>

                {/* Angle 3 */}
                <div className="border border-slate-300 rounded-xl p-2 bg-slate-50 text-center space-y-1.5 flex flex-col justify-between">
                  <span className="text-[10px] font-black uppercase text-blue-900 block truncate">
                    {report.fotoAngle3Label || 'Angle 3: Tampak Luas / Perspektif'}
                  </span>
                  <div className="w-full h-36 bg-slate-200 rounded-lg overflow-hidden border border-slate-300 flex items-center justify-center">
                    {report.fotoAngle3Url ? (
                      <img
                        src={report.fotoAngle3Url}
                        alt="Foto Angle 3"
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400">Tidak ada foto</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Official Signature Block */}
            <div className="pt-6 grid grid-cols-2 text-xs font-sans text-slate-900 break-inside-avoid">
              <div className="text-center space-y-12">
                <p>
                  Mengetahui,<br />
                  <strong>Lurah Kelurahan Mangga</strong>
                </p>
                <div>
                  <p className="font-bold underline uppercase">Budi Anshari Lubis, S.STP, M.Si</p>
                  <p className="text-[10px] text-slate-600">NIP. 19850412 200412 1 001</p>
                </div>
              </div>

              <div className="text-center space-y-12">
                <p>
                  Medan, {parseDisplayDate(report.tanggal)}<br />
                  <strong>Petugas Monitoring Lapangan</strong>
                </p>
                <div>
                  <p className="font-bold underline uppercase">{report.pelapor}</p>
                  <p className="text-[10px] text-slate-600">Pelapor Monitoring Infrastruktur</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
