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
  UserCheck,
  ShieldAlert,
  Briefcase,
} from 'lucide-react';
import { AppTabType } from './MobileBottomNav';
import { UserAccount, isPkkRole } from '../types';

interface TopNavigationBarProps {
  activeTab: AppTabType;
  onNavigate: (tab: AppTabType) => void;
  isAdmin?: boolean;
  activeAccount?: UserAccount;
  unreadCounts?: Record<string, number>;
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
  unreadCounts,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPkk = activeAccount ? isPkkRole(activeAccount.role) : false;
  const isKepling = activeAccount?.role === 'kepling';

  // Dedicated PKK Navigation Menu Items (Exclusively TP-PKK Structure, Clean of Kelurahan Menus)
  const pkkMenuItems: MenuItemConfig[] = [
    { id: 'hub', label: 'Pusat Menu PKK', icon: Compass },
    { id: 'kegiatan_pkk', label: 'Kegiatan PKK', icon: FileText, badge: 'POKJA', badgeVariant: 'mint' },
    { id: 'keuangan_pkk', label: 'Keuangan PKK', icon: Wallet, badge: 'BKU', badgeVariant: 'mint' },
    { id: 'dasa_wisma', label: 'Dasa Wisma', icon: Users, badge: '24 LINGK.', badgeVariant: 'mint' },
    { id: 'posyandu_pkk', label: 'Laporan Posyandu', icon: Baby, badge: 'POKJA IV', badgeVariant: 'rose' },
    { id: 'buku_pkk', label: '6 Buku Wajib PKK', icon: BookOpen, badge: 'BUKU I-VI', badgeVariant: 'mint' },
  ];

  // Dedicated Superadmin Navigation Menu Items (Access to All Kelurahan & PKK Features)
  const superAdminMenuItems: MenuItemConfig[] = [
    { id: 'hub', label: 'Pusat Eksekutif', icon: Compass },
    { id: 'monitoring', label: 'Monitoring Laporan', icon: ShieldCheck, badge: 'MONITORING', badgeVariant: 'mint' },
    { id: 'realisasi_pembangunan', label: 'Realisasi Pembangunan', icon: Wrench, badge: 'SARPRAS', badgeVariant: 'rose' },
    { id: 'agenda', label: 'Agenda Kelurahan', icon: Calendar, badge: 'AGENDA', badgeVariant: 'mint' },
    { id: 'jadwal_posko', label: 'Jadwal Posko', icon: ShieldAlert, badge: '21.00 WIB', badgeVariant: 'rose' },
    { id: 'kegiatan_lurah', label: 'Kegiatan Lurah', icon: Briefcase, badge: 'LURAH', badgeVariant: 'mint' },
    { id: 'absensi_kepling', label: 'Absensi Kepling', icon: UserCheck, badge: 'PDF', badgeVariant: 'mint' },
    { id: 'capaian_admin', label: 'Capaian Target', icon: Trophy, badge: 'TARGET', badgeVariant: 'mint' },
    { id: 'rekap_pbb', label: 'Realisasi PBB', icon: FileSpreadsheet, badge: '2026', badgeVariant: 'default' },
    { id: 'surat_kedinasan', label: 'Surat Kedinasan', icon: Mail, badge: 'SURAT', badgeVariant: 'mint' },
    { id: 'kegiatan_pkk', label: 'Kegiatan PKK', icon: FileText, badge: 'PKK', badgeVariant: 'mint' },
    { id: 'keuangan_pkk', label: 'Keuangan PKK', icon: Wallet, badge: 'BKU PKK', badgeVariant: 'mint' },
    { id: 'dasa_wisma', label: 'Dasa Wisma', icon: Users, badge: 'DAWIS', badgeVariant: 'mint' },
    { id: 'posyandu_pkk', label: 'Laporan Posyandu', icon: Baby, badge: 'POSYANDU', badgeVariant: 'rose' },
    { id: 'buku_pkk', label: '6 Buku Wajib PKK', icon: BookOpen, badge: 'BUKU PKK', badgeVariant: 'mint' },
    { id: 'kunjungan', label: 'Kunjungan Warga', icon: Users },
    { id: 'riwayat', label: 'Arsip Riwayat', icon: History },
  ];

