import React, { useEffect, useState } from 'react';
import { fetchAllReports } from '../lib/reportsApi';
import { LaporanHarianItem } from '../types';

export default function ViewImagesPage({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<LaporanHarianItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        <div className="p-6 bg-[#0B5C37] text-white">
          <h1 className="text-xl md:text-2xl font-bold mb-2">Dokumentasi Laporan</h1>
          <div className="text-emerald-100 space-y-1 text-sm md:text-base">
            <p><span className="font-semibold">Nama:</span> {report.namaKepling}</p>
            <p><span className="font-semibold">Tanggal:</span> {report.hari}, {report.tanggal}</p>
          </div>
        </div>
        
        <div className="p-6 md:p-8">
          {!hasImages ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-gray-500 font-medium">Laporan ini tidak memiliki lampiran foto dokumentasi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {report.dokumentasiFoto?.map((foto, index) => (
                <div key={foto.id || index} className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                  <div className="aspect-square bg-gray-200 relative">
                    <img 
                      src={foto.url} 
                      alt={foto.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-gray-800 break-words">{foto.name || `Foto ${index + 1}`}</p>
                    {foto.kategori && (
                      <span className="inline-block mt-2 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
                        {foto.kategori.toUpperCase()}
                      </span>
                    )}
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
