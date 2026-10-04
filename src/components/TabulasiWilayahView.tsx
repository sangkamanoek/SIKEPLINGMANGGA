import React, { useState, useMemo } from 'react';
import {
  Users,
  Home,
  CheckCircle2,
  AlertTriangle,
  HeartHandshake,
  Droplets,
  Compass,
  Search,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  ChevronRight,
  Eye,
  Sliders,
  Shield,
  Activity,
  Baby,
  Building2,
  ExternalLink,
  DollarSign,
  Sparkles,
  Trash2,
  CheckSquare,
  Square,
  RefreshCw,
  AlertCircle,
  MapPin,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  TitikRumahBangunan,
  RuasJalanLingkungan,
  UserAccount,
  LingkunganPolygon,
} from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';

interface TabulasiWilayahViewProps {
  houses: TitikRumahBangunan[];
  roads: RuasJalanLingkungan[];
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSelectHouseForMap?: (house: TitikRumahBangunan) => void;
  onSwitchToMap?: () => void;
  onOpenDatabaseKeluarga?: () => void;
  onDeleteHouse?: (houseId: string, houseName?: string) => void;
  onDeleteBulkHouses?: (houseIds: string[]) => void;
  onClearAllHouses?: () => void;
  onDeleteHousesByLingkungan?: (lingkunganId: string) => void;
}