  // Dedicated Kepling Navigation Menu Items (Excludes Monitoring)
  const keplingMenuItems: MenuItemConfig[] = [
    { id: 'hub', label: 'Pusat Menu', icon: Compass },
    { id: 'realisasi_pembangunan', label: 'Realisasi Pembangunan', icon: Wrench, badge: 'SARPRAS', badgeVariant: 'rose' },
    { id: 'agenda', label: 'Agenda Kelurahan', icon: Calendar, badge: 'AGENDA', badgeVariant: 'mint' },
    { id: 'jadwal_posko', label: 'Jadwal Posko', icon: ShieldAlert, badge: '21.00 WIB', badgeVariant: 'rose' },
    { id: 'capaian', label: 'Capaian Target', icon: Trophy },
    { id: 'rekap_pbb', label: 'Realisasi PBB', icon: FileSpreadsheet, badge: '2026', badgeVariant: 'default' },
    { id: 'form', label: 'Input Laporan', icon: FileText },
    { id: 'kunjungan', label: 'Kunjungan Warga', icon: Users },
    { id: 'riwayat', label: 'Arsip Riwayat', icon: History },
  ];

  // Dedicated Kasi Tata Pemerintahan Navigation Menu Items (PBB-P2, IKD, Arsip Pemerintahan)
  const kasiPemMenuItems: MenuItemConfig[] = [
    { id: 'hub', label: 'Pusat Menu', icon: Compass },
    { id: 'dashboard_kasi', label: 'Dashboard Pemerintahan', icon: Award, badge: 'PBB & IKD', badgeVariant: 'mint' },
    { id: 'rekap_pbb', label: 'Realisasi PBB', icon: FileSpreadsheet, badge: '2026', badgeVariant: 'default' },
    { id: 'riwayat', label: 'Arsip Pemerintahan', icon: History },
  ];

  // Dedicated Kasi Pembangunan & Kesos Navigation Menu Items (Perlinsos, Posyandu, Sarpras, Kunjungan Warga)
  const kasiBangMenuItems: MenuItemConfig[] = [
    { id: 'hub', label: 'Pusat Menu', icon: Compass },
    { id: 'dashboard_kasi', label: 'Dashboard Kesos', icon: Award, badge: 'PERLINSOS', badgeVariant: 'mint' },
    { id: 'realisasi_pembangunan', label: 'Realisasi Pembangunan', icon: Wrench, badge: 'SARPRAS', badgeVariant: 'rose' },
    { id: 'kunjungan', label: 'Kunjungan Warga', icon: Users },
    { id: 'riwayat', label: 'Arsip Pembangunan', icon: History },
  ];

  // Dedicated Kasi Trantibum & Linmas Navigation Menu Items (7 Bidang Trantibum, Jadwal Posko, Arsip Trantibum)
  const kasiTrantibMenuItems: MenuItemConfig[] = [
    { id: 'hub', label: 'Pusat Menu', icon: Compass },
    { id: 'dashboard_kasi', label: 'Dashboard Trantibum', icon: Award, badge: '7 BIDANG', badgeVariant: 'rose' },
    { id: 'jadwal_posko', label: 'Jadwal Posko', icon: ShieldAlert, badge: 'POSKO MALAM', badgeVariant: 'rose' },
    { id: 'riwayat', label: 'Arsip Trantibum', icon: History },
  ];

  // Dedicated Petugas Bapenda Navigation Menu Items (Read-Only PBB)
  const bapendaMenuItems: MenuItemConfig[] = [
    { id: 'hub', label: 'Pusat Menu', icon: Compass },
    { id: 'rekap_pbb', label: 'Realisasi PBB', icon: FileSpreadsheet, badge: '2026', badgeVariant: 'default' },
  ];

