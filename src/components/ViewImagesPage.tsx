import React, { useEffect, useState } from 'react';
import { fetchAllReports } from '../lib/reportsApi';
import { LaporanHarianItem } from '../types';
import { Download, ArrowLeft } from 'lucide-react';

export default function ViewImagesPage({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<LaporanHarianItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    const cleanName = filename.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/)
      ? filename
      : `${filename}.jpg`;
    link.download = cleanName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    if (!report?.dokumentasiFoto || report.dokumentasiFoto.length === 0) return;
    setIsDownloadingAll(true);
    report.dokumentasiFoto.forEach((foto, idx) => {
      setTimeout(() => {
        const safeName = `${report.lingkungan || 'Kepling'}_${report.tanggal}_foto_${idx + 1}.jpg`;
        handleDownload(foto.url, foto.name || safeName);
        if (idx === (report.dokumentasiFoto?.length || 1) - 1) {
          setTimeout(() => setIsDownloadingAll(false), 1000);
        }
      }, idx * 400);
    });
  };

  useEffect(() => {
    const loadReport = async () => {
      try {
        const allReports = await fetchAllReports();
        const found = allReports.find(r => r.id === reportId);
        if (found) {
          setReport(found);
        } else {
          setError('Laporan tidak ditemukan.');
        }
      } catch (err) {
        setError('Gagal memuat data laporan.');
      } finally {
        setLoading(false);
      }
    };
    loadReport();
  }, [reportId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-600 font-medium">Memuat gambar...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl max-w-md w-full text-center">
          <p className="font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  const hasImages = report.dokumentasiFoto && report.dokumentasiFoto.length > 0;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 bg-[#0B5C37] text-white flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold mb-1">Dokumentasi Laporan</h1>
            <div className="text-emerald-100 space-y-0.5 text-xs md:text-sm">
              <p><span className="font-semibold">Nama:</span> {report.namaKepling} ({report.jabatan})</p>
              <p><span className="font-semibold">Tanggal:</span> {report.hari}, {report.tanggal}</p>
            </div>
          </div>
          {hasImages && (
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={isDownloadingAll}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-emerald-900 font-bold text-xs rounded-xl hover:bg-emerald-50 transition-colors shadow-md cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>{isDownloadingAll ? 'Mengunduh...' : `Unduh Semua Foto (${report.dokumentasiFoto?.length})`}</span>
            </button>
          )}
        </div>
        
        <div className="p-6 md:p-8">
          {!hasImages ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-gray-500 font-medium">Laporan ini tidak memiliki lampiran foto dokumentasi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {report.dokumentasiFoto?.map((foto, index) => (
                <div key={foto.id || index} className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200 shadow-sm flex flex-col justify-between">
                  <div className="aspect-square bg-gray-200 relative group overflow-hidden">
                    <img 
                      src={foto.url} 
                      alt={foto.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                      <button
                        type="button"
                        onClick={() => handleDownload(foto.url, foto.name || `Foto_${index + 1}.jpg`)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-lg transition-transform hover:scale-105 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Unduh File Foto</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between gap-3 bg-white">
                    <div>
                      <p className="font-semibold text-gray-800 break-words text-sm">{foto.name || `Foto ${index + 1}`}</p>
                      {foto.kategori && (
                        <span className="inline-block mt-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                          {String(foto.kategori).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(foto.url, foto.name || `Foto_${index + 1}.jpg`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-slate-200 shrink-0"
                      title="Download gambar ini"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