export const TabulasiWilayahView: React.FC<TabulasiWilayahViewProps> = ({
  houses,
  roads,
  currentUser,
  onShowToast,
  onSelectHouseForMap,
  onSwitchToMap,
  onOpenDatabaseKeluarga,
  onDeleteHouse,
  onDeleteBulkHouses,
  onClearAllHouses,
  onDeleteHousesByLingkungan,
}) => {
  const isKepling = currentUser.role === 'kepling';
  const isAdmin = currentUser.role === 'super_admin' || currentUser.role.startsWith('kasi_');

  // Tabulation View Level: KELURAHAN | LINGKUNGAN | JALAN | TITIK_BANGUNAN
  const [tabLevel, setTabLevel] = useState<'KELURAHAN' | 'LINGKUNGAN' | 'JALAN' | 'TITIK_BANGUNAN'>('KELURAHAN');

  // Filters
  const [filterLingkungan, setFilterLingkungan] = useState<string>(
    isKepling ? currentUser.id : 'all'
  );
  const [filterDesil, setFilterDesil] = useState<string>('all');
  const [filterBansos, setFilterBansos] = useState<string>('all');
  const [filterSanitasi, setFilterSanitasi] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Checkbox selection for bulk deleting misplaced houses
  const [selectedHouseIds, setSelectedHouseIds] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState<boolean>(false);

  // Selected Street for Drill-Down Modal
  const [selectedStreetDetail, setSelectedStreetDetail] = useState<{
    namaJalan: string;
    lingkunganNomor: number;
    lingkunganId: string;
    houses: TitikRumahBangunan[];
    roadMeta?: RuasJalanLingkungan;
  } | null>(null);

  // Selected Lingkungan for Drill-Down
  const [selectedLingkunganDetail, setSelectedLingkunganDetail] = useState<number | null>(null);

  // Filtered Houses based on active filters
  const filteredHouses = useMemo(() => {
    return houses.filter((h) => {
      // Lingkungan filter
      if (filterLingkungan !== 'all' && h.lingkunganId !== filterLingkungan) {
        return false;
      }

      // Desil Kesejahteraan filter
      if (filterDesil !== 'all') {
        const desil = h.desilKesejahteraan || h.desilBansos || '';
        if (filterDesil === 'DESIL_1_2') {
          if (!desil.includes('Desil 1') && !desil.includes('Desil 2')) return false;
        } else if (filterDesil === 'DESIL_3_5') {
          if (!desil.includes('Desil 3') && !desil.includes('Desil 4') && !desil.includes('Desil 5')) return false;
        } else if (filterDesil === 'DESIL_6_10') {
          if (!desil.includes('Desil 6') && !desil.includes('Mampu') && !desil.includes('Non-Desil')) return false;
        } else if (filterDesil === 'RENTAN_MISKIN') {
          if (!desil.includes('Desil 1') && !desil.includes('Desil 2') && !desil.includes('Desil 3') && !desil.includes('Desil 4') && !desil.includes('Desil 5')) return false;
        } else if (desil !== filterDesil) {
          return false;
        }
      }

      // Bansos filter
      if (filterBansos !== 'all') {
        if (filterBansos === 'PKH_MEDAN_MAKMUR') {
          if (!h.jenisBansos?.includes('PKH Medan Makmur')) return false;
        } else if (filterBansos === 'PKH_NASIONAL') {
          if (!h.jenisBansos?.includes('PKH Nasional')) return false;
        } else if (filterBansos === 'BPNT') {
          if (!h.jenisBansos?.some((b) => b.toLowerCase().includes('bpnt') || b.toLowerCase().includes('sembako'))) return false;
        } else if (filterBansos === 'BLT') {
          if (!h.jenisBansos?.some((b) => b.toLowerCase().includes('blt') || b.toLowerCase().includes('dbh'))) return false;
        } else if (filterBansos === 'PBI_JK') {
          if (!h.jenisBansos?.some((b) => b.toLowerCase().includes('pbi') || b.toLowerCase().includes('bpjs gratis'))) return false;
        } else if (filterBansos === 'RTLH') {
          if (!h.jenisBansos?.some((b) => b.toLowerCase().includes('bedah rumah') || b.toLowerCase().includes('rtlh'))) return false;
        } else if (filterBansos === 'PENERIMA_ANY') {
          if (!h.penerimaBansos && (!h.jenisBansos || h.jenisBansos.length === 0)) return false;
        } else if (filterBansos === 'NON_BANSOS') {
          if (h.penerimaBansos || (h.jenisBansos && h.jenisBansos.length > 0)) return false;
        }
      }

      // Sanitasi filter
      if (filterSanitasi !== 'all') {
        if (filterSanitasi === 'JAMBAN_SENDIRI') {
          if (!h.jambanKeluarga?.includes('Sendiri')) return false;
        } else if (filterSanitasi === 'JAMBAN_KOMUNAL') {
          if (!h.jambanKeluarga?.includes('Bersama') && !h.jambanKeluarga?.includes('Komunal')) return false;
        } else if (filterSanitasi === 'JAMBAN_CEMPLUNG') {
          if (!h.jambanKeluarga?.includes('Cemplung')) return false;
        } else if (filterSanitasi === 'BABS') {
          if (!h.jambanKeluarga?.includes('Tidak Memiliki') && !h.jambanKeluarga?.includes('BABS')) return false;
        } else if (filterSanitasi === 'AIR_PDAM') {
          if (!h.sumberAirMinum?.includes('PDAM') && !h.sumberAirBersih?.includes('PDAM')) return false;
        } else if (filterSanitasi === 'AIR_DEPOT_KEMASAN') {
          if (!h.sumberAirMinum?.includes('Depot') && !h.sumberAirMinum?.includes('Kemasan')) return false;
        } else if (filterSanitasi === 'AIR_SUMUR') {
          if (!h.sumberAirMinum?.includes('Sumur') && !h.sumberAirBersih?.includes('Sumur')) return false;
        } else if (filterSanitasi === 'STUNTING_RESTI') {
          if (!h.statusStuntingRentan?.includes('Stunting') && !h.statusStuntingRentan?.includes('KEK') && !h.statusStuntingRentan?.includes('Resti')) return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchKk = h.namaKepalaKeluarga?.toLowerCase().includes(q);
        const matchJalan = h.namaJalan?.toLowerCase().includes(q);
        const matchNik = h.nikKk?.toLowerCase().includes(q);
        const matchNop = h.nopPbb?.toLowerCase().includes(q);
        const matchNoRumah = h.nomorRumah?.toLowerCase().includes(q);
        const matchUsaha = h.namaUsaha?.toLowerCase().includes(q);
        if (!matchKk && !matchJalan && !matchNik && !matchNop && !matchNoRumah && !matchUsaha) {
          return false;
        }
      }

      return true;
    });
  }, [houses, filterLingkungan, filterDesil, filterBansos, filterSanitasi, searchQuery]);

  // Aggregate Macro Statistics for Kelurahan
  const kelurahanMacroStats = useMemo(() => {
    const list = filteredHouses;
    const totalKk = list.length;
    const totalJiwa = list.reduce((acc, h) => acc + (Number(h.jumlahJiwa) || 0), 0);
    const totalLaki = list.reduce((acc, h) => acc + (Number(h.jumlahLakiLaki) || 0), 0);
    const totalPerempuan = list.reduce((acc, h) => acc + (Number(h.jumlahPerempuan) || 0), 0);
    const totalLansia = list.reduce((acc, h) => acc + (Number(h.jumlahLansia) || 0), 0);
    const totalAnak = list.reduce((acc, h) => acc + (Number(h.jumlahAnak) || 0), 0);
    const kkMangga = list.filter((h) => h.isKkMangga !== false).length;
    const kkLuar = list.filter((h) => h.isKkMangga === false).length;

    // Desil breakdown
    const desil1 = list.filter((h) => (h.desilKesejahteraan || h.desilBansos || '').includes('Desil 1')).length;
    const desil2 = list.filter((h) => (h.desilKesejahteraan || h.desilBansos || '').includes('Desil 2')).length;
    const desil3 = list.filter((h) => (h.desilKesejahteraan || h.desilBansos || '').includes('Desil 3')).length;
    const desil4 = list.filter((h) => (h.desilKesejahteraan || h.desilBansos || '').includes('Desil 4')).length;
    const desil5 = list.filter((h) => (h.desilKesejahteraan || h.desilBansos || '').includes('Desil 5')).length;
    const desil6Plus = list.filter((h) => {
      const d = h.desilKesejahteraan || h.desilBansos || '';
      return d.includes('Desil 6') || d.includes('Mampu') || d.includes('Non-Desil') || (!d && !h.penerimaBansos);
    }).length;
    const totalDesil1_5 = desil1 + desil2 + desil3 + desil4 + desil5;

    // Bansos Breakdown
    const pkhMedanMakmur = list.filter((h) => h.jenisBansos?.includes('PKH Medan Makmur')).length;
    const pkhNasional = list.filter((h) => h.jenisBansos?.includes('PKH Nasional')).length;
    const bpntSembako = list.filter((h) => h.jenisBansos?.some((b) => b.toLowerCase().includes('bpnt') || b.toLowerCase().includes('sembako'))).length;
    const bltDbh = list.filter((h) => h.jenisBansos?.some((b) => b.toLowerCase().includes('blt') || b.toLowerCase().includes('dbh'))).length;
    const pbiJk = list.filter((h) => h.jenisBansos?.some((b) => b.toLowerCase().includes('pbi') || b.toLowerCase().includes('bpjs gratis'))).length;
    const rtlh = list.filter((h) => h.jenisBansos?.some((b) => b.toLowerCase().includes('bedah rumah') || b.toLowerCase().includes('rtlh'))).length;
    const pipBeasiswa = list.filter((h) => h.jenisBansos?.some((b) => b.toLowerCase().includes('pip') || b.toLowerCase().includes('beasiswa'))).length;
    const bansosLainnya = list.filter((h) => h.jenisBansos?.some((b) => b.toLowerCase().includes('lainnya'))).length;
    const totalPenerimaBansos = list.filter((h) => h.penerimaBansos || (h.jenisBansos && h.jenisBansos.length > 0)).length;

    // Sanitasi & Air
    const jambanSendiri = list.filter((h) => !h.jambanKeluarga || h.jambanKeluarga.includes('Sendiri')).length;
    const jambanKomunal = list.filter((h) => h.jambanKeluarga?.includes('Bersama') || h.jambanKeluarga?.includes('Komunal')).length;
    const jambanCemplung = list.filter((h) => h.jambanKeluarga?.includes('Cemplung')).length;
    const jambanBabs = list.filter((h) => h.jambanKeluarga?.includes('Tidak Memiliki') || h.jambanKeluarga?.includes('BABS')).length;

    const airMinumPdam = list.filter((h) => h.sumberAirMinum?.includes('PDAM')).length;
    const airMinumDepot = list.filter((h) => h.sumberAirMinum?.includes('Depot')).length;
    const airMinumKemasan = list.filter((h) => h.sumberAirMinum?.includes('Kemasan')).length;
    const airMinumSumurBor = list.filter((h) => h.sumberAirMinum?.includes('Sumur Bor')).length;
    const airMinumSumurGali = list.filter((h) => h.sumberAirMinum?.includes('Sumur Gali')).length;
    const airMinumLainnya = list.filter((h) => h.sumberAirMinum?.includes('Mata Air') || h.sumberAirMinum?.includes('Hujan') || h.sumberAirMinum?.includes('Lainnya')).length;

    const airBersihPdam = list.filter((h) => !h.sumberAirBersih || h.sumberAirBersih.includes('PDAM')).length;
    const airBersihSumurBor = list.filter((h) => h.sumberAirBersih?.includes('Sumur Bor')).length;
    const airBersihSumurGali = list.filter((h) => h.sumberAirBersih?.includes('Sumur Gali')).length;
    const airBersihLainnya = list.filter((h) => h.sumberAirBersih?.includes('Sungai') || h.sumberAirBersih?.includes('Lainnya')).length;

    const sampahPetugasWrs = list.filter((h) => !h.pembuanganSampahRumah || h.pembuanganSampahRumah.includes('Petugas') || h.pembuanganSampahRumah.includes('WRS')).length;
    const sampahDaurUlang = list.filter((h) => h.pembuanganSampahRumah?.includes('Bank Sampah')).length;
    const sampahBakarMandiri = list.filter((h) => h.pembuanganSampahRumah?.includes('Dibakar') || h.pembuanganSampahRumah?.includes('Ditimbun')).length;
    const sampahSembarangan = list.filter((h) => h.pembuanganSampahRumah?.includes('Sembarangan')).length;

    const tinjaSeptik = list.filter((h) => !h.tempatAkhirTinja || h.tempatAkhirTinja.includes('Septik') || h.tempatAkhirTinja.includes('SPALD')).length;
    const tinjaParit = list.filter((h) => h.tempatAkhirTinja?.includes('Parit') || h.tempatAkhirTinja?.includes('Saluran')).length;
    const tinjaTanah = list.filter((h) => h.tempatAkhirTinja?.includes('Lubang') || h.tempatAkhirTinja?.includes('Lainnya')).length;

    const stuntingResti = list.filter((h) => h.statusStuntingRentan?.includes('Stunting')).length;
    const bumilKekResti = list.filter((h) => h.statusStuntingRentan?.includes('KEK') || h.statusStuntingRentan?.includes('Resti')).length;
    const bebasStunting = list.filter((h) => !h.statusStuntingRentan || h.statusStuntingRentan.includes('Bebas')).length;

    // PBB & WRS
    const pbbLunas = list.filter((h) => h.statusPbb === 'LUNAS').length;
    const pbbBelum = list.filter((h) => h.statusPbb === 'BELUM_LUNAS').length;
    const pbbNominalLunas = list.reduce((acc, h) => acc + (h.statusPbb === 'LUNAS' ? Number(h.nominalPbb) || 0 : 0), 0);
    const pbbNominalTotal = list.reduce((acc, h) => acc + (Number(h.nominalPbb) || 0), 0);

    const wrsAktif = list.filter((h) => h.statusWrs === 'AKTIF').length;
    const wrsBelum = list.filter((h) => h.statusWrs === 'BELUM_MENOLAK').length;
    const wrsMandiri = list.filter((h) => h.statusWrs === 'MANDIRI').length;
    const wrsBebas = list.filter((h) => h.statusWrs === 'BEBAS_WRS').length;

    return {
      totalKk,
      totalJiwa,
      totalLaki,
      totalPerempuan,
      totalLansia,
      totalAnak,
      kkMangga,
      kkLuar,
      // Desil
      desil1,
      desil2,
      desil3,
      desil4,
      desil5,
      desil6Plus,
      totalDesil1_5,
      // Bansos
      pkhMedanMakmur,
      pkhNasional,
      bpntSembako,
      bltDbh,
      pbiJk,
      rtlh,
      pipBeasiswa,
      bansosLainnya,
      totalPenerimaBansos,
      // Sanitasi
      jambanSendiri,
      jambanKomunal,
      jambanCemplung,
      jambanBabs,
      airMinumPdam,
      airMinumDepot,
      airMinumKemasan,
      airMinumSumurBor,
      airMinumSumurGali,
      airMinumLainnya,
      airBersihPdam,
      airBersihSumurBor,
      airBersihSumurGali,
      airBersihLainnya,
      sampahPetugasWrs,
      sampahDaurUlang,
      sampahBakarMandiri,
      sampahSembarangan,
      tinjaSeptik,
      tinjaParit,
      tinjaTanah,
      stuntingResti,
      bumilKekResti,
      bebasStunting,
      // PBB & WRS
      pbbLunas,
      pbbBelum,
      pbbNominalLunas,
      pbbNominalTotal,
      wrsAktif,
      wrsBelum,
      wrsMandiri,
      wrsBebas,
    };
  }, [filteredHouses]);

  // Aggregate Statistics per 24 Lingkungan
  const lingkunganRows = useMemo(() => {
    return KEPLING_ACCOUNTS.map((acc) => {
      const lingNomor = acc.nomorLingkungan || 1;
      const lingHouses = houses.filter((h) => h.lingkunganId === acc.id || h.lingkunganNomor === lingNomor);

      const totalKk = lingHouses.length;
      const totalJiwa = lingHouses.reduce((a, b) => a + (Number(b.jumlahJiwa) || 0), 0);
      const totalLaki = lingHouses.reduce((a, b) => a + (Number(b.jumlahLakiLaki) || 0), 0);
      const totalPerempuan = lingHouses.reduce((a, b) => a + (Number(b.jumlahPerempuan) || 0), 0);
      const totalLansia = lingHouses.reduce((a, b) => a + (Number(b.jumlahLansia) || 0), 0);
      const totalAnak = lingHouses.reduce((a, b) => a + (Number(b.jumlahAnak) || 0), 0);

      // Desil
      const desil1_2 = lingHouses.filter((h) => {
        const d = h.desilKesejahteraan || h.desilBansos || '';
        return d.includes('Desil 1') || d.includes('Desil 2');
      }).length;
      const desil3_5 = lingHouses.filter((h) => {
        const d = h.desilKesejahteraan || h.desilBansos || '';
        return d.includes('Desil 3') || d.includes('Desil 4') || d.includes('Desil 5');
      }).length;
      const desil6_10 = lingHouses.filter((h) => {
        const d = h.desilKesejahteraan || h.desilBansos || '';
        return d.includes('Desil 6') || d.includes('Mampu') || d.includes('Non-Desil') || (!d && !h.penerimaBansos);
      }).length;

      // Bansos
      const pkhMedanMakmur = lingHouses.filter((h) => h.jenisBansos?.includes('PKH Medan Makmur')).length;
      const pkhNasional = lingHouses.filter((h) => h.jenisBansos?.includes('PKH Nasional')).length;
      const bpnt = lingHouses.filter((h) => h.jenisBansos?.some((b) => b.toLowerCase().includes('bpnt') || b.toLowerCase().includes('sembako'))).length;
      const blt = lingHouses.filter((h) => h.jenisBansos?.some((b) => b.toLowerCase().includes('blt') || b.toLowerCase().includes('dbh'))).length;
      const pbiJk = lingHouses.filter((h) => h.jenisBansos?.some((b) => b.toLowerCase().includes('pbi') || b.toLowerCase().includes('bpjs gratis'))).length;
      const totalBansos = lingHouses.filter((h) => h.penerimaBansos || (h.jenisBansos && h.jenisBansos.length > 0)).length;

      // Sanitasi
      const jambanSendiri = lingHouses.filter((h) => !h.jambanKeluarga || h.jambanKeluarga.includes('Sendiri')).length;
      const jambanBabs = lingHouses.filter((h) => h.jambanKeluarga?.includes('Tidak Memiliki') || h.jambanKeluarga?.includes('BABS')).length;
      const airPdamLayak = lingHouses.filter((h) => h.sumberAirMinum?.includes('PDAM') || h.sumberAirMinum?.includes('Depot') || h.sumberAirMinum?.includes('Kemasan')).length;
      const stuntingRisiko = lingHouses.filter((h) => h.statusStuntingRentan?.includes('Stunting') || h.statusStuntingRentan?.includes('KEK') || h.statusStuntingRentan?.includes('Resti')).length;

      // PBB & WRS
      const pbbLunas = lingHouses.filter((h) => h.statusPbb === 'LUNAS').length;
      const pbbNominalLunas = lingHouses.reduce((a, b) => a + (b.statusPbb === 'LUNAS' ? Number(b.nominalPbb) || 0 : 0), 0);
      const wrsAktif = lingHouses.filter((h) => h.statusWrs === 'AKTIF').length;

      // Jalan
      const lingRoads = roads.filter((r) => r.lingkunganId === acc.id || r.lingkunganNomor === lingNomor);
      const totalRuasJalan = lingRoads.length;
      const jalanRusak = lingRoads.filter((r) => r.kondisiJalan === 'RUSAK_SEDANG' || r.kondisiJalan === 'RUSAK_BERAT').length;

      return {
        account: acc,
        lingkunganNomor: lingNomor,
        lingkunganNama: acc.lingkungan,
        keplingNama: acc.nama,
        keplingTelepon: acc.telepon || '-',
        totalKk,
        totalJiwa,
        totalLaki,
        totalPerempuan,
        totalLansia,
        totalAnak,
        desil1_2,
        desil3_5,
        desil6_10,
        pkhMedanMakmur,
        pkhNasional,
        bpnt,
        blt,
        pbiJk,
        totalBansos,
        jambanSendiri,
        jambanBabs,
        jambanSendiriPersen: totalKk > 0 ? Math.round((jambanSendiri / totalKk) * 100) : 0,
        airPdamLayak,
        airPdamLayakPersen: totalKk > 0 ? Math.round((airPdamLayak / totalKk) * 100) : 0,
        stuntingRisiko,
        pbbLunas,
        pbbLunasPersen: totalKk > 0 ? Math.round((pbbLunas / totalKk) * 100) : 0,
        pbbNominalLunas,
        wrsAktif,
        wrsAktifPersen: totalKk > 0 ? Math.round((wrsAktif / totalKk) * 100) : 0,
        totalRuasJalan,
        jalanRusak,
        rawHouses: lingHouses,
      };
    });
  }, [houses, roads]);

  // Aggregate Statistics per Jalan / Gang
  const streetRows = useMemo(() => {
    const streetMap = new Map<string, {
      namaJalan: string;
      lingkunganNomor: number;
      lingkunganId: string;
      houses: TitikRumahBangunan[];
      roadMeta?: RuasJalanLingkungan;
    }>();

    // 1. Ingest all houses grouped by cleaned Street name + Lingkungan
    houses.forEach((h) => {
      const rawStreet = (h.namaJalan || 'Jl. Belum Dinamai').trim();
      const lNum = h.lingkunganNomor || Number(h.lingkunganId.replace(/\D/g, '')) || 1;
      const key = `${rawStreet.toLowerCase()}__lk_${lNum}`;

      if (!streetMap.has(key)) {
        streetMap.set(key, {
          namaJalan: rawStreet,
          lingkunganNomor: lNum,
          lingkunganId: h.lingkunganId,
          houses: [],
        });
      }
      streetMap.get(key)!.houses.push(h);
    });

    // 2. Attach road metadata if matched
    roads.forEach((r) => {
      const rawStreet = (r.namaJalan || 'Jl. Belum Dinamai').trim();
      const lNum = r.lingkunganNomor || Number(r.lingkunganId.replace(/\D/g, '')) || 1;
      const key = `${rawStreet.toLowerCase()}__lk_${lNum}`;

      if (!streetMap.has(key)) {
        streetMap.set(key, {
          namaJalan: rawStreet,
          lingkunganNomor: lNum,
          lingkunganId: r.lingkunganId,
          houses: [],
          roadMeta: r,
        });
      } else {
        const item = streetMap.get(key)!;
        if (!item.roadMeta) {
          item.roadMeta = r;
        }
      }
    });

    // Convert map to processed array with metrics
    const result = Array.from(streetMap.values()).map((item) => {
      const list = item.houses;
      const totalRumah = list.length;
      const totalJiwa = list.reduce((a, b) => a + (Number(b.jumlahJiwa) || 0), 0);
      const totalLaki = list.reduce((a, b) => a + (Number(b.jumlahLakiLaki) || 0), 0);
      const totalPerempuan = list.reduce((a, b) => a + (Number(b.jumlahPerempuan) || 0), 0);

      // Desil
      const desil1_2 = list.filter((h) => {
        const d = h.desilKesejahteraan || h.desilBansos || '';
        return d.includes('Desil 1') || d.includes('Desil 2');
      }).length;
      const desil3_5 = list.filter((h) => {
        const d = h.desilKesejahteraan || h.desilBansos || '';
        return d.includes('Desil 3') || d.includes('Desil 4') || d.includes('Desil 5');
      }).length;
      const desil6_10 = list.filter((h) => {
        const d = h.desilKesejahteraan || h.desilBansos || '';
        return d.includes('Desil 6') || d.includes('Mampu') || d.includes('Non-Desil') || (!d && !h.penerimaBansos);
      }).length;

      // Bansos
      const pkhMedanMakmur = list.filter((h) => h.jenisBansos?.includes('PKH Medan Makmur')).length;
      const pkhNasional = list.filter((h) => h.jenisBansos?.includes('PKH Nasional')).length;
      const bpnt = list.filter((h) => h.jenisBansos?.some((b) => b.toLowerCase().includes('bpnt') || b.toLowerCase().includes('sembako'))).length;
      const blt = list.filter((h) => h.jenisBansos?.some((b) => b.toLowerCase().includes('blt') || b.toLowerCase().includes('dbh'))).length;
      const pbiJk = list.filter((h) => h.jenisBansos?.some((b) => b.toLowerCase().includes('pbi') || b.toLowerCase().includes('bpjs gratis'))).length;
      const totalBansos = list.filter((h) => h.penerimaBansos || (h.jenisBansos && h.jenisBansos.length > 0)).length;

      // Sanitasi
      const jambanSendiri = list.filter((h) => !h.jambanKeluarga || h.jambanKeluarga.includes('Sendiri')).length;
      const jambanBabs = list.filter((h) => h.jambanKeluarga?.includes('Tidak Memiliki') || h.jambanKeluarga?.includes('BABS')).length;
      const airPdam = list.filter((h) => h.sumberAirMinum?.includes('PDAM')).length;
      const airDepot = list.filter((h) => h.sumberAirMinum?.includes('Depot')).length;
      const airSumur = list.filter((h) => h.sumberAirMinum?.includes('Sumur')).length;
      const stuntingRisiko = list.filter((h) => h.statusStuntingRentan?.includes('Stunting') || h.statusStuntingRentan?.includes('KEK') || h.statusStuntingRentan?.includes('Resti')).length;

      // Determine Primary Drinking Water
      let primaryWater = 'PDAM Tirtanadi';
      if (airDepot > airPdam && airDepot > airSumur) primaryWater = 'Depot Isi Ulang';
      else if (airSumur > airPdam && airSumur > airDepot) primaryWater = 'Sumur Bor/Gali';

      // PBB & WRS
      const pbbLunas = list.filter((h) => h.statusPbb === 'LUNAS').length;
      const wrsAktif = list.filter((h) => h.statusWrs === 'AKTIF').length;

      return {
        ...item,
        totalRumah,
        totalJiwa,
        totalLaki,
        totalPerempuan,
        desil1_2,
        desil3_5,
        desil6_10,
        pkhMedanMakmur,
        pkhNasional,
        bpnt,
        blt,
        pbiJk,
        totalBansos,
        jambanSendiri,
        jambanBabs,
        jambanSendiriPersen: totalRumah > 0 ? Math.round((jambanSendiri / totalRumah) * 100) : 0,
        primaryWater,
        stuntingRisiko,
        pbbLunas,
        pbbLunasPersen: totalRumah > 0 ? Math.round((pbbLunas / totalRumah) * 100) : 0,
        wrsAktif,
        wrsAktifPersen: totalRumah > 0 ? Math.round((wrsAktif / totalRumah) * 100) : 0,
      };
    });

    // Sort by Lingkungan then by Street Name
    return result.sort((a, b) => {
      if (a.lingkunganNomor !== b.lingkunganNomor) {
        return a.lingkunganNomor - b.lingkunganNomor;
      }
      return a.namaJalan.localeCompare(b.namaJalan);
    });
  }, [houses, roads]);

  // Filtered street rows based on active toolbar filter
  const filteredStreetRows = useMemo(() => {
    return streetRows.filter((r) => {
      if (filterLingkungan !== 'all' && r.lingkunganId !== filterLingkungan) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = r.namaJalan.toLowerCase().includes(q);
        const matchKepling = KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === r.lingkunganNomor)?.nama.toLowerCase().includes(q);
        if (!matchName && !matchKepling) return false;
      }
      return true;
    });
  }, [streetRows, filterLingkungan, searchQuery]);

  // Export Full Tabulation Matrix to Multi-Sheet Excel
  const handleExportFullExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Rekapitulasi Kelurahan Mangga
      const s1Data = [
        ['REKAPITULASI DATA PROFIL SOSIAL EKONOMI, KESEJAHTERAAN & SANITASI KELURAHAN MANGGA'],
        ['KECAMATAN MEDAN TUNTUNGAN - KOTA MEDAN'],
        [`Tanggal Unduh: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`],
        [],
        ['INDIKATOR UTAMA', 'JUMLAH / METRIK', 'SATUAN', 'PERSENTASE (%) / KETERANGAN'],
        ['Total Kepala Keluarga (KK)', kelurahanMacroStats.totalKk, 'KK', '100%'],
        ['KK Domisili Asli Mangga', kelurahanMacroStats.kkMangga, 'KK', `${Math.round((kelurahanMacroStats.kkMangga / (kelurahanMacroStats.totalKk || 1)) * 100)}%`],
        ['KK Luar Mangga (Non-Domisili)', kelurahanMacroStats.kkLuar, 'KK', `${Math.round((kelurahanMacroStats.kkLuar / (kelurahanMacroStats.totalKk || 1)) * 100)}%`],
        ['Total Populasi Jiwa', kelurahanMacroStats.totalJiwa, 'Jiwa', '-'],
        ['Penduduk Laki-laki', kelurahanMacroStats.totalLaki, 'Jiwa', `${Math.round((kelurahanMacroStats.totalLaki / (kelurahanMacroStats.totalJiwa || 1)) * 100)}%`],
        ['Penduduk Perempuan', kelurahanMacroStats.totalPerempuan, 'Jiwa', `${Math.round((kelurahanMacroStats.totalPerempuan / (kelurahanMacroStats.totalJiwa || 1)) * 100)}%`],
        ['Kelompok Rentan Lansia (>60 Thn)', kelurahanMacroStats.totalLansia, 'Jiwa', '-'],
        ['Kelompok Anak & Balita (0-17 Thn)', kelurahanMacroStats.totalAnak, 'Jiwa', '-'],
        [],
        ['TINGKAT KESEJAHTERAAN KELUARGA (DESIL)', '', '', ''],
        ['Desil 1', kelurahanMacroStats.desil1, 'KK', `${Math.round((kelurahanMacroStats.desil1 / (kelurahanMacroStats.totalKk || 1)) * 100)}% - Prioritas Utama PKH`],
        ['Desil 2', kelurahanMacroStats.desil2, 'KK', `${Math.round((kelurahanMacroStats.desil2 / (kelurahanMacroStats.totalKk || 1)) * 100)}% - Bantuan Pangan BPNT`],
        ['Desil 3', kelurahanMacroStats.desil3, 'KK', `${Math.round((kelurahanMacroStats.desil3 / (kelurahanMacroStats.totalKk || 1)) * 100)}% - PBI-JK & Bantuan Modal`],
        ['Desil 4', kelurahanMacroStats.desil4, 'KK', `${Math.round((kelurahanMacroStats.desil4 / (kelurahanMacroStats.totalKk || 1)) * 100)}% - BLT & Pelatihan Kerja`],
        ['Desil 5', kelurahanMacroStats.desil5, 'KK', `${Math.round((kelurahanMacroStats.desil5 / (kelurahanMacroStats.totalKk || 1)) * 100)}% - Fasilitasi UMKM`],
        ['Desil 6-10', kelurahanMacroStats.desil6Plus, 'KK', `${Math.round((kelurahanMacroStats.desil6Plus / (kelurahanMacroStats.totalKk || 1)) * 100)}% - Mandiri`],
        [],
        ['PROGRAM BANTUAN SOSIAL TERDATA', '', '', ''],
        ['PKH Medan Makmur (Pemko Medan)', kelurahanMacroStats.pkhMedanMakmur, 'KK', 'Bantuan Unggulan Pemko Medan'],
        ['PKH Nasional (Kemensos)', kelurahanMacroStats.pkhNasional, 'KK', 'Program Keluarga Harapan'],
        ['BPNT / Sembako', kelurahanMacroStats.bpntSembako, 'KK', 'Bantuan Pangan Non Tunai'],
        ['BLT / DBH / Bansos Tunai', kelurahanMacroStats.bltDbh, 'KK', 'Bantuan Langsung Tunai'],
        ['PBI-JK (BPJS Kesehatan Gratis)', kelurahanMacroStats.pbiJk, 'KK', 'Jaminan Kesehatan Penerima Bantuan Iuran'],
        ['Bedah Rumah / RTLH (Disperkim)', kelurahanMacroStats.rtlh, 'KK', 'Perbaikan Rumah Tidak Layak Huni'],
        ['PIP / Beasiswa Pendidikan', kelurahanMacroStats.pipBeasiswa, 'KK', 'Program Indonesia Pintar'],
        [],
        ['SANITASI & KESEHATAN KELUARGA', '', '', ''],
        ['Jamban Sendiri (Leher Angsa/Septik SNI)', kelurahanMacroStats.jambanSendiri, 'KK', `${Math.round((kelurahanMacroStats.jambanSendiri / (kelurahanMacroStats.totalKk || 1)) * 100)}% (Aman & Layak)`],
        ['Jamban Bersama / Komunal', kelurahanMacroStats.jambanKomunal, 'KK', '-'],
        ['Jamban Cemplung / Plengsengan', kelurahanMacroStats.jambanCemplung, 'KK', 'Perlu Intervensi Jamban Sehat'],
        ['Tidak Memiliki Jamban (BABS)', kelurahanMacroStats.jambanBabs, 'KK', 'Target Bebas ODF'],
        ['Sumber Air Minum: PDAM / Perpipaan', kelurahanMacroStats.airMinumPdam, 'KK', '-'],
        ['Sumber Air Minum: Depot Isi Ulang / Kemasan', kelurahanMacroStats.airMinumDepot + kelurahanMacroStats.airMinumKemasan, 'KK', '-'],
        ['Sumber Air Minum: Sumur Bor / Gali', kelurahanMacroStats.airMinumSumurBor + kelurahanMacroStats.airMinumSumurGali, 'KK', '-'],
        ['Tangki Septik / SPALD Terstandar', kelurahanMacroStats.tinjaSeptik, 'KK', '-'],
        ['Risiko Stunting / Balita Rentan', kelurahanMacroStats.stuntingResti, 'KK', 'Pendampingan Posyandu / Puskesmas'],
        [],
        ['PAJAK & RETRIBUSI KEBERSIHAN', '', '', ''],
        ['PBB Lunas', kelurahanMacroStats.pbbLunas, 'KK', `${Math.round((kelurahanMacroStats.pbbLunas / (kelurahanMacroStats.totalKk || 1)) * 100)}%`],
        ['PBB Belum Lunas', kelurahanMacroStats.pbbBelum, 'KK', '-'],
        ['WRS (Wajib Retribusi Sampah) Aktif', kelurahanMacroStats.wrsAktif, 'Bangunan', `${Math.round((kelurahanMacroStats.wrsAktif / (kelurahanMacroStats.totalKk || 1)) * 100)}% Kepatuhan`],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(s1Data);
      XLSX.utils.book_append_sheet(wb, ws1, 'Rekap_Kelurahan');

      // Sheet 2: Tabulasi Per 24 Lingkungan
      const s2Data = [
        ['TABULASI INDIKATOR KESEJAHTERAAN, BANSOS & SANITASI PER 24 LINGKUNGAN KELURAHAN MANGGA'],
        [],
        [
          'No',
          'Lingkungan',
          'Kepala Lingkungan',
          'Kontak HP',
          'Total KK',
          'Total Jiwa',
          'Laki-laki',
          'Perempuan',
          'Lansia',
          'Anak',
          'Desil 1-2 (Sangat Miskin)',
          'Desil 3-5 (Rentan)',
          'Desil 6-10 (Mampu)',
          'PKH Medan Makmur',
          'PKH Nasional',
          'BPNT Sembako',
          'BLT/DBH',
          'BPJS PBI-JK',
          'Total Penerima Bansos',
          'Jamban Sendiri',
          'BABS (Tanpa Jamban)',
          '% Jamban Sendiri',
          'Air PDAM/Layak',
          '% Air Minum Layak',
          'Risiko Stunting',
          'PBB Lunas (KK)',
          '% PBB Lunas',
          'WRS Aktif (Bangunan)',
          '% WRS Aktif',
          'Total Ruas Jalan',
          'Jalan Rusak',
        ],
        ...lingkunganRows.map((r) => [
          r.lingkunganNomor,
          r.lingkunganNama,
          r.keplingNama,
          r.keplingTelepon,
          r.totalKk,
          r.totalJiwa,
          r.totalLaki,
          r.totalPerempuan,
          r.totalLansia,
          r.totalAnak,
          r.desil1_2,
          r.desil3_5,
          r.desil6_10,
          r.pkhMedanMakmur,
          r.pkhNasional,
          r.bpnt,
          r.blt,
          r.pbiJk,
          r.totalBansos,
          r.jambanSendiri,
          r.jambanBabs,
          `${r.jambanSendiriPersen}%`,
          r.airPdamLayak,
          `${r.airPdamLayakPersen}%`,
          r.stuntingRisiko,
          r.pbbLunas,
          `${r.pbbLunasPersen}%`,
          r.wrsAktif,
          `${r.wrsAktifPersen}%`,
          r.totalRuasJalan,
          r.jalanRusak,
        ]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(s2Data);
      XLSX.utils.book_append_sheet(wb, ws2, 'Tabulasi_Lingkungan');

      // Sheet 3: Tabulasi Per Ruas Jalan / Gang
      const s3Data = [
        ['TABULASI DATA MIKRO PER RUAS JALAN & GANG KELURAHAN MANGGA'],
        [],
        [
          'No',
          'Nama Jalan / Gang',
          'Lingkungan',
          'Jenis Jalan',
          'Kondisi Jalan',
          'Kondisi Drainase',
          'Jumlah Rumah / KK',
          'Total Jiwa',
          'Laki-laki',
          'Perempuan',
          'Desil 1-2 (Sangat Miskin)',
          'Desil 3-5 (Rentan/Menengah)',
          'Desil 6-10 (Mampu)',
          'PKH Medan Makmur',
          'PKH Nasional',
          'BPNT Sembako',
          'Total Bansos',
          'Jamban Sendiri',
          '% Jamban Sendiri',
          'Sumber Air Minum Utama',
          'Risiko Stunting',
          'PBB Lunas',
          '% PBB Lunas',
          'WRS Aktif',
          '% WRS Aktif',
        ],
        ...streetRows.map((s, idx) => [
          idx + 1,
          s.namaJalan,
          `Lingkungan ${s.lingkunganNomor}`,
          s.roadMeta?.jenisPerkerasan || 'Aspal / Campuran',
          s.roadMeta?.kondisiJalan === 'BAIK' ? 'Baik' : s.roadMeta?.kondisiJalan === 'RUSAK_BERAT' ? 'Rusak Berat' : s.roadMeta?.kondisiJalan === 'RUSAK_SEDANG' ? 'Rusak Sedang' : 'Baik',
          s.roadMeta?.kondisiDrainase || 'Lancar',
          s.totalRumah,
          s.totalJiwa,
          s.totalLaki,
          s.totalPerempuan,
          s.desil1_2,
          s.desil3_5,
          s.desil6_10,
          s.pkhMedanMakmur,
          s.pkhNasional,
          s.bpnt,
          s.totalBansos,
          s.jambanSendiri,
          `${s.jambanSendiriPersen}%`,
          s.primaryWater,
          s.stuntingRisiko,
          s.pbbLunas,
          `${s.pbbLunasPersen}%`,
          s.wrsAktif,
          `${s.wrsAktifPersen}%`,
        ]),
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(s3Data);
      XLSX.utils.book_append_sheet(wb, ws3, 'Tabulasi_Per_Jalan');

      // Sheet 4: Rincian Lengkap KK
      const s4Data = [
        ['DAFTAR LENGKAP KEPALA KELUARGA (KK) KELURAHAN MANGGA'],
        [],
        [
          'No',
          'Lingkungan',
          'Nama Jalan / Gang',
          'No Rumah',
          'Nama Kepala Keluarga',
          'NIK KK',
          'Status KK',
          'Total Jiwa',
          'L',
          'P',
          'Lansia',
          'Anak',
          'Pekerjaan',
          'Tingkat Kesejahteraan (Desil)',
          'Status Bansos',
          'Jenis Bantuan Diterima',
          'Jamban Keluarga',
          'Sumber Air Minum',
          'Sumber Air Bersih',
          'Tempat Akhir Tinja',
          'Pembuangan Sampah',
          'Status Stunting / Resti',
          'Status PBB',
          'NOP PBB',
          'Nominal PBB (Rp)',
          'Status WRS',
          'Tarif WRS (Rp)',
          'Usaha / UMKM',
        ],
        ...houses.map((h, idx) => [
          idx + 1,
          `Lingkungan ${h.lingkunganNomor || h.lingkunganId.replace(/\D/g, '')}`,
          h.namaJalan,
          h.nomorRumah,
          h.namaKepalaKeluarga,
          h.nikKk || '-',
          h.isKkMangga !== false ? 'KK Mangga' : `Luar (${h.asalKk || 'Luar'})`,
          h.jumlahJiwa || 0,
          h.jumlahLakiLaki || 0,
          h.jumlahPerempuan || 0,
          h.jumlahLansia || 0,
          h.jumlahAnak || 0,
          h.pekerjaanKk || '-',
          h.desilKesejahteraan || h.desilBansos || 'Desil 6-10 (Non-Desil)',
          h.penerimaBansos ? 'PENERIMA BANSOS' : 'Bukan Penerima',
          h.jenisBansos?.join(', ') || '-',
          h.jambanKeluarga || 'Jamban Sendiri',
          h.sumberAirMinum || 'PDAM',
          h.sumberAirBersih || 'PDAM',
          h.tempatAkhirTinja || 'Tangki Septik / SPALD',
          h.pembuanganSampahRumah || 'Diangkut Petugas / WRS',
          h.statusStuntingRentan || 'Bebas Risiko Stunting',
          h.statusPbb || 'LUNAS',
          h.nopPbb || '-',
          h.nominalPbb || 0,
          h.statusWrs || 'AKTIF',
          h.tarifRetribusi || 15000,
          h.memilikiUsaha ? `${h.jenisUsaha || 'Usaha'} - ${h.namaUsaha || ''}` : 'Tidak Ada',
        ]),
      ];
      const ws4 = XLSX.utils.aoa_to_sheet(s4Data);
      XLSX.utils.book_append_sheet(wb, ws4, 'Rincian_KK_Warga');

      XLSX.writeFile(wb, `Tabulasi_Kelurahan_Mangga_${new Date().toISOString().slice(0, 10)}.xlsx`);
      onShowToast?.('✅ File Tabulasi Multi-Sheet Excel berhasil diunduh!', 'success');
    } catch (err) {
      console.error('Error exporting Tabulasi Excel:', err);
      onShowToast?.('❌ Gagal mengunduh file Excel Tabulasi.', 'error');
    }
  };

  // Print Tabulation Handler
  const handlePrintTabulation = () => {
    window.print();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* TABULATION TOP MASTER CONTROLLER & NAVIGATION */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-300">
                📊 TABULASI DATA TERPADU
              </span>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-blue-300">
                KELURAHAN MANGGA
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Tabulasi Kesejahteraan, Perlinsos, Sanitasi &amp; Infrastruktur
            </h3>
            <p className="text-xs text-slate-500 max-w-3xl">
              Agregasi data mikro dan makro per <b>Kelurahan</b>, <b>24 Lingkungan</b>, dan <b>Ruas Jalan/Gang</b>.
              Dilengkapi rincian Desil 1 s.d. 5, PKH Medan Makmur, kepemilikan jamban, akses air minum, dan risiko stunting.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenDatabaseKeluarga && (
              <button
                type="button"
                onClick={onOpenDatabaseKeluarga}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-xs font-black shadow-md cursor-pointer transition-transform hover:scale-[1.02]"
                title="Buka Database Master Data Keluarga (KK)"
              >
                <Users className="w-4 h-4 text-blue-200" />
                <span>Database Data Keluarga (KK)</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportFullExcel}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black shadow-md cursor-pointer transition-transform hover:scale-[1.02]"
              title="Unduh seluruh data tabulasi dan rincian KK ke format Excel multi-sheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Ekspor Excel Lengkap</span>
            </button>
            <button
              type="button"
              onClick={handlePrintTabulation}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shadow-md cursor-pointer"
              title="Cetak format laporan resmi tabulasi"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>Cetak / PDF</span>
            </button>
            {onSwitchToMap && (
              <button
                type="button"
                onClick={onSwitchToMap}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-black cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Buka Peta WebGIS</span>
              </button>
            )}
          </div>
        </div>

        {/* SUB-LEVEL TABS SELECTOR (KELURAHAN vs LINGKUNGAN vs JALAN) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
          <div className="inline-flex rounded-2xl bg-slate-100 p-1.5 border border-slate-200 text-xs font-black">
            <button
              type="button"
              onClick={() => setTabLevel('KELURAHAN')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                tabLevel === 'KELURAHAN'
                  ? 'bg-emerald-800 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>🏛️</span>
              <span>1. Rekap Kelurahan</span>
            </button>
            <button
              type="button"
              onClick={() => setTabLevel('LINGKUNGAN')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                tabLevel === 'LINGKUNGAN'
                  ? 'bg-emerald-800 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>🏘️</span>
              <span>2. Per Lingkungan (24 LK)</span>
              <span className="bg-emerald-500/30 text-emerald-950 px-2 py-0.5 rounded-full text-[10px]">
                {lingkunganRows.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTabLevel('JALAN')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                tabLevel === 'JALAN'
                  ? 'bg-emerald-800 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>🛣️</span>
              <span>3. Per Ruas Jalan / Gang</span>
              <span className="bg-amber-500/30 text-amber-950 px-2 py-0.5 rounded-full text-[10px]">
                {streetRows.length} Ruas
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTabLevel('TITIK_BANGUNAN')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
                tabLevel === 'TITIK_BANGUNAN'
                  ? 'bg-rose-800 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>4. Kelola / Hapus Titik Lokasi</span>
              <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {filteredHouses.length}
              </span>
            </button>
          </div>

          {/* Quick Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Lingkungan */}
            {isAdmin ? (
              <select
                value={filterLingkungan}
                onChange={(e) => setFilterLingkungan(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">🌐 Semua Lingkungan (1-24)</option>
                {KEPLING_ACCOUNTS.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.lingkungan} — {acc.nama}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-1.5 rounded-xl border border-emerald-300 text-xs font-black bg-emerald-50 text-emerald-900">
                📍 {currentUser.lingkungan}
              </div>
            )}

            {/* Filter Desil */}
            <select
              value={filterDesil}
              onChange={(e) => setFilterDesil(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">🎯 Semua Desil</option>
              <option value="RENTAN_MISKIN">🔥 Desil 1 s.d. 5 (Prioritas Bansos)</option>
              <option value="DESIL_1_2">🔴 Desil 1-2 (Sangat Miskin/Miskin)</option>
              <option value="DESIL_3_5">🟡 Desil 3-5 (Rentan/Menengah Bawah)</option>
              <option value="DESIL_6_10">🟢 Desil 6-10 (Mampu)</option>
            </select>

            {/* Filter Bansos */}
            <select
              value={filterBansos}
              onChange={(e) => setFilterBansos(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-purple-300 text-xs font-bold bg-purple-50 text-purple-900 focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">🎁 Semua Bansos</option>
              <option value="PKH_MEDAN_MAKMUR">⭐ PKH Medan Makmur</option>
              <option value="PKH_NASIONAL">🏛️ PKH Nasional (Kemensos)</option>
              <option value="BPNT">🌾 BPNT / Sembako</option>
              <option value="BLT">💵 BLT / DBH</option>
              <option value="PBI_JK">🏥 BPJS PBI-JK Gratis</option>
              <option value="RTLH">🏠 Bedah Rumah (RTLH)</option>
              <option value="PENERIMA_ANY">✅ Semua Penerima Bansos</option>
              <option value="NON_BANSOS">❌ Bukan Penerima Bansos</option>
            </select>

            {/* Filter Sanitasi */}
            <select
              value={filterSanitasi}
              onChange={(e) => setFilterSanitasi(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-teal-300 text-xs font-bold bg-teal-50 text-teal-900 focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">💧 Semua Sanitasi</option>
              <option value="JAMBAN_SENDIRI">🚽 Jamban Sendiri SNI</option>
              <option value="JAMBAN_KOMUNAL">👥 Jamban Bersama/Komunal</option>
              <option value="BABS">⚠️ BABS / Tanpa Jamban</option>
              <option value="AIR_PDAM">🚰 Air PDAM Tirtanadi</option>
              <option value="AIR_DEPOT_KEMASAN">🧴 Depot Isi Ulang/Kemasan</option>
              <option value="AIR_SUMUR">🪣 Sumur Bor / Gali</option>
              <option value="STUNTING_RESTI">👶 Risiko Stunting / Resti</option>
            </select>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari jalan / warga..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-40 sm:w-48"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* LEVEL 1: REKAPITULASI KELURAHAN (MACRO OVERVIEW & TABLES) */}
      {/* ========================================================= */}
      {tabLevel === 'KELURAHAN' && (
        <div className="space-y-5">
          {/* TOP KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total KK */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">Total KK</span>
                <Home className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-1">{kelurahanMacroStats.totalKk} KK</p>
              <span className="text-[10px] text-slate-500 font-medium">
                {kelurahanMacroStats.kkMangga} Domisili Mangga
              </span>
            </div>

            {/* Total Jiwa */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">Populasi Jiwa</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-1">{kelurahanMacroStats.totalJiwa} Jiwa</p>
              <span className="text-[10px] text-slate-500 font-medium">
                {kelurahanMacroStats.totalLaki} L / {kelurahanMacroStats.totalPerempuan} P
              </span>
            </div>

            {/* Desil 1-5 (Prioritas Bansos) */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-amber-800">Desil 1 s.d. 5</span>
                <span className="text-xs">🎯</span>
              </div>
              <p className="text-2xl font-black text-amber-900 mt-1">{kelurahanMacroStats.totalDesil1_5} KK</p>
              <span className="text-[10px] text-amber-700 font-bold">
                {kelurahanMacroStats.totalKk > 0 ? Math.round((kelurahanMacroStats.totalDesil1_5 / kelurahanMacroStats.totalKk) * 100) : 0}% Tingkat Rentan/Miskin
              </span>
            </div>

            {/* PKH Medan Makmur */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 rounded-2xl border border-purple-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-purple-800">PKH Medan Makmur</span>
                <HeartHandshake className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-black text-purple-900 mt-1">{kelurahanMacroStats.pkhMedanMakmur} KK</p>
              <span className="text-[10px] text-purple-700 font-bold">
                Bansos Unggulan Pemko
              </span>
            </div>

            {/* Sanitasi Jamban Sendiri */}
            <div className="bg-white p-4 rounded-2xl border border-teal-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-teal-800">Jamban Sendiri</span>
                <Droplets className="w-4 h-4 text-teal-600" />
              </div>
              <p className="text-2xl font-black text-teal-900 mt-1">{kelurahanMacroStats.jambanSendiri} KK</p>
              <span className="text-[10px] text-teal-700 font-bold">
                {kelurahanMacroStats.totalKk > 0 ? Math.round((kelurahanMacroStats.jambanSendiri / kelurahanMacroStats.totalKk) * 100) : 0}% Layak SNI
              </span>
            </div>

            {/* PBB & WRS Kepatuhan */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500">PBB / WRS</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {kelurahanMacroStats.pbbLunas} / {kelurahanMacroStats.wrsAktif}
              </p>
              <span className="text-[10px] text-slate-500 font-medium">
                PBB Lunas / WRS Aktif
              </span>
            </div>
          </div>

          {/* TABEL 1: TINGKAT KESEJAHTERAAN KELUARGA (DESIL 1 - 10) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-amber-900 via-slate-900 to-amber-950 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🎯</span>
                <div>
                  <h4 className="font-black text-base">Tingkat Kesejahteraan Keluarga (Data Utama Desil)</h4>
                  <p className="text-xs text-amber-200">
                    Klasifikasi keluarga berdasarkan desil kemiskinan dan intervensi bantuan sosial
                  </p>
                </div>
              </div>
              <span className="bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full">
                Total: {kelurahanMacroStats.totalKk} KK
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 uppercase text-[10px]">
                    <th className="p-3">Kategori Desil Kesejahteraan</th>
                    <th className="p-3 text-center">Tingkat Ekonomi</th>
                    <th className="p-3 text-center">Jumlah KK</th>
                    <th className="p-3 text-center">Persentase</th>
                    <th className="p-3">Pilihan Program Bantuan Langsung Terkait</th>
                    <th className="p-3 text-center">Status Intervensi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {/* Desil 1 */}
                  <tr className="hover:bg-red-50/50 bg-red-50/20">
                    <td className="p-3 font-bold text-red-950 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-600 inline-block shrink-0"></span>
                      <span>Desil 1</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-800 font-black text-[10px]">
                        Sangat Miskin
                      </span>
                    </td>
                    <td className="p-3 text-center font-black text-base text-red-900">{kelurahanMacroStats.desil1}</td>
                    <td className="p-3 text-center font-bold text-red-800">
                      {kelurahanMacroStats.totalKk > 0 ? Math.round((kelurahanMacroStats.desil1 / kelurahanMacroStats.totalKk) * 100) : 0}%
                    </td>
                    <td className="p-3 text-slate-700">
                      <b>PKH Medan Makmur</b>, PKH Nasional, BPNT Sembako, BPJS PBI-JK Gratis, Bedah Rumah (RTLH)
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-1 rounded-full bg-red-600 text-white font-bold text-[10px]">
                        Prioritas Utama 1
                      </span>
                    </td>
                  </tr>

                  {/* Desil 2 */}
                  <tr className="hover:bg-orange-50/50">
                    <td className="p-3 font-bold text-orange-950 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-orange-500 inline-block shrink-0"></span>
                      <span>Desil 2</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 font-black text-[10px]">
                        Miskin
                      </span>
                    </td>
                    <td className="p-3 text-center font-black text-base text-orange-900">{kelurahanMacroStats.desil2}</td>
                    <td className="p-3 text-center font-bold text-orange-800">
                      {kelurahanMacroStats.totalKk > 0 ? Math.round((kelurahanMacroStats.desil2 / kelurahanMacroStats.totalKk) * 100) : 0}%
                    </td>
                    <td className="p-3 text-slate-700">
                      <b>PKH Medan Makmur</b>, BPNT Sembako, BLT / DBH, BPJS PBI-JK, Bantuan Pangan Cadangan Beras
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-1 rounded-full bg-orange-600 text-white font-bold text-[10px]">
                        Prioritas Utama 2
                      </span>
                    </td>
                  </tr>

                  {/* Desil 3 */}
                  <tr className="hover:bg-amber-50/50">
                    <td className="p-3 font-bold text-amber-950 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500 inline-block shrink-0"></span>
                      <span>Desil 3</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-black text-[10px]">
                        Hampir Miskin
                      </span>
                    </td>
                    <td className="p-3 text-center font-black text-base text-amber-900">{kelurahanMacroStats.desil3}</td>
                    <td className="p-3 text-center font-bold text-amber-800">
                      {kelurahanMacroStats.totalKk > 0 ? Math.round((kelurahanMacroStats.desil3 / kelurahanMacroStats.totalKk) * 100) : 0}%
                    </td>
                    <td className="p-3 text-slate-700">
                      BPNT / Sembako, BLT Daerah, PIP Beasiswa, Bantuan Modal Usaha / UMKM Mikro, PBI-JK
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-1 rounded-full bg-amber-600 text-white font-bold text-[10px]">
                        Bantuan Terarah
                      </span>
                    </td>
                  </tr>

                  {/* Desil 4 */}
                  <tr className="hover:bg-yellow-50/50">
                    <td className="p-3 font-bold text-yellow-950 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block shrink-0"></span>
                      <span>Desil 4</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-800 font-black text-[10px]">
                        Rentan Miskin
                      </span>
                    </td>
                    <td className="p-3 text-center font-black text-base text-yellow-900">{kelurahanMacroStats.desil4}</td>
                    <td className="p-3 text-center font-bold text-yellow-800">
                      {kelurahanMacroStats.totalKk > 0 ? Math.round((kelurahanMacroStats.desil4 / kelurahanMacroStats.totalKk) * 100) : 0}%
                    </td>
                    <td className="p-3 text-slate-700">
                      BLT / DBH, PIP Beasiswa Anak Sekolah, Program Padat Karya, Pelatihan Ketenagakerjaan
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-1 rounded-full bg-yellow-600 text-white font-bold text-[10px]">
                        Pemberdayaan
                      </span>
                    </td>
                  </tr>

                  {/* Desil 5 */}
                  <tr className="hover:bg-blue-50/50">
                    <td className="p-3 font-bold text-blue-950 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500 inline-block shrink-0"></span>
                      <span>Desil 5</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-black text-[10px]">
                        Menengah Bawah
                      </span>
                    </td>
                    <td className="p-3 text-center font-black text-base text-blue-900">{kelurahanMacroStats.desil5}</td>
                    <td className="p-3 text-center font-bold text-blue-800">
                      {kelurahanMacroStats.totalKk > 0 ? Math.round((kelurahanMacroStats.desil5 / kelurahanMacroStats.totalKk) * 100) : 0}%
                    </td>
                    <td className="p-3 text-slate-700">
                      Subsidi Listrik / Gas, Fasilitasi Kredit Usaha Rakyat (KUR), BPJS Mandiri Kelas 3
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-1 rounded-full bg-blue-600 text-white font-bold text-[10px]">
                        Dukungan Ekonomi
                      </span>
                    </td>
                  </tr>

                  {/* Desil 6-10 */}
                  <tr className="hover:bg-emerald-50/50">
                    <td className="p-3 font-bold text-emerald-950 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shrink-0"></span>
                      <span>Desil 6-10</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px]">
                        Mampu / Mandiri
                      </span>
                    </td>
                    <td className="p-3 text-center font-black text-base text-emerald-900">{kelurahanMacroStats.desil6Plus}</td>
                    <td className="p-3 text-center font-bold text-emerald-800">
                      {kelurahanMacroStats.totalKk > 0 ? Math.round((kelurahanMacroStats.desil6Plus / kelurahanMacroStats.totalKk) * 100) : 0}%
                    </td>
                    <td className="p-3 text-slate-700">
                      Non-Penerima Bansos Tunai / Kepatuhan PBB & Wajib Retribusi Sampah (WRS)
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-1 rounded-full bg-emerald-600 text-white font-bold text-[10px]">
                        Mandiri
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* TABEL 2: RINCIAN PENERIMA BANTUAN SOSIAL (PERLINSOS) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bansos Matrix */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-purple-950 to-indigo-950 text-white p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-purple-300" />
                  <h4 className="font-black text-sm">Rekapitulasi Penerima Bantuan Sosial</h4>
                </div>
                <span className="text-[10px] bg-purple-800 text-purple-200 px-2.5 py-0.5 rounded-full font-bold">
                  {kelurahanMacroStats.totalPenerimaBansos} Penerima Terdata
                </span>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { name: 'PKH Medan Makmur (Pemko Medan)', count: kelurahanMacroStats.pkhMedanMakmur, desc: 'Bansos Unggulan Pemko Medan', color: 'bg-purple-600' },
                  { name: 'PKH Nasional (Kemensos)', count: kelurahanMacroStats.pkhNasional, desc: 'Program Keluarga Harapan Reguler', color: 'bg-indigo-600' },
                  { name: 'BPNT / Sembako', count: kelurahanMacroStats.bpntSembako, desc: 'Bantuan Pangan Non Tunai', color: 'bg-blue-600' },
                  { name: 'BLT / DBH / Bansos Tunai', count: kelurahanMacroStats.bltDbh, desc: 'Bantuan Tunai APBD/APBN', color: 'bg-teal-600' },
                  { name: 'PBI-JK (BPJS Kesehatan Gratis)', count: kelurahanMacroStats.pbiJk, desc: 'Kesehatan Gratis bagi Warga Kurang Mampu', color: 'bg-emerald-600' },
                  { name: 'Bedah Rumah / RTLH (Disperkim)', count: kelurahanMacroStats.rtlh, desc: 'Rehabilitasi Rumah Tidak Layak Huni', color: 'bg-amber-600' },
                  { name: 'PIP / Beasiswa Pendidikan', count: kelurahanMacroStats.pipBeasiswa, desc: 'Bantuan Siswa Sekolah', color: 'bg-orange-600' },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-slate-800">{item.name}</p>
                      <p className="text-[10px] text-slate-500">{item.desc}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-slate-900 block">{item.count} KK</span>
                      <span className="text-[9px] font-bold text-purple-700">
                        {kelurahanMacroStats.totalKk > 0 ? Math.round((item.count / kelurahanMacroStats.totalKk) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sanitasi & Kesehatan Matrix */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-teal-950 to-emerald-950 text-white p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-teal-300" />
                  <h4 className="font-black text-sm">Sanitasi, Air Bersih &amp; Kesehatan</h4>
                </div>
                <span className="text-[10px] bg-teal-800 text-teal-200 px-2.5 py-0.5 rounded-full font-bold">
                  Kesehatan Lingkungan
                </span>
              </div>
              <div className="p-4 space-y-3">
                {/* Jamban */}
                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-800">🚽 Kepemilikan Jamban Keluarga</span>
                    <span className="text-xs font-black text-teal-800">
                      {kelurahanMacroStats.jambanSendiri}/{kelurahanMacroStats.totalKk} KK Sendiri
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px] mt-1.5">
                    <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-900 font-bold text-center">
                      Sendiri: {kelurahanMacroStats.jambanSendiri}
                    </div>
                    <div className="bg-amber-100 p-1.5 rounded-lg text-amber-900 font-bold text-center">
                      Komunal: {kelurahanMacroStats.jambanKomunal}
                    </div>
                    <div className="bg-rose-100 p-1.5 rounded-lg text-rose-900 font-bold text-center">
                      BABS: {kelurahanMacroStats.jambanBabs}
                    </div>
                  </div>
                </div>

                {/* Air Minum */}
                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-800">🚰 Sumber Air Minum Utama</span>
                    <span className="text-xs font-black text-blue-800">
                      {kelurahanMacroStats.airMinumPdam} KK PDAM
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px] mt-1.5">
                    <div className="bg-blue-100 p-1.5 rounded-lg text-blue-900 font-bold text-center">
                      PDAM: {kelurahanMacroStats.airMinumPdam}
                    </div>
                    <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-900 font-bold text-center">
                      Depot: {kelurahanMacroStats.airMinumDepot + kelurahanMacroStats.airMinumKemasan}
                    </div>
                    <div className="bg-slate-200 p-1.5 rounded-lg text-slate-800 font-bold text-center">
                      Sumur: {kelurahanMacroStats.airMinumSumurBor + kelurahanMacroStats.airMinumSumurGali}
                    </div>
                  </div>
                </div>

                {/* Pembuangan Sampah & Septik */}
                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-800">🗑️ Pembuangan Sampah &amp; Tangki Septik</span>
                    <span className="text-xs font-black text-emerald-800">
                      {kelurahanMacroStats.sampahPetugasWrs} Bangunan Petugas/WRS
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] mt-1.5">
                    <div className="bg-teal-100 p-1.5 rounded-lg text-teal-900 font-bold text-center">
                      Tangki Septik SPALD: {kelurahanMacroStats.tinjaSeptik} KK
                    </div>
                    <div className="bg-rose-100 p-1.5 rounded-lg text-rose-900 font-bold text-center">
                      Saluran Terbuka/Parit: {kelurahanMacroStats.tinjaParit} KK
                    </div>
                  </div>
                </div>

                {/* Stunting Alert */}
                <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Baby className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-rose-900">Pemantauan Risiko Stunting / KEK</p>
                      <p className="text-[10px] text-rose-700">Balita &amp; Ibu Hamil Resti</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-rose-900 px-2.5 py-1 bg-rose-200 rounded-xl">
                    {kelurahanMacroStats.stuntingResti + kelurahanMacroStats.bumilKekResti} KK Rentan
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* LEVEL 2: TABULASI 24 LINGKUNGAN (INTERACTIVE TABLE)       */}
      {/* ========================================================= */}
      {tabLevel === 'LINGKUNGAN' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-black text-base flex items-center gap-2">
                <span>🏘️ Tabulasi Matriks 24 Lingkungan Kelurahan Mangga</span>
              </h4>
              <p className="text-xs text-emerald-200">
                Data agregat Kesejahteraan (Desil), PKH Medan Makmur, Sanitasi, PBB, dan Ruas Jalan per Lingkungan
              </p>
            </div>
            <span className="bg-emerald-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full self-start sm:self-auto">
              24 Lingkungan Aktif
            </span>
          </div>

          <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-slate-100 z-10 text-slate-700 font-black border-b-2 border-slate-300 text-[10px] uppercase shadow-2xs">
                <tr>
                  <th className="p-3 text-center">LK</th>
                  <th className="p-3">Lingkungan &amp; Kepling</th>
                  <th className="p-3 text-center">Total KK</th>
                  <th className="p-3 text-center">Jiwa (L/P)</th>
                  <th className="p-3 text-center bg-red-50 text-red-900">Desil 1-2</th>
                  <th className="p-3 text-center bg-amber-50 text-amber-900">Desil 3-5</th>
                  <th className="p-3 text-center bg-emerald-50 text-emerald-900">Desil 6-10</th>
                  <th className="p-3 text-center bg-purple-50 text-purple-900">PKH Medan Makmur</th>
                  <th className="p-3 text-center bg-purple-50 text-purple-900">Total Bansos</th>
                  <th className="p-3 text-center bg-teal-50 text-teal-900">Jamban Sendiri (%)</th>
                  <th className="p-3 text-center bg-blue-50 text-blue-900">Air Minum Layak (%)</th>
                  <th className="p-3 text-center bg-rose-50 text-rose-900">Stunting (KK)</th>
                  <th className="p-3 text-center bg-teal-50 text-teal-900">PBB Lunas (%)</th>
                  <th className="p-3 text-center bg-emerald-50 text-emerald-900">WRS Aktif (%)</th>
                  <th className="p-3 text-center bg-amber-50 text-amber-900">Jalan Rusak</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {lingkunganRows.map((row) => (
                  <tr
                    key={row.account.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="p-3 text-center font-black text-slate-800">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 inline-flex items-center justify-center font-bold text-xs">
                        {row.lingkunganNomor}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{row.lingkunganNama}</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        Kepling: <span className="font-bold text-slate-700">{row.keplingNama}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center font-black text-slate-800">{row.totalKk}</td>
                    <td className="p-3 text-center text-slate-600">
                      <span className="font-bold text-slate-800">{row.totalJiwa}</span>{' '}
                      <span className="text-[10px] text-slate-400">({row.totalLaki}L / {row.totalPerempuan}P)</span>
                    </td>
                    <td className="p-3 text-center font-bold text-red-700 bg-red-50/40">{row.desil1_2}</td>
                    <td className="p-3 text-center font-bold text-amber-700 bg-amber-50/40">{row.desil3_5}</td>
                    <td className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/40">{row.desil6_10}</td>
                    <td className="p-3 text-center font-black text-purple-800 bg-purple-50/40">
                      {row.pkhMedanMakmur > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 font-black text-[10px]">
                          {row.pkhMedanMakmur} KK
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold text-purple-900 bg-purple-50/40">{row.totalBansos}</td>
                    <td className="p-3 text-center bg-teal-50/40">
                      <span className="font-bold text-teal-800">{row.jambanSendiriPersen}%</span>{' '}
                      <span className="text-[10px] text-slate-400">({row.jambanSendiri})</span>
                    </td>
                    <td className="p-3 text-center bg-blue-50/40">
                      <span className="font-bold text-blue-800">{row.airPdamLayakPersen}%</span>
                    </td>
                    <td className="p-3 text-center bg-rose-50/40">
                      {row.stuntingRisiko > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 font-bold text-[10px]">
                          {row.stuntingRisiko} KK
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold">0 (Nihil)</span>
                      )}
                    </td>
                    <td className="p-3 text-center bg-teal-50/40">
                      <span className="font-bold text-teal-800">{row.pbbLunasPersen}%</span>{' '}
                      <span className="text-[10px] text-slate-400">({row.pbbLunas})</span>
                    </td>
                    <td className="p-3 text-center bg-emerald-50/40">
                      <span className="font-bold text-emerald-800">{row.wrsAktifPersen}%</span>
                    </td>
                    <td className="p-3 text-center bg-amber-50/40">
                      {row.jalanRusak > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px]">
                          {row.jalanRusak} Ruas
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold">0 (Mulus)</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setFilterLingkungan(row.account.id);
                          setTabLevel('JALAN');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer"
                        title="Buka rincian jalan dan rumah di lingkungan ini"
                      >
                        Lihat Jalan ➔
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-900 text-white font-black text-xs">
                <tr>
                  <td className="p-3 text-center">∑</td>
                  <td className="p-3">TOTAL KELURAHAN MANGGA</td>
                  <td className="p-3 text-center text-emerald-300">{kelurahanMacroStats.totalKk} KK</td>
                  <td className="p-3 text-center">{kelurahanMacroStats.totalJiwa} Jiwa</td>
                  <td className="p-3 text-center text-red-300">{kelurahanMacroStats.desil1 + kelurahanMacroStats.desil2}</td>
                  <td className="p-3 text-center text-amber-300">{kelurahanMacroStats.desil3 + kelurahanMacroStats.desil4 + kelurahanMacroStats.desil5}</td>
                  <td className="p-3 text-center text-emerald-300">{kelurahanMacroStats.desil6Plus}</td>
                  <td className="p-3 text-center text-purple-300">{kelurahanMacroStats.pkhMedanMakmur}</td>
                  <td className="p-3 text-center text-purple-300">{kelurahanMacroStats.totalPenerimaBansos}</td>
                  <td className="p-3 text-center text-teal-300">
                    {kelurahanMacroStats.totalKk > 0 ? Math.round((kelurahanMacroStats.jambanSendiri / kelurahanMacroStats.totalKk) * 100) : 0}%
                  </td>
                  <td className="p-3 text-center text-blue-300">
                    {kelurahanMacroStats.totalKk > 0 ? Math.round((kelurahanMacroStats.airMinumPdam / kelurahanMacroStats.totalKk) * 100) : 0}%
                  </td>
                  <td className="p-3 text-center text-rose-300">{kelurahanMacroStats.stuntingResti}</td>
                  <td className="p-3 text-center text-teal-300">
                    {kelurahanMacroStats.totalKk > 0 ? Math.round((kelurahanMacroStats.pbbLunas / kelurahanMacroStats.totalKk) * 100) : 0}%
                  </td>
                  <td className="p-3 text-center text-emerald-300">
                    {kelurahanMacroStats.totalKk > 0 ? Math.round((kelurahanMacroStats.wrsAktif / kelurahanMacroStats.totalKk) * 100) : 0}%
                  </td>
                  <td className="p-3 text-center">-</td>
                  <td className="p-3 text-center">24 LK</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* LEVEL 3: TABULASI RUAS JALAN & GANG (MIKRO BREAKDOWN)     */}
      {/* ========================================================= */}
      {tabLevel === 'JALAN' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-900 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-black text-base flex items-center gap-2">
                <span>🛣️ Tabulasi Mikro Per Ruas Jalan &amp; Gang</span>
              </h4>
              <p className="text-xs text-amber-200">
                Menampilkan sebaran rumah, kondisi jalan, sanitasi, dan penerima bansos per jalan
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full">
                {filteredStreetRows.length} Ruas Terdaftar
              </span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-slate-100 z-10 text-slate-700 font-black border-b-2 border-slate-300 text-[10px] uppercase shadow-2xs">
                <tr>
                  <th className="p-3 text-center">No</th>
                  <th className="p-3">Nama Ruas Jalan / Gang</th>
                  <th className="p-3 text-center">Lingkungan</th>
                  <th className="p-3 text-center">Kondisi Fisik Jalan</th>
                  <th className="p-3 text-center">Drainase</th>
                  <th className="p-3 text-center">Jumlah Bangunan</th>
                  <th className="p-3 text-center">Jiwa (L/P)</th>
                  <th className="p-3 text-center bg-red-50 text-red-900">Desil 1-2</th>
                  <th className="p-3 text-center bg-amber-50 text-amber-900">Desil 3-5</th>
                  <th className="p-3 text-center bg-purple-50 text-purple-900">PKH Medan Makmur</th>
                  <th className="p-3 text-center bg-purple-50 text-purple-900">Total Bansos</th>
                  <th className="p-3 text-center bg-teal-50 text-teal-900">Jamban Sendiri (%)</th>
                  <th className="p-3 text-center bg-blue-50 text-blue-900">Air Minum Utama</th>
                  <th className="p-3 text-center bg-rose-50 text-rose-900">Stunting (KK)</th>
                  <th className="p-3 text-center bg-teal-50 text-teal-900">PBB Lunas (%)</th>
                  <th className="p-3 text-center bg-emerald-50 text-emerald-900">WRS Aktif (%)</th>
                  <th className="p-3 text-center">Rincian KK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredStreetRows.map((street, idx) => (
                  <tr key={`${street.namaJalan}__${street.lingkunganNomor}`} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-center text-slate-500 font-bold">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🛣️</span>
                        <span>{street.namaJalan}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px]">
                        Lingkungan {street.lingkunganNomor}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {street.roadMeta ? (
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            street.roadMeta.kondisiJalan === 'BAIK'
                              ? 'bg-emerald-100 text-emerald-800'
                              : street.roadMeta.kondisiJalan === 'RUSAK_BERAT'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {street.roadMeta.kondisiJalan === 'BAIK' ? '🟢 Baik' : street.roadMeta.kondisiJalan === 'RUSAK_BERAT' ? '🔴 Rusak Berat' : '🟡 Rusak Sedang'}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Aspal / Baik</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] text-slate-600">
                        {street.roadMeta?.kondisiDrainase || 'Lancar'}
                      </span>
                    </td>
                    <td className="p-3 text-center font-black text-slate-800">
                      {street.totalRumah} Rumah/KK
                    </td>
                    <td className="p-3 text-center text-slate-600">
                      <span className="font-bold text-slate-800">{street.totalJiwa}</span>{' '}
                      <span className="text-[10px] text-slate-400">({street.totalLaki}L / {street.totalPerempuan}P)</span>
                    </td>
                    <td className="p-3 text-center font-bold text-red-700 bg-red-50/40">{street.desil1_2}</td>
                    <td className="p-3 text-center font-bold text-amber-700 bg-amber-50/40">{street.desil3_5}</td>
                    <td className="p-3 text-center font-black text-purple-800 bg-purple-50/40">
                      {street.pkhMedanMakmur > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 font-bold text-[10px]">
                          {street.pkhMedanMakmur} KK
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold text-purple-900 bg-purple-50/40">{street.totalBansos}</td>
                    <td className="p-3 text-center bg-teal-50/40">
                      <span className="font-bold text-teal-800">{street.jambanSendiriPersen}%</span>
                    </td>
                    <td className="p-3 text-center bg-blue-50/40 text-[10px] font-bold text-blue-900">
                      {street.primaryWater}
                    </td>
                    <td className="p-3 text-center bg-rose-50/40">
                      {street.stuntingRisiko > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 font-bold text-[10px]">
                          {street.stuntingRisiko} KK
                        </span>
                      ) : (
                        <span className="text-emerald-700">0</span>
                      )}
                    </td>
                    <td className="p-3 text-center bg-teal-50/40">
                      <span className="font-bold text-teal-800">{street.pbbLunasPersen}%</span>
                    </td>
                    <td className="p-3 text-center bg-emerald-50/40">
                      <span className="font-bold text-emerald-800">{street.wrsAktifPersen}%</span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedStreetDetail(street)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Daftar KK ({street.houses.length})</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: KELOLA & HAPUS TITIK BANGUNAN SALAH LOKASI          */}
      {/* ========================================================= */}
      {tabLevel === 'TITIK_BANGUNAN' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5 animate-in fade-in duration-200">
          {/* Header & Warning Banner */}
          <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-red-950 text-white p-5 rounded-2xl border border-rose-900/50 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30 uppercase tracking-wider flex items-center gap-1">
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  <span>Pusat Manajemen &amp; Pembersihan Titik Spasial</span>
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">
                Kelola &amp; Hapus Titik Bangunan / Rumah Salah Lokasi
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Gunakan menu ini untuk memilih dan menghapus titik-titik koordinat bangunan yang salah penempatan,
                menghapus per lingkungan, atau mengosongkan seluruh titik untuk dipetakan ulang dengan akurat.
              </p>
            </div>

            {/* Quick Summary KPI */}
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-xl border border-white/10 text-center min-w-[100px]">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Titik</div>
                <div className="text-xl font-black text-white">{filteredHouses.length}</div>
              </div>
              <div className="p-3 bg-white/10 rounded-xl border border-white/10 text-center min-w-[100px]">
                <div className="text-[10px] uppercase font-bold text-slate-400">Terpilih</div>
                <div className="text-xl font-black text-rose-400">{selectedHouseIds.size}</div>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedHouseIds.size === filteredHouses.length) {
                    setSelectedHouseIds(new Set());
                  } else {
                    setSelectedHouseIds(new Set(filteredHouses.map((h) => h.id)));
                  }
                }}
                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {selectedHouseIds.size === filteredHouses.length && filteredHouses.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  {selectedHouseIds.size === filteredHouses.length && filteredHouses.length > 0
                    ? 'Batalkan Pilihan Semua'
                    : 'Pilih Semua Titik Terfilter'}
                </span>
              </button>

              {selectedHouseIds.size > 0 && onDeleteBulkHouses && (
                <button
                  type="button"
                  disabled={isDeletingBulk}
                  onClick={() => {
                    const count = selectedHouseIds.size;
                    if (window.confirm(`⚠️ Yakin ingin menghapus ${count} titik bangunan terpilih dari peta dan database? Tindakan ini permanen.`)) {
                      setIsDeletingBulk(true);
                      onDeleteBulkHouses(Array.from(selectedHouseIds));
                      setSelectedHouseIds(new Set());
                      setTimeout(() => setIsDeletingBulk(false), 500);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95 animate-pulse border border-rose-400/40"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>HAPUS MASSAL ({selectedHouseIds.size} TITIK TERPILIH)</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {filterLingkungan !== 'all' && onDeleteHousesByLingkungan && (
                <button
                  type="button"
                  onClick={() => {
                    const lkAcc = KEPLING_ACCOUNTS.find((k) => k.id === filterLingkungan);
                    const lkName = lkAcc ? lkAcc.lingkungan : filterLingkungan;
                    if (window.confirm(`⚠️ Yakin ingin menghapus SEMUA titik bangunan di ${lkName} (${filteredHouses.length} titik)?`)) {
                      onDeleteHousesByLingkungan(filterLingkungan);
                      setSelectedHouseIds(new Set());
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-amber-600" />
                  <span>Hapus Semua Titik di Lingkungan Ini</span>
                </button>
              )}

              {isAdmin && onClearAllHouses && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.prompt('⚠️ PERINGATAN: Anda akan MENGHAPUS SELURUH TITIK BANGUNAN DI SEMUA LINGKUNGAN dari Peta WebGIS!\n\nKetik "HAPUS SEMUA" untuk konfirmasi:') === 'HAPUS SEMUA') {
                      onClearAllHouses();
                      setSelectedHouseIds(new Set());
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 text-xs font-bold border border-rose-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Kosongkan seluruh titik bangunan yang salah lokasi"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Kosongkan Seluruh Titik (Reset Peta)</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Box inside this tab */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama kepala keluarga, NIK, alamat, atau nama jalan untuk dihapus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-rose-500 bg-slate-50"
            />
          </div>

          {/* Table of Houses */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 uppercase text-[10px] text-slate-700 font-black shadow-xs">
                <tr>
                  <th className="p-3 text-center w-10">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedHouseIds.size === filteredHouses.length) {
                          setSelectedHouseIds(new Set());
                        } else {
                          setSelectedHouseIds(new Set(filteredHouses.map((h) => h.id)));
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {selectedHouseIds.size === filteredHouses.length && filteredHouses.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="p-3">No</th>
                  <th className="p-3">Lingkungan</th>
                  <th className="p-3">Nama Kepala Keluarga / Bangunan</th>
                  <th className="p-3">NIK / NOP</th>
                  <th className="p-3">Alamat / Jalan</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Koordinat (Lat, Lng)</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredHouses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Tidak ada data titik bangunan yang cocok dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredHouses.slice(0, 500).map((house, idx) => {
                    const isSelected = selectedHouseIds.has(house.id);
                    const hasValidCoords = house.lat && house.lng && Number(house.lat) !== 0 && Number(house.lng) !== 0;

                    return (
                      <tr
                        key={house.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-rose-50/70 hover:bg-rose-100/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Set(selectedHouseIds);
                              if (next.has(house.id)) next.delete(house.id);
                              else next.add(house.id);
                              setSelectedHouseIds(next);
                            }}
                            className="cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-rose-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                        </td>
                        <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800">
                          {house.lingkunganNomor ? `Lingkungan ${house.lingkunganNomor}` : house.lingkunganId}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{house.namaKepalaKeluarga || 'Bangunan'}</div>
                          {house.nomorRumah && (
                            <div className="text-[10px] text-slate-400">No. Rumah: {house.nomorRumah}</div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">
                          {house.nikKk || house.nopPbb || '-'}
                        </td>
                        <td className="p-3 text-slate-700 max-w-xs truncate">
                          {house.namaJalan || '-'}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {house.kategoriBangunan || 'RUMAH_TINGGAL'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[10px]">
                          {hasValidCoords ? (
                            <span className="text-slate-700">
                              {Number(house.lat).toFixed(6)}, {Number(house.lng).toFixed(6)}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                              ⚠️ Koordinat Kosong
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {onSelectHouseForMap && (
                              <button
                                type="button"
                                onClick={() => onSelectHouseForMap(house)}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] cursor-pointer"
                                title="Buka Titik di Peta WebGIS"
                              >
                                📍 Peta
                              </button>
                            )}
                            {onDeleteHouse && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Hapus titik bangunan "${house.namaKepalaKeluarga}" (${house.namaJalan})?`)) {
                                    onDeleteHouse(house.id, house.namaKepalaKeluarga);
                                    setSelectedHouseIds((prev) => {
                                      const next = new Set(prev);
                                      next.delete(house.id);
                                      return next;
                                    });
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                                title="Hapus Titik Bangunan Ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredHouses.length > 500 && (
            <div className="p-2 text-center text-xs text-slate-500 font-medium">
              Menampilkan 500 dari {filteredHouses.length} titik. Gunakan pencarian atau filter lingkungan untuk mempersempit data.
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DETAIL DAFTAR KEPALA KELUARGA (KK) PER JALAN       */}
      {/* ========================================================= */}
      {selectedStreetDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-400/40">
                    RINCIAN DATA KELUARGA (KK)
                  </span>
                  <span className="bg-amber-500/30 text-amber-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-400/40">
                    Lingkungan {selectedStreetDetail.lingkunganNomor}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black flex items-center gap-2">
                  <span>🛣️ {selectedStreetDetail.namaJalan}</span>
                </h3>
                <p className="text-xs text-slate-300">
                  Total terdata: <b>{selectedStreetDetail.houses.length} Kepala Keluarga / Bangunan</b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStreetDetail(null)}
                className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: KK Table */}
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar space-y-3">
              {selectedStreetDetail.houses.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  Belum ada data titik rumah yang terhubung ke ruas jalan ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 uppercase text-[10px]">
                        <th className="p-2.5">No Rumah</th>
                        <th className="p-2.5">Nama Kepala Keluarga &amp; NIK</th>
                        <th className="p-2.5 text-center">Status KK</th>
                        <th className="p-2.5 text-center">Jiwa (L/P)</th>
                        <th className="p-2.5 text-center">Desil Kesejahteraan</th>
                        <th className="p-2.5">Bansos Diterima</th>
                        <th className="p-2.5">Sanitasi (Jamban &amp; Air)</th>
                        <th className="p-2.5 text-center">PBB</th>
                        <th className="p-2.5 text-center">WRS</th>
                        <th className="p-2.5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {selectedStreetDetail.houses.map((house) => (
                        <tr key={house.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-800">{house.nomorRumah || '-'}</td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900">{house.namaKepalaKeluarga}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{house.nikKk || 'NIK: -'}</div>
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                house.isKkMangga !== false
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {house.isKkMangga !== false ? 'KK Mangga' : 'KK Luar'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="font-bold text-slate-800">{house.jumlahJiwa || 0}</span>{' '}
                            <span className="text-[10px] text-slate-400">({house.jumlahLakiLaki || 0}L/{house.jumlahPerempuan || 0}P)</span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                (house.desilKesejahteraan || house.desilBansos || '').includes('Desil 1') || (house.desilKesejahteraan || house.desilBansos || '').includes('Desil 2')
                                  ? 'bg-red-100 text-red-800'
                                  : (house.desilKesejahteraan || house.desilBansos || '').includes('Desil 3') || (house.desilKesejahteraan || house.desilBansos || '').includes('Desil 4') || (house.desilKesejahteraan || house.desilBansos || '').includes('Desil 5')
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {house.desilKesejahteraan || house.desilBansos || 'Desil 6-10 (Mampu)'}
                            </span>
                          </td>
                          <td className="p-2.5">
                            {house.jenisBansos && house.jenisBansos.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {house.jenisBansos.map((b) => (
                                  <span
                                    key={b}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                      b === 'PKH Medan Makmur'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-purple-100 text-purple-800'
                                    }`}
                                  >
                                    {b}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Non-Bansos</span>
                            )}
                          </td>
                          <td className="p-2.5 text-[10px]">
                            <div className="font-bold text-slate-700">🚽 {house.jambanKeluarga || 'Jamban Sendiri'}</div>
                            <div className="text-slate-500">🚰 {house.sumberAirMinum || 'PDAM'}</div>
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                house.statusPbb === 'LUNAS'
                                  ? 'bg-teal-100 text-teal-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {house.statusPbb === 'LUNAS' ? 'Lunas' : 'Belum'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                house.statusWrs === 'AKTIF'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {house.statusWrs || 'AKTIF'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {onSelectHouseForMap && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedStreetDetail(null);
                                    onSelectHouseForMap(house);
                                  }}
                                  className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] cursor-pointer"
                                  title="Buka di Peta WebGIS"
                                >
                                  📍 Peta
                                </button>
                              )}
                              {onDeleteHouse && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Hapus titik rumah "${house.namaKepalaKeluarga}" (${house.namaJalan})?`)) {
                                      onDeleteHouse(house.id, house.namaKepalaKeluarga);
                                      setSelectedStreetDetail((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              houses: prev.houses.filter((h) => h.id !== house.id),
                                            }
                                          : null
                                      );
                                    }
                                  }}
                                  className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                                  title="Hapus Titik Rumah Ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">
                Kelurahan Mangga, Kecamatan Medan Tuntungan
              </span>
              <button
                type="button"
                onClick={() => setSelectedStreetDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