  // Sekretaris Kelurahan (Seklur) Navigation Menu Items (Excludes Kegiatan Lurah & Input Laporan Kepling)
  const seklurMenuItems: MenuItemConfig[] = [
    { id: 'hub', label: 'Pusat Menu', icon: Compass },
    { id: 'monitoring', label: 'Monitoring Laporan', icon: ShieldCheck, badge: 'MONITORING', badgeVariant: 'mint' },
    { id: 'realisasi_pembangunan', label: 'Realisasi Pembangunan', icon: Wrench, badge: 'SARPRAS', badgeVariant: 'rose' },
    { id: 'agenda', label: 'Agenda Kelurahan', icon: Calendar, badge: 'AGENDA', badgeVariant: 'mint' },
    { id: 'jadwal_posko', label: 'Jadwal Posko', icon: ShieldAlert, badge: 'POSKO MALAM', badgeVariant: 'rose' },
    { id: 'absensi_kepling', label: 'Absensi Kepling', icon: UserCheck, badge: 'PDF', badgeVariant: 'mint' },
    { id: 'capaian_admin', label: 'Capaian Target', icon: Trophy },
    { id: 'rekap_pbb', label: 'Realisasi PBB', icon: FileSpreadsheet, badge: '2026', badgeVariant: 'default' },
    { id: 'surat_kedinasan', label: 'Surat Kedinasan', icon: Mail, badge: 'SURAT', badgeVariant: 'mint' },
    { id: 'kunjungan', label: 'Kunjungan Warga', icon: Users },
    { id: 'riwayat', label: 'Arsip Riwayat', icon: History },
  ];

  const role = activeAccount?.role;
  const menuItems =
    role === 'super_admin'
      ? superAdminMenuItems
      : isPkk
      ? pkkMenuItems
      : isKepling
      ? keplingMenuItems
      : role === 'kasi_pemerintahan'
      ? kasiPemMenuItems
      : role === 'kasi_pembangunan'
      ? kasiBangMenuItems
      : role === 'kasi_trantibum'
      ? kasiTrantibMenuItems
      : role === 'petugas_bapenda'
      ? bapendaMenuItems
      : role === 'sekretaris'
      ? seklurMenuItems
      : keplingMenuItems;

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
      <div className="max-w-7xl mx-auto px-2 sm:px-4 flex items-center relative py-1.5 min-w-0">
        {/* Scroll Left Button (Desktop & Tablet) */}
        <button
          type="button"
          onClick={() => scroll('left')}
          aria-label="Geser navigasi ke kiri"
          className="hidden sm:flex items-center justify-center w-7 h-7 rounded-xl shrink-0 transition-colors cursor-pointer mr-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrollable Navigation List */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 no-scrollbar scroll-smooth px-0.5"
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (!isPkk && item.id === 'capaian' && (activeTab === 'capaian_admin' || activeTab === 'capaian'));

            // Clean, professional styling
            const activeClass = isPkk
              ? 'bg-pkk-teal text-white border-pkk-teal shadow-sm font-bold'
              : 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs';

            const inactiveClass = 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200 shadow-2xs';

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`group flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-[13px] font-bold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer border ${
                  isActive ? activeClass : inactiveClass
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-colors ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 group-hover:text-slate-700'
                  }`}
                />
                <span className="tracking-tight">{item.label}</span>

                {(() => {
                  const unread = unreadCounts?.[item.id] || 0;
                  if (unread > 0) {
                    return (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-600 text-white shadow-xs animate-pulse">
                        {unread > 99 ? '99+' : unread} Baru
                      </span>
                    );
                  }
                  if (item.badge) {
                    return (
                      <span
                        className={`hidden sm:inline-flex text-[9px] font-black px-1.5 py-0.5 rounded-lg transition-colors border ${
                          isActive
                            ? 'bg-white/20 text-white border-white/20'
                            : item.badgeVariant === 'rose'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 group-hover:bg-rose-100'
                            : item.badgeVariant === 'mint'
                            ? 'bg-teal-50 text-teal-700 border-teal-200 group-hover:bg-teal-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 group-hover:bg-slate-200'
                        }`}
                      >
                        {item.badge}
                      </span>
                    );
                  }
                  return null;
                })()}
              </button>
            );
          })}
        </div>

        {/* Scroll Right Button (Desktop & Tablet) */}
        <button
          type="button"
          onClick={() => scroll('right')}
          aria-label="Geser navigasi ke kanan"
          className="hidden sm:flex items-center justify-center w-7 h-7 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl shrink-0 transition-colors cursor-pointer ml-1.5"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>

  );
};
