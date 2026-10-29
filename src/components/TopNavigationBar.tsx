import React, { useRef } from 'react';
import {
  Compass,
  ShieldCheck,
  Trophy,
  FileSpreadsheet,
  FileText,
  Users,
  History,
  Wrench,
  Building2,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Baby,
  BookOpen,
  Mail,
  Award,
  Calendar,
} from 'lucide-react';
import { AppTabType } from './MobileBottomNav';
import { UserAccount, isPkkRole } from '../types';

interface TopNavigationBarProps {
  activeTab: AppTabType;
  onNavigate: (tab: AppTabType) => void;
  isAdmin?: boolean;
  activeAccount?: UserAccount;
}

interface MenuItemConfig {
  id: AppTabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: 'mint' | 'rose' | 'default';
}

export const TopNavigationBar: React.FC<TopNavigationBarProps> = ({
  activeTab,
  onNavigate,
  isAdmin,
  activeAccount,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPkk = activeAccount ? isPkkRole(activeAccount.role) : false;
  const isKepling = activeAccount?.role === 'kepling';

  // Dedicated PKK Navigation Menu Items (Matching Official TP-PKK Structure)
  const pkkMenuItems: MenuItemConfig[] = [
    { id: 'hub', label: 'Pusat Menu PKK', icon: Compass },
    { id: 'kegiatan_pkk', label: 'Kegiatan PKK', icon: FileText, badge: 'POKJA', badgeVariant: 'mint' },
    { id: 'keuangan_pkk', label: 'Keuangan PKK', icon: Wallet, badge: 'BKU', badgeVariant: 'mint' },
    { id: 'dasa_wisma', label: 'Dasa Wisma', icon: Users, badge: '24 LINGK.', badgeVariant: 'mint' },
    { id: 'posyandu_pkk', label: 'Laporan Posyandu', icon: Baby, badge: 'POKJA IV', badgeVariant: 'rose' },
    { id: 'buku_pkk', label: '6 Buku Wajib PKK', icon: BookOpen, badge: 'BUKU I-VI', badgeVariant: 'mint' },
    { id: 'surat_kedinasan', label: 'Surat Kedinasan', icon: Mail, badge: 'SURAT', badgeVariant: 'mint' },
    { id: 'daftar_tugas_khusus', label: 'Daftar Tugas Khusus', icon: Award, badge: 'TUGAS', badgeVariant: 'mint' },
  ];

  // Standard Kelurahan & Kepling Navigation Menu Items
  const standardMenuItems: MenuItemConfig[] = [
    { id: 'hub', label: 'Pusat Menu', icon: Compass },
    { id: 'agenda', label: 'Agenda Kelurahan', icon: Calendar, badge: 'AGENDA', badgeVariant: 'mint' },
    ...(!isKepling ? [{ id: 'monitoring' as AppTabType, label: 'Monitoring', icon: ShieldCheck }] : []),
    { id: 'capaian', label: 'Capaian Target', icon: Trophy },
    { id: 'rekap_pbb', label: 'Realisasi PBB', icon: FileSpreadsheet, badge: '2026', badgeVariant: 'default' as const },
    { id: 'form', label: 'Input Laporan', icon: FileText },
    { id: 'kunjungan', label: 'Kunjungan Warga', icon: Users },
    ...(!isKepling ? [{ id: 'surat_kedinasan' as AppTabType, label: 'Surat Kedinasan', icon: FileText }] : []),
    { id: 'database_keluarga', label: 'Data Keluarga', icon: Building2 },
    { id: 'riwayat', label: 'Arsip Riwayat', icon: History },
    { id: 'realisasi_pembangunan', label: 'Monitoring & Realisasi Pembangunan Wilayah', icon: Wrench },
  ];


  const menuItems = isPkk ? pkkMenuItems : standardMenuItems;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const amount = direction === 'left' ? -260 : 260;
      scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  return (
    <nav
      aria-label={isPkk ? 'Navigasi Utama TP-PKK' : 'Navigasi Utama Aplikasi'}
      className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs print:hidden sticky top-0 z-30"
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4 flex items-center relative py-1.5">
        {/* Scroll Left Button */}
        <button
          type="button"
          onClick={() => scroll('left')}
          aria-label="Geser navigasi ke kiri"
          className="flex items-center justify-center w-7 h-7 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl shrink-0 transition-colors cursor-pointer mr-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrollable Navigation List */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex items-center gap-2 overflow-x-auto py-1 no-scrollbar scroll-smooth"
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (!isPkk && item.id === 'capaian' && (activeTab === 'capaian_admin' || activeTab === 'capaian'));

            // Styling tailored to match official design
            const activeClass = isPkk
              ? 'bg-[#246658] text-white border-[#1b4d42] shadow-sm font-bold'
              : 'bg-emerald-50/90 text-emerald-950 border-emerald-300 font-bold shadow-2xs';

            const inactiveClass =
              'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border-slate-200/90 shadow-2xs';

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`group flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-[13px] font-bold whitespace-nowrap transition-all duration-150 cursor-pointer border ${
                  isActive ? activeClass : inactiveClass
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive
                      ? isPkk ? 'text-white' : 'text-emerald-700'
                      : isPkk ? 'text-[#246658]' : 'text-slate-500 group-hover:text-slate-700'
                  }`}
                />
                <span className="tracking-tight">{item.label}</span>

                {item.badge && (
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg transition-colors border ${
                      isActive
                        ? 'bg-white/20 text-white border-white/20'
                        : item.badgeVariant === 'rose'
                        ? 'bg-rose-50 text-rose-800 border-rose-200/70 group-hover:bg-rose-100'
                        : item.badgeVariant === 'mint'
                        ? 'bg-teal-50 text-teal-800 border-teal-200/70 group-hover:bg-teal-100'
                        : 'bg-slate-100 text-slate-600 border-slate-200 group-hover:bg-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        <button
          type="button"
          onClick={() => scroll('right')}
          aria-label="Geser navigasi ke kanan"
          className="flex items-center justify-center w-7 h-7 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl shrink-0 transition-colors cursor-pointer ml-1.5"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
};
