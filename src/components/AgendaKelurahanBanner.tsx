import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Bell, X, CheckCircle2, Info, ChevronRight, Check, Volume2 } from 'lucide-react';
import { UserAccount, AgendaKelurahanItem } from '../types';
import { getLocalAgendaList, subscribeAgendaFromFirestore } from '../lib/agendaService';

interface AgendaKelurahanBannerProps {
  activeAccount: UserAccount;
}

export const AgendaKelurahanBanner: React.FC<AgendaKelurahanBannerProps> = ({ activeAccount }) => {
  const [agendas, setAgendas] = useState<AgendaKelurahanItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [selectedDetailAgenda, setSelectedDetailAgenda] = useState<AgendaKelurahanItem | null>(null);

  useEffect(() => {
    const filterAgendas = (all: AgendaKelurahanItem[]) => {
      // Show active or upcoming agendas not canceled
      const relevant = all.filter((a) => a.statusSelesai !== 'BATAL');
      // Sort by date (nearest first)
      relevant.sort((a, b) => a.tanggalKegiatan.localeCompare(b.tanggalKegiatan));
      setAgendas(relevant);
    };

    filterAgendas(getLocalAgendaList());

    const unsub = subscribeAgendaFromFirestore((live) => {
      filterAgendas(live);
    });

    const handleUpdate = () => {
      filterAgendas(getLocalAgendaList());
    };
    window.addEventListener('agenda-data-updated', handleUpdate);

    return () => {
      unsub();
      window.removeEventListener('agenda-data-updated', handleUpdate);
    };
  }, []);

  if (agendas.length === 0) return null;

  const currentAgenda = agendas[currentIndex] || agendas[0];
  if (!currentAgenda || dismissedIds.includes(currentAgenda.id)) return null;

  const isFinished = currentAgenda.statusSelesai === 'SELESAI';

  return (
    <>
      <div className="bg-gradient-to-r from-teal-900 via-emerald-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-teal-500/40 relative overflow-hidden animate-fade-in">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-40 h-40 bg-teal-500/10 rounded-full blur-xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <Calendar className="w-6 h-6" />
            </div>
            
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-teal-500 text-slate-950 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                  Agenda Resmi Kelurahan
                </span>
                <span className="text-xs font-bold text-teal-200 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-teal-400" /> {currentAgenda.tanggalKegiatan} {currentAgenda.jamKegiatan ? `• ${currentAgenda.jamKegiatan}` : ''}
                </span>
                {isFinished && (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    ✓ Selesai Terlaksana
                  </span>
                )}
              </div>

              <h4 className="font-black text-sm sm:text-base text-white tracking-tight truncate">
                {currentAgenda.namaKegiatan}
              </h4>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-0.5">
                <span className="flex items-center gap-1 truncate max-w-xs">
                  <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" /> {currentAgenda.lokasi}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-teal-300 font-bold truncate max-w-xs">
                  PJ: {currentAgenda.penanggungJawab || currentAgenda.createdByName || 'Kelurahan Mangga'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center shrink-0 flex-wrap">
            {agendas.length > 1 && (
              <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-xl text-white">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev - 1 + agendas.length) % agendas.length)}
                  className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded-lg font-black flex items-center justify-center text-xs cursor-pointer"
                >
                  ‹
                </button>
                <span className="text-xs font-black px-1 font-mono">
                  {currentIndex + 1} / {agendas.length}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % agendas.length)}
                  className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded-lg font-black flex items-center justify-center text-xs cursor-pointer"
                >
                  ›
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedDetailAgenda(currentAgenda)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Baca Detail Agenda</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-notif-sound-modal'))}
              title="Pengaturan Bunyi & Getar HP"
              className="px-3 py-2 bg-teal-950/80 hover:bg-teal-900 border border-teal-500/40 text-teal-200 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Volume2 className="w-4 h-4 text-teal-300" />
              <span className="hidden sm:inline">Bunyi &amp; Getar HP</span>
            </button>

            <button
              type="button"
              onClick={() => setDismissedIds((prev) => [...prev, currentAgenda.id])}
              className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Tutup Banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Read-Only Modal Detail Agenda for Kepling / PKK */}
      {selectedDetailAgenda && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full">
                  Informasi Resmi Agenda Kelurahan (Read-Only)
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1.5 leading-snug">
                  {selectedDetailAgenda.namaKegiatan}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailAgenda(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Tanggal & Waktu</span>
                  <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    {selectedDetailAgenda.tanggalKegiatan} {selectedDetailAgenda.jamKegiatan ? `• ${selectedDetailAgenda.jamKegiatan}` : ''}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Status Pelaksanaan</span>
                  <span className={`font-extrabold px-2 py-0.5 rounded-md inline-block ${
                    selectedDetailAgenda.statusSelesai === 'SELESAI'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedDetailAgenda.statusSelesai === 'PROSES'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedDetailAgenda.statusSelesai === 'SELESAI' ? 'Selesai 100%' : selectedDetailAgenda.statusSelesai === 'PROSES' ? 'Sedang Berlangsung' : 'Belum Selesai'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Lokasi Pelaksanaan</span>
                <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  {selectedDetailAgenda.lokasi}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Peserta / Sasaran</span>
                <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  {selectedDetailAgenda.peserta}
                </span>
              </div>

              {selectedDetailAgenda.catatan && (
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-950 space-y-1">
                  <span className="font-bold text-[10px] text-amber-800 uppercase block">Catatan / Keterangan Tambahan:</span>
                  <p className="font-medium whitespace-pre-wrap leading-relaxed">{selectedDetailAgenda.catatan}</p>
                </div>
              )}

              <div className="p-3 bg-teal-50/70 rounded-2xl border border-teal-200 text-teal-900 text-[11px] flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Agenda ini bersifat informatif. Kepala Lingkungan / PKK dapat membaca dan mempersiapkan diri sesuai jadwal.</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedDetailAgenda(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black shadow-md cursor-pointer hover:bg-slate-800 transition-colors"
              >
                Tutup Informasi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
