import React, { useState, useEffect, useRef, useMemo } from 'react';
import JSZip from 'jszip';
import type * as LTypes from 'leaflet';
import * as LeafletModule from 'leaflet';
import { fetchAllReports } from '../lib/reportsApi';
import { extractNomorLingkungan } from '../lib/formatter';

// Resilient Leaflet resolver (supports global window.L, default export, or module namespace)
const getL = (): any => {
  if (typeof window !== 'undefined' && (window as any).L && typeof (window as any).L.map === 'function') {
    return (window as any).L;
  }
  if ((LeafletModule as any)?.default && typeof (LeafletModule as any).default.map === 'function') {
    return (LeafletModule as any).default;
  }
  if ((LeafletModule as any)?.map && typeof (LeafletModule as any).map === 'function') {
    return LeafletModule;
  }
  return (typeof window !== 'undefined' ? (window as any).L : null) || LeafletModule;
};

import {
  MapPin,
  Layers,
  Search,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  Compass,
  Filter,
  Users,
  Home,
  FileSpreadsheet,
  Printer,
  Upload,
  Download,
  Info,
  ChevronRight,
  Shield,
  Eye,
  RefreshCw,
  Navigation,
  CornerDownRight,
  Sliders,
  DollarSign,
  HeartHandshake,
} from 'lucide-react';
import {
  UserAccount,
  LingkunganPolygon,
  TitikRumahBangunan,
  RuasJalanLingkungan,
  StatusWrs,
  StatusPbb,
  KondisiJalanType,
  KondisiDrainaseType,
} from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';
import {
  KELURAHAN_MANGGA_CENTER,
  DEFAULT_MAP_ZOOM,
  LINGKUNGAN_COLORS,
  KELURAHAN_MANGGA_BOUNDARY,
} from '../data/defaultGeoData';
import {
  fetchAllPolygons,
  savePolygonToFirestore,
  deleteAllPolygons,
  fetchAllHouses,
  saveHouseToFirestore,
  deleteHouseFromFirestore,
  fetchAllRoads,
  saveRoadToFirestore,
  deleteRoadFromFirestore,
  subscribeWebgisData,
  parseKmlPolygonCoordinates,
  parseAllKmlPolygons,
} from '../lib/webgisService';
import {
  parseCoordinatesFromInput,
  detectStreetAndGangOverlay,
  StreetOverlayResult,
} from '../lib/geoService';
import {
  getLocalSpptForYear,
  stripNonDigits,
  DEFAULT_PBB_YEAR,
  fetchPbbSpptFromFirestore,
} from '../lib/pbbService';
import { SpptPbbItem } from '../data/pbbSampleData';
import * as XLSX from 'xlsx';

interface PemetaanWilayahViewProps {
  currentUser: UserAccount;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  initialLingkunganFilter?: string;
}

export const PemetaanWilayahView: React.FC<PemetaanWilayahViewProps> = ({
  currentUser,
  onShowToast,
  initialLingkunganFilter,
}) => {
  const isKepling = currentUser.role === 'kepling';
  const isAdmin = currentUser.role === 'super_admin' || currentUser.role.startsWith('kasi_');
  const isBapenda = currentUser.role === 'petugas_bapenda';
  const userLingkunganNomor = currentUser.nomorLingkungan || 1;

  // Map DOM & Instance Refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LTypes.Map | null>(null);
  const polygonLayerGroupRef = useRef<LTypes.LayerGroup | null>(null);
  const houseMarkerLayerGroupRef = useRef<LTypes.LayerGroup | null>(null);
  const roadLayerGroupRef = useRef<LTypes.LayerGroup | null>(null);
  const drawingLayerGroupRef = useRef<LTypes.LayerGroup | null>(null);

  // Dynamic Leaflet object resolver
  const L = getL();

  // Base Data State
  const [polygons, setPolygons] = useState<LingkunganPolygon[]>([]);
  const [houses, setHouses] = useState<TitikRumahBangunan[]>([]);
  const [roads, setRoads] = useState<RuasJalanLingkungan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Map UI Settings
  const [baseMapType, setBaseMapType] = useState<'satellite' | 'streets'>('satellite');
  const [filterLingkungan, setFilterLingkungan] = useState<string>(
    initialLingkunganFilter || (isKepling ? currentUser.id : 'all')
  );

  useEffect(() => {
    if (initialLingkunganFilter) {
      setFilterLingkungan(initialLingkunganFilter);
    }
  }, [initialLingkunganFilter]);
  const [filterTheme, setFilterTheme] = useState<
    'ALL' | 'WRS' | 'PBB' | 'BANSOS' | 'JALAN' | 'HEATMAP' | 'FASUM' | 'IBADAH' | 'SEKOLAH' | 'FASKES' | 'SPBU' | 'USAHA'
  >('ALL');
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);

  useEffect(() => {
    setLoadingReports(true);
    fetchAllReports()
      .then((data) => {
        if (Array.isArray(data)) {
          setReports(data);
        }
      })
      .catch((err) => console.error('Error loading reports for heatmap:', err))
      .finally(() => setLoadingReports(false));
  }, []);

  const reportsCountByLingkungan = useMemo(() => {
    const counts = Array(25).fill(0);
    reports.forEach((report) => {
      if (!report) return;
      let lNum: number | null = null;
      if (report.jabatan) {
        lNum = extractNomorLingkungan(report.jabatan);
      }
      if (lNum === null && report.kinerja?.lingkungan) {
        lNum = extractNomorLingkungan(report.kinerja.lingkungan);
      }
      if (lNum === null && report.namaKepling) {
        const matchKepling = KEPLING_ACCOUNTS.find(
          k => k.nama.toLowerCase().trim() === report.namaKepling.toLowerCase().trim()
        );
        if (matchKepling && matchKepling.nomorLingkungan) {
          lNum = matchKepling.nomorLingkungan;
        }
      }
      if (lNum !== null && lNum >= 1 && lNum <= 24) {
        counts[lNum]++;
      }
    });
    return counts;
  }, [reports]);

  const getHeatmapColor = (count: number): string => {
    if (count === 0) return '#10b981'; // Green
    if (count <= 2) return '#eab308';  // Amber
    if (count <= 5) return '#f97316';  // Orange
    return '#ef4444';                  // Red
  };

  const [searchQuery, setSearchQuery] = useState('');

  // Selection & Modal States
  const [selectedPolygon, setSelectedPolygon] = useState<LingkunganPolygon | null>(null);
  const [selectedHouse, setSelectedHouse] = useState<TitikRumahBangunan | null>(null);
  const [selectedRoad, setSelectedRoad] = useState<RuasJalanLingkungan | null>(null);

  // Saving & Syncing Loading Status
  const [isSavingHouse, setIsSavingHouse] = useState(false);
  const [isSavingRoad, setIsSavingRoad] = useState(false);
  const [isSyncingWebgis, setIsSyncingWebgis] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);

  // Draw Polygon Mode
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [drawLingkunganId, setDrawLingkunganId] = useState<string>(
    isKepling ? currentUser.id : 'kepling_1'
  );
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);

  // Add House Form Modal
  const [isHouseModalOpen, setIsHouseModalOpen] = useState(false);
  const [isKmlTextModalOpen, setIsKmlTextModalOpen] = useState(false);
  const [kmlRawInputText, setKmlRawInputText] = useState('');
  const [editingHouse, setEditingHouse] = useState<TitikRumahBangunan | null>(null);
  const getEmptyHouseFormData = (lingkunganId?: string) => ({
    lingkunganId: lingkunganId || (isKepling ? currentUser.id : 'kepling_1'),
    namaJalan: '',
    nomorRumah: '',
    namaKepalaKeluarga: '',
    nikKk: '',
    isKkMangga: true,
    asalKk: 'Kelurahan Mangga',
    lat: '' as number | string,
    lng: '' as number | string,
    jumlahJiwa: '' as number | string,
    jumlahLakiLaki: '' as number | string,
    jumlahPerempuan: '' as number | string,
    jumlahLansia: '' as number | string,
    jumlahAnak: '' as number | string,
    pekerjaanKk: '',
    penerimaBansos: false,
    jenisBansos: [] as string[],
    desilBansos: '',
    kategoriRentan: false,
    statusWrs: 'AKTIF' as StatusWrs,
    tarifRetribusi: 15000,
    nopPbb: '',
    statusPbb: 'LUNAS' as StatusPbb,
    nominalPbb: '' as number | string,
    tahunPbb: '' as number | string,
    catatan: '',
    memilikiUsaha: false,
    jenisUsaha: 'Toko Kelontong / Sembako',
    namaUsaha: '',
    luasTanahM2: '' as number | string,
    luasBangunanM2: '' as number | string,
    kategoriBangunan: 'RUMAH_TINGGAL' as const,
    jenisFasilitas: '',
  });

  const [houseForm, setHouseForm] = useState<{
    lingkunganId: string;
    namaJalan: string;
    nomorRumah: string;
    namaKepalaKeluarga: string;
    nikKk: string;
    isKkMangga: boolean;
    asalKk: string;
    lat: number | string;
    lng: number | string;
    jumlahJiwa: number | string;
    jumlahLakiLaki: number | string;
    jumlahPerempuan: number | string;
    jumlahLansia: number | string;
    jumlahAnak: number | string;
    pekerjaanKk: string;
    penerimaBansos: boolean;
    jenisBansos: string[];
    desilBansos: string;
    kategoriRentan: boolean;
    statusWrs: StatusWrs;
    tarifRetribusi: number | string;
    nopPbb: string;
    statusPbb: StatusPbb;
    nominalPbb: number | string;
    tahunPbb: number | string;
    catatan: string;
    memilikiUsaha: boolean;
    jenisUsaha: string;
    namaUsaha: string;
    luasTanahM2: number | string;
    luasBangunanM2: number | string;
    kategoriBangunan: (
      'RUMAH_TINGGAL' |
      'RUMAH_USAHA' |
      'RUMAH_IBADAH' |
      'SEKOLAH' |
      'FASILITAS_KESEHATAN' |
      'SPBU_STASIUN' |
      'KANTOR_FASUM' |
      'RUANG_PUBLIK_TAMAN' |
      'PASAR_SARANA_EKONOMI'
    );
    jenisFasilitas: string;
  }>(() => getEmptyHouseFormData(isKepling ? currentUser.id : 'kepling_1'));

  const formatNopPbb = (val: string): string => {
    const digits = val.replace(/\D/g, '').slice(0, 18);
    let res = '';
    if (digits.length > 0) res += digits.slice(0, 2);
    if (digits.length >= 2) res += '.' + digits.slice(2, 4);
    if (digits.length >= 4) res += '.' + digits.slice(4, 7);
    if (digits.length >= 7) res += '.' + digits.slice(7, 10);
    if (digits.length >= 10) res += '.' + digits.slice(10, 13);
    if (digits.length >= 13) res += '-' + digits.slice(13, 17);
    if (digits.length >= 17) res += '.' + digits.slice(17, 18);
    return res;
  };

  // Realisasi SPPT PBB Items for Auto-matching NOP, Ketetapan, & Status Bayar
  const [pbbSpptList, setPbbSpptList] = useState<SpptPbbItem[]>(() => {
    return getLocalSpptForYear(DEFAULT_PBB_YEAR);
  });
  const [matchedPbbItem, setMatchedPbbItem] = useState<SpptPbbItem | null>(null);
  const [isPbbPickerOpen, setIsPbbPickerOpen] = useState(false);
  const [pbbPickerSearch, setPbbPickerSearch] = useState('');

  useEffect(() => {
    let isMounted = true;
    const l2026 = getLocalSpptForYear(2026);
    const l2025 = getLocalSpptForYear(2025);
    const combined = [...l2026, ...l2025.filter((i) => !l2026.some((j) => j.nop === i.nop))];
    if (combined.length > 0) {
      setPbbSpptList(combined);
    }
    fetchPbbSpptFromFirestore(DEFAULT_PBB_YEAR)
      .then((remote) => {
        if (isMounted && Array.isArray(remote) && remote.length > 0) {
          setPbbSpptList((prev) => {
            const merged = [...remote];
            prev.forEach((p) => {
              if (!merged.some((m) => m.nop === p.nop)) {
                merged.push(p);
              }
            });
            return merged;
          });
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered NOP suggestions for quick autocomplete
  const pbbNopSuggestions = useMemo(() => {
    const targetLingId = houseForm.lingkunganId;
    const lingNum = Number(targetLingId.replace(/\D/g, '')) || (isKepling ? currentUser.nomorLingkungan : undefined);
    let list = pbbSpptList;
    if (lingNum) {
      const lingFiltered = pbbSpptList.filter((i) => i.lingkungan === lingNum);
      if (lingFiltered.length > 0) list = lingFiltered;
    }
    return list;
  }, [pbbSpptList, houseForm.lingkunganId, isKepling, currentUser.nomorLingkungan]);

  const handleApplySpptToHouse = (sppt: SpptPbbItem) => {
    setMatchedPbbItem(sppt);
    const statusMap: StatusPbb = sppt.status === 'Sudah Bayar' ? 'LUNAS' : 'BELUM_LUNAS';
    setHouseForm((prev) => ({
      ...prev,
      nopPbb: formatNopPbb(sppt.nop),
      statusPbb: statusMap,
      nominalPbb: sppt.pbbTerutang || prev.nominalPbb,
      tahunPbb: prev.tahunPbb || DEFAULT_PBB_YEAR,
      namaKepalaKeluarga: prev.namaKepalaKeluarga.trim() ? prev.namaKepalaKeluarga : sppt.namaWp,
      namaJalan: prev.namaJalan.trim() ? prev.namaJalan : sppt.alamatOp,
    }));
    setIsPbbPickerOpen(false);
    onShowToast?.(`✅ Data PBB Terhubung: ${sppt.namaWp} (Status: ${sppt.status})`, 'success');
  };

  const handleNopPbbChange = (val: string) => {
    const formatted = formatNopPbb(val);
    const cleanDigits = stripNonDigits(val);

    let match: SpptPbbItem | undefined;
    if (cleanDigits.length >= 8) {
      match = pbbSpptList.find((item) => {
        const itemClean = stripNonDigits(item.nop);
        return itemClean === cleanDigits || (cleanDigits.length >= 10 && itemClean.endsWith(cleanDigits));
      });
    }

    setMatchedPbbItem(match || null);

    setHouseForm((prev) => {
      if (match) {
        const statusMap: StatusPbb = match.status === 'Sudah Bayar' ? 'LUNAS' : 'BELUM_LUNAS';
        return {
          ...prev,
          nopPbb: formatted,
          statusPbb: statusMap,
          nominalPbb: match.pbbTerutang || prev.nominalPbb,
          tahunPbb: prev.tahunPbb || DEFAULT_PBB_YEAR,
          namaKepalaKeluarga: prev.namaKepalaKeluarga.trim() ? prev.namaKepalaKeluarga : match.namaWp,
          namaJalan: prev.namaJalan.trim() ? prev.namaJalan : match.alamatOp,
        };
      }
      return {
        ...prev,
        nopPbb: formatted,
      };
    });
  };

  // Add Road Form Modal
  const [isRoadModalOpen, setIsRoadModalOpen] = useState(false);
  const [roadForm, setRoadForm] = useState<{
    lingkunganId: string;
    namaJalan: string;
    panjangMeter: number;
    lebarMeter: number;
    jenisPerkerasan: string;
    kondisiJalan: KondisiJalanType;
    kondisiDrainase: KondisiDrainaseType;
    lat: number;
    lng: number;
    catatan: string;
  }>({
    lingkunganId: isKepling ? currentUser.id : 'kepling_1',
    namaJalan: '',
    panjangMeter: 250,
    lebarMeter: 4.0,
    jenisPerkerasan: 'Aspal Hotmix',
    kondisiJalan: 'BAIK',
    kondisiDrainase: 'LANCAR',
    lat: KELURAHAN_MANGGA_CENTER[0],
    lng: KELURAHAN_MANGGA_CENTER[1],
    catatan: '',
  });

  // Google Maps / Leaflet Street & Gang Overlay Detection States
  const [googleMapsUrlInput, setGoogleMapsUrlInput] = useState('');
  const [isDetectingStreet, setIsDetectingStreet] = useState(false);
  const [detectedStreetOverlay, setDetectedStreetOverlay] = useState<
    (StreetOverlayResult & { lat: number; lng: number }) | null
  >(null);
  const [showStreetOverlayLayer, setShowStreetOverlayLayer] = useState(true);
  const [isPickingCoordinate, setIsPickingCoordinate] = useState(false);
  const streetOverlayLayerGroupRef = useRef<LTypes.LayerGroup | null>(null);

  // KML Import Input Ref
  const kmlInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Initial Data Fetch & Real-time Subscriptions
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      const [pList, hList, rList] = await Promise.all([
        fetchAllPolygons(),
        fetchAllHouses(),
        fetchAllRoads(),
      ]);
      if (isMounted) {
        setPolygons(pList);
        setHouses(hList);
        setRoads(rList);
        setIsLoading(false);
      }
    }
    loadData();

    const unsubscribe = subscribeWebgisData(
      (newP) => setPolygons(newP),
      (newH) => setHouses(newH),
      (newR) => setRoads(newR)
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent double init
    if (!L || typeof L.map !== 'function') {
      console.warn('Leaflet map engine not ready yet...');
      return;
    }

    try {
      // Clean up stale leaflet instance ID on container if present
      if ((mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }

      const map = L.map(mapContainerRef.current, {
        center: KELURAHAN_MANGGA_CENTER,
        zoom: DEFAULT_MAP_ZOOM,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Create Layer Groups
      const polyGroup = L.layerGroup().addTo(map);
      const roadGroup = L.layerGroup().addTo(map);
      const houseGroup = L.layerGroup().addTo(map);
      const drawGroup = L.layerGroup().addTo(map);
      const streetOverlayGroup = L.layerGroup().addTo(map);

      polygonLayerGroupRef.current = polyGroup;
      roadLayerGroupRef.current = roadGroup;
      houseMarkerLayerGroupRef.current = houseGroup;
      drawingLayerGroupRef.current = drawGroup;
      streetOverlayLayerGroupRef.current = streetOverlayGroup;

      mapInstanceRef.current = map;
    } catch (err) {
      console.error('Error initializing Leaflet map:', err);
    }

    return () => {
      try {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      } catch (err) {
        console.warn('Map cleanup error:', err);
      }
    };
  }, [L]);

  // 3. Tile Layer Switching (Satellite vs Streets + Street/Gang Overlay)
  const tileLayerRef = useRef<LTypes.TileLayer | null>(null);
  const labelLayerRef = useRef<LTypes.TileLayer | null>(null);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !L) return;

    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    if (labelLayerRef.current) map.removeLayer(labelLayerRef.current);

    if (baseMapType === 'satellite') {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Esri, Maxar, Earthstar Geographics',
          maxZoom: 19,
        }
      ).addTo(map);

      // High-contrast street, gang, and landmark labels overlay on satellite
      if (showStreetOverlayLayer) {
        labelLayerRef.current = L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
          {
            subdomains: 'abcd',
            maxZoom: 19,
          }
        ).addTo(map);
      }
    } else {
      tileLayerRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }
      ).addTo(map);
    }
  }, [baseMapType, showStreetOverlayLayer, L]);

  // 4. Map Click Handler (for Drawing Polygon or Picking Coordinate)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: any) => {
      const { lat, lng } = e.latlng;

      if (isDrawingPolygon) {
        setDrawnPoints((prev) => [...prev, [lat, lng]]);
      } else if (isPickingCoordinate) {
        const pickedLat = +lat.toFixed(6);
        const pickedLng = +lng.toFixed(6);
        setHouseForm((prev) => ({
          ...prev,
          lat: pickedLat,
          lng: pickedLng,
        }));
        setIsPickingCoordinate(false);
        setIsHouseModalOpen(true);
        handleAutoDetectStreet(pickedLat, pickedLng);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isDrawingPolygon, isPickingCoordinate]);

  // 4b. Render Detected Street & Gang Overlay Marker on Leaflet Map
  useEffect(() => {
    const group = streetOverlayLayerGroupRef.current;
    if (!group || !L) return;
    group.clearLayers();

    if (!detectedStreetOverlay) return;

    const { lat, lng, streetName, gangName, isGang, kelurahan, kecamatan, source } =
      detectedStreetOverlay;

    const overlayIcon = L.divIcon({
      className: 'street-overlay-pin',
      html: `
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: ${
            isGang ? 'rgba(217, 119, 6, 0.35)' : 'rgba(5, 150, 105, 0.35)'
          }; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="
            position: absolute;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: ${isGang ? '#d97706' : '#059669'};
            border: 2.5px solid #ffffff;
            box-shadow: 0 4px 10px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: white;
            cursor: pointer;
          ">
            ${isGang ? '🏘️' : '🛣️'}
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    const marker = L.marker([lat, lng], { icon: overlayIcon });

    const popupContent = `
      <div style="font-family: sans-serif; font-size: 12px; min-width: 210px; padding: 2px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 4px;">
          <span style="font-size: 9px; font-weight: 900; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; ${
            isGang ? 'background: #fef3c7; color: #92400e;' : 'background: #dcfce7; color: #166534;'
          }">
            ${isGang ? '🏘️ GANG / LORONG' : '🛣️ NAMA JALAN'}
          </span>
          <span style="font-size: 9px; color: #64748b; font-weight: bold;">
            ${source === 'openstreetmap' ? 'OpenStreetMap' : 'WebGIS Mangga'}
          </span>
        </div>
        <div style="font-size: 13px; font-weight: 900; color: #0f172a; margin-bottom: 2px;">
          ${streetName}
        </div>
        ${
          gangName && gangName !== streetName
            ? `<div style="font-size: 11px; color: #d97706; font-weight: 700; margin-bottom: 4px;">Cabang Gang: ${gangName}</div>`
            : ''
        }
        <div style="font-size: 10px; color: #475569; margin-top: 4px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
          📍 Koordinat: <b>${lat.toFixed(6)}, ${lng.toFixed(6)}</b>
        </div>
        <div style="font-size: 9px; color: #64748b;">
          ${kelurahan}, ${kecamatan}
        </div>
      </div>
    `;

    marker.bindPopup(popupContent).openPopup();
    group.addLayer(marker);
  }, [detectedStreetOverlay, L]);

  // 5. Render Drawing Polygon Preview
  useEffect(() => {
    const drawGroup = drawingLayerGroupRef.current;
    if (!drawGroup) return;
    drawGroup.clearLayers();

    if (!isDrawingPolygon || drawnPoints.length === 0) return;

    // Draw vertex markers
    drawnPoints.forEach((pt, i) => {
      const circle = L.circleMarker(pt, {
        radius: 6,
        fillColor: '#f59e0b',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 0.9,
      });
      circle.bindTooltip(`Titik ${i + 1}`, { permanent: false });
      drawGroup.addLayer(circle);
    });

    // Draw line or polygon
    if (drawnPoints.length > 2) {
      const poly = L.polygon(drawnPoints, {
        color: '#f59e0b',
        weight: 3,
        fillColor: '#f59e0b',
        fillOpacity: 0.35,
        dashArray: '6, 6',
      });
      drawGroup.addLayer(poly);
    } else if (drawnPoints.length === 2) {
      const line = L.polyline(drawnPoints, {
        color: '#f59e0b',
        weight: 3,
        dashArray: '6, 6',
      });
      drawGroup.addLayer(line);
    }
  }, [isDrawingPolygon, drawnPoints]);

  // 6. Render Polygons (24 Lingkungan)
  useEffect(() => {
    const polyGroup = polygonLayerGroupRef.current;
    const map = mapInstanceRef.current;
    if (!polyGroup || !map) return;
    polyGroup.clearLayers();

    // Render Kelurahan Mangga Outer Boundary Perimeter
    if (KELURAHAN_MANGGA_BOUNDARY && KELURAHAN_MANGGA_BOUNDARY.length >= 3) {
      const kelurahanBoundaryShape = L.polygon(KELURAHAN_MANGGA_BOUNDARY, {
        color: '#1e3a8a', // Dark Blue Kelurahan Border
        weight: 3.5,
        opacity: 0.9,
        dashArray: '8, 8',
        fillColor: '#3b82f6',
        fillOpacity: 0.05,
      });
      kelurahanBoundaryShape.bindTooltip(
        `<div class="font-sans font-black text-xs text-blue-900 bg-blue-50 px-2 py-1 rounded shadow">BATA KELURAHAN MANGGA</div>`,
        { sticky: true, direction: 'center', className: 'kelurahan-tooltip' }
      );
      polyGroup.addLayer(kelurahanBoundaryShape);
    }

    const filtered = polygons.filter((p) => {
      if (filterLingkungan !== 'all' && p.lingkunganId !== filterLingkungan) {
        return false;
      }
      return true;
    });

    filtered.forEach((poly) => {
      if (!poly.coordinates || poly.coordinates.length < 3) return;

      const isCurrentSelected = selectedPolygon?.id === poly.id;
      
      const lkNum = parseInt(poly.lingkunganId, 10) || 0;
      const count = reportsCountByLingkungan[lkNum] || 0;
      const isHeatmapMode = filterTheme === 'HEATMAP';
      
      const polyColor = isHeatmapMode ? getHeatmapColor(count) : (poly.color || '#10b981');
      const polyFillOpacity = isHeatmapMode 
        ? (isCurrentSelected ? 0.8 : 0.55) 
        : (isCurrentSelected ? 0.45 : 0.2);

      const polygonShape = L.polygon(poly.coordinates, {
        color: isCurrentSelected ? '#ffffff' : polyColor,
        weight: isCurrentSelected ? 4 : 2.5,
        opacity: 0.95,
        fillColor: polyColor,
        fillOpacity: polyFillOpacity,
      });

      // Tooltip label
      const tooltipContent = isHeatmapMode
        ? `<div class="font-sans font-black text-xs text-slate-950">${String(poly.lingkunganNama || '').toUpperCase()}</div>
           <div class="text-[10px] text-red-700 font-black bg-red-50 border border-red-200 px-2 py-0.5 rounded shadow-2xs mt-1 flex items-center gap-1">
             🔥 <span>${count} Kejadian Laporan</span>
           </div>`
        : `<div class="font-sans font-black text-xs text-slate-900">${String(poly.lingkunganNama || '').toUpperCase()}</div>
           <div class="text-[10px] text-slate-600 font-semibold">${poly.keplingNama || ''}</div>`;

      polygonShape.bindTooltip(
        tooltipContent,
        {
          sticky: true,
          direction: 'top',
          className: 'custom-map-tooltip',
        }
      );

      // On Click: Select Polygon and focus
      polygonShape.on('click', () => {
        setSelectedPolygon(poly);
        setSelectedHouse(null);
        setSelectedRoad(null);
      });

      polyGroup.addLayer(polygonShape);
    });
  }, [polygons, filterLingkungan, selectedPolygon, filterTheme, reportsCountByLingkungan]);

  // 7. Render Roads (Ruas Jalan & Kondisi)
  useEffect(() => {
    const roadGroup = roadLayerGroupRef.current;
    if (!roadGroup) return;
    roadGroup.clearLayers();

    if (filterTheme === 'WRS' || filterTheme === 'BANSOS' || filterTheme === 'PBB') return; // Hide when specific focus

    const filtered = roads.filter((r) => {
      if (filterLingkungan !== 'all' && r.lingkunganId !== filterLingkungan) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return r.namaJalan.toLowerCase().includes(q);
      }
      return true;
    });

    filtered.forEach((road) => {
      let strokeColor = '#10b981'; // Baik (Green)
      if (road.kondisiJalan === 'RUSAK_SEDANG') strokeColor = '#f59e0b'; // Amber
      if (road.kondisiJalan === 'RUSAK_BERAT') strokeColor = '#ef4444'; // Red

      if (road.garisKoordinat && road.garisKoordinat.length >= 2) {
        const line = L.polyline(road.garisKoordinat, {
          color: strokeColor,
          weight: 5,
          opacity: 0.85,
        });

        line.bindTooltip(
          `<b>${road.namaJalan}</b><br/>P:${road.panjangMeter}m | L:${road.lebarMeter}m<br/>Kondisi: ${road.kondisiJalan}`,
          { sticky: true }
        );

        line.on('click', () => {
          setSelectedRoad(road);
          setSelectedHouse(null);
        });

        roadGroup.addLayer(line);
      } else if (road.titikKoordinat) {
        // Point marker representation
        const marker = L.circleMarker(road.titikKoordinat, {
          radius: 7,
          fillColor: strokeColor,
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.9,
        });

        marker.bindTooltip(`🛣️ <b>${road.namaJalan}</b> (${road.kondisiJalan})`, { sticky: true });
        marker.on('click', () => {
          setSelectedRoad(road);
          setSelectedHouse(null);
        });

        roadGroup.addLayer(marker);
      }
    });
  }, [roads, filterLingkungan, filterTheme, searchQuery]);

  // 8. Render Houses (Titik Rumah, WRS, PBB, Bansos)
  useEffect(() => {
    const houseGroup = houseMarkerLayerGroupRef.current;
    if (!houseGroup) return;
    houseGroup.clearLayers();

    if (filterTheme === 'JALAN') return;

    const filtered = houses.filter((h) => {
      const latNum = Number(String(h.lat || '').replace(',', '.'));
      const lngNum = Number(String(h.lng || '').replace(',', '.'));
      if (isNaN(latNum) || isNaN(lngNum) || latNum === 0 || lngNum === 0) return false;

      // Robust Lingkungan Filter matching
      const filterNum = extractNomorLingkungan(filterLingkungan);
      const houseNum = h.lingkunganNomor || extractNomorLingkungan(h.lingkunganId);
      const isLingMatch =
        filterLingkungan === 'all' ||
        h.lingkunganId === filterLingkungan ||
        (filterNum !== null && houseNum === filterNum);

      // Allow public facilities like Kantor Lurah, Puskesmas, SPBU, Gereja, Sekolah, Taman to show across filters
      const isSelected = selectedHouse && selectedHouse.id === h.id;
      const isChurchOrFasum =
        isSelected ||
        h.kategoriBangunan === 'KANTOR_FASUM' ||
        h.kategoriBangunan === 'FASILITAS_KESEHATAN' ||
        h.kategoriBangunan === 'SPBU_STASIUN' ||
        h.kategoriBangunan === 'RUMAH_IBADAH' ||
        h.kategoriBangunan === 'SEKOLAH' ||
        h.kategoriBangunan === 'RUANG_PUBLIK_TAMAN' ||
        h.kategoriBangunan === 'PASAR_SARANA_EKONOMI' ||
        h.kategoriBangunan === 'RUMAH_USAHA' ||
        (h.namaKepalaKeluarga && /kantor|lurah|puskesmas|pustu|spbu|pertashop|posyandu|poskamling|gereja|masjid|mushola|vihara|pura|klenteng|sekolah|universitas|kampus|perguruan|akademi|stikes|politeknik|yayasan|pasar|atm|bank|faskes/i.test(h.namaKepalaKeluarga)) ||
        (h.jenisFasilitas && /kantor|lurah|puskesmas|pustu|spbu|pertashop|posyandu|poskamling|gereja|masjid|mushola|vihara|pura|klenteng|sekolah|universitas|kampus|perguruan|akademi|stikes|politeknik|yayasan|pasar|atm|bank|faskes/i.test(h.jenisFasilitas)) ||
        (h.catatan && /kantor|lurah|puskesmas|pustu|spbu|pertashop|posyandu|poskamling|gereja|masjid|mushola|vihara|pura|klenteng|sekolah|universitas|kampus|perguruan|akademi|stikes|politeknik|yayasan|pasar|atm|bank|faskes/i.test(h.catatan));

      if (filterLingkungan !== 'all' && !isLingMatch && !isChurchOrFasum) return false;

      // Theme-specific filters
      if (filterTheme === 'WRS' && !h.statusWrs && !isChurchOrFasum) return false;
      if (filterTheme === 'BANSOS' && !h.penerimaBansos && !isChurchOrFasum) return false;
      if (filterTheme === 'PBB' && !h.statusPbb && !isChurchOrFasum) return false;

      const cat = h.kategoriBangunan;
      const nameLower = (h.namaKepalaKeluarga || '').toLowerCase();
      const jfLower = (h.jenisFasilitas || '').toLowerCase();

      if (filterTheme === 'IBADAH') {
        if (cat !== 'RUMAH_IBADAH' && !/\b(masjid|mushola|musala|gereja|vihara|pura|klenteng)\b/i.test(nameLower) && !/\b(masjid|mushola|musala|gereja|vihara|pura|klenteng)\b/i.test(jfLower)) return false;
      }
      if (filterTheme === 'FASKES') {
        if (cat !== 'FASILITAS_KESEHATAN' && !/\b(puskesmas|pustu|posyandu|klinik|faskes|kesehatan|apotek|apotik|rsud|rumah sakit|poliklinik|bidan)\b/i.test(nameLower) && !/\b(puskesmas|pustu|posyandu|klinik|faskes|kesehatan|apotek|apotik|rsud|rumah sakit|poliklinik|bidan)\b/i.test(jfLower)) return false;
      }
      if (filterTheme === 'SEKOLAH') {
        if (cat !== 'SEKOLAH' && !/\b(sekolah|sd|smp|sma|smk|tk|paud|universitas|kampus|madrasah|pesantren|akademi|politeknik|bimbel)\b/i.test(nameLower) && !/\b(sekolah|sd|smp|sma|smk|tk|paud|universitas|kampus|madrasah|pesantren|akademi|politeknik|bimbel)\b/i.test(jfLower)) return false;
      }
      if (filterTheme === 'SPBU') {
        if (cat !== 'SPBU_STASIUN' && !/spbu|pertashop/i.test(nameLower) && !/spbu|pertashop/i.test(jfLower)) return false;
      }
      if (filterTheme === 'FASUM') {
        if (cat !== 'KANTOR_FASUM' && cat !== 'RUANG_PUBLIK_TAMAN' && !/kantor|lurah|balai|poskamling|taman/i.test(nameLower) && !/kantor|lurah|balai|poskamling|taman/i.test(jfLower)) return false;
      }
      if (filterTheme === 'USAHA') {
        if (cat !== 'PASAR_SARANA_EKONOMI' && cat !== 'RUMAH_USAHA' && !h.memilikiUsaha && !/pasar|bank|atm|toko|warung|minimarket|usah/i.test(nameLower)) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          h.namaKepalaKeluarga.toLowerCase().includes(q) ||
          h.namaJalan.toLowerCase().includes(q) ||
          h.nomorRumah.toLowerCase().includes(q) ||
          (h.nopPbb && h.nopPbb.toLowerCase().includes(q)) ||
          (h.jenisFasilitas && h.jenisFasilitas.toLowerCase().includes(q)) ||
          (h.namaUsaha && h.namaUsaha.toLowerCase().includes(q)) ||
          (h.catatan && h.catatan.toLowerCase().includes(q)) ||
          (h.kategoriBangunan && h.kategoriBangunan.toLowerCase().includes(q)) ||
          (h.asalKk && h.asalKk.toLowerCase().includes(q))
        );
      }
      return true;
    });

    filtered.forEach((h) => {
      // Determine Icon and Color based on active theme or building category
      let markerColor = '#10b981'; // Green default
      let iconSymbol = '🏠';

      if (
        h.kategoriBangunan === 'KANTOR_FASUM' ||
        (h.namaKepalaKeluarga && h.namaKepalaKeluarga.toLowerCase().includes('kantor lurah'))
      ) {
        markerColor = '#1e3a8a'; // Dark Navy Blue for Kantor Lurah & Fasilitas Umum
        iconSymbol = '🏢';
      } else if (h.kategoriBangunan === 'FASILITAS_KESEHATAN') {
        markerColor = '#e11d48'; // Red / Rose for Puskesmas, Pustu, Posyandu, Klinik
        iconSymbol = '🏥';
      } else if (h.kategoriBangunan === 'SPBU_STASIUN') {
        markerColor = '#ea580c'; // Orange for SPBU & Pertashop
        iconSymbol = '⛽';
      } else if (h.kategoriBangunan === 'RUMAH_IBADAH') {
        markerColor = '#0d9488'; // Teal for House of Worship
        iconSymbol = h.jenisFasilitas?.toLowerCase().includes('masjid') || h.jenisFasilitas?.toLowerCase().includes('mushola') ? '🕌' : '⛪';
      } else if (h.kategoriBangunan === 'SEKOLAH') {
        markerColor = '#2563eb'; // Blue for Schools
        iconSymbol = '🏫';
      } else if (h.kategoriBangunan === 'RUANG_PUBLIK_TAMAN') {
        markerColor = '#16a34a'; // Emerald Green for Parks / Poskamling
        iconSymbol = h.jenisFasilitas?.toLowerCase().includes('poskamling') || h.jenisFasilitas?.toLowerCase().includes('ronda') ? '🛡️' : '🛝';
      } else if (h.kategoriBangunan === 'PASAR_SARANA_EKONOMI') {
        markerColor = '#9333ea'; // Purple for Markets / Bank / ATM
        iconSymbol = '🛒';
      } else if (h.kategoriBangunan === 'RUMAH_USAHA') {
        markerColor = '#d97706'; // Amber for Business
        iconSymbol = '🏪';
      } else if (filterTheme === 'PBB') {
        if (h.statusPbb === 'LUNAS') {
          markerColor = '#059669'; // Emerald
          iconSymbol = '🏛️';
        } else if (h.statusPbb === 'BEBAS_PAJAK') {
          markerColor = '#0284c7'; // Sky blue
          iconSymbol = 'ℹ️';
        } else {
          markerColor = '#dc2626'; // Red for Belum Lunas
          iconSymbol = '⚠️';
        }
      } else if (filterTheme === 'WRS') {
        if (h.statusWrs === 'BELUM_MENOLAK') {
          markerColor = '#ef4444';
          iconSymbol = '⚠️';
        } else {
          markerColor = '#10b981';
          iconSymbol = '🗑️';
        }
      } else if (filterTheme === 'BANSOS') {
        markerColor = '#8b5cf6';
        iconSymbol = '🎁';
      } else {
        // Mode 'ALL'
        if (h.statusWrs === 'BELUM_MENOLAK') {
          markerColor = '#ef4444'; // Red for Belum WRS
          iconSymbol = '⚠️';
        } else if (h.penerimaBansos) {
          markerColor = '#8b5cf6'; // Purple for Bansos
          iconSymbol = '🎁';
        } else if (h.statusPbb === 'BELUM_LUNAS') {
          markerColor = '#f59e0b'; // Amber if PBB Belum
          iconSymbol = '🏠';
        } else {
          markerColor = '#10b981';
          iconSymbol = '🏠';
        }
      }

      const customIcon = L.divIcon({
        className: 'custom-house-pin',
        html: `
          <div style="
            background-color: ${markerColor};
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            cursor: pointer;
            transition: transform 0.2s;
          " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1.0)'">
            ${iconSymbol}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([h.lat, h.lng], { icon: customIcon });

      const isRes = !h.kategoriBangunan || h.kategoriBangunan === 'RUMAH_TINGGAL' || h.kategoriBangunan === 'RUMAH_USAHA';

      marker.bindTooltip(
        `
        <div style="font-family: sans-serif; font-size: 11px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
            <div style="font-weight: bold; color: #1e293b;">${h.namaKepalaKeluarga} (${h.nomorRumah})</div>
            <span style="font-size: 9px; font-weight: bold; padding: 1px 5px; border-radius: 4px; ${isRes ? (h.isKkMangga !== false ? 'background: #dcfce7; color: #166534;' : 'background: #fef3c7; color: #92400e;') : 'background: #f3e8ff; color: #6b21a8;'}">
              ${isRes ? (h.isKkMangga !== false ? 'KK Mangga' : 'KK Luar') : 'Fasilitas / Usaha'}
            </span>
          </div>
          <div style="color: #64748b;">${h.namaJalan}</div>
          <div style="color: #334155; font-size: 10px; margin-top: 1px;">
            👥 <b>${h.jumlahJiwa || (h.jumlahLakiLaki || 0) + (h.jumlahPerempuan || 0)} Jiwa</b> (${h.jumlahLakiLaki || 0}L / ${h.jumlahPerempuan || 0}P)
          </div>
          <div style="margin-top: 3px; font-weight: 600;">
            WRS: <span style="color: ${h.statusWrs === 'AKTIF' ? '#059669' : h.statusWrs === 'BEBAS_WRS' ? '#0284c7' : h.statusWrs === 'MANDIRI' ? '#d97706' : '#dc2626'}">${h.statusWrs === 'BEBAS_WRS' ? 'BEBAS WRS' : h.statusWrs || 'AKTIF'}</span> | 
            PBB: <span style="color: ${h.statusPbb === 'LUNAS' ? '#059669' : '#dc2626'}">${h.statusPbb || 'BELUM_LUNAS'}</span>
          </div>
          ${h.nopPbb ? `<div style="color: #475569; font-size: 10px; margin-top: 2px;">NOP: <b>${h.nopPbb}</b> (Rp ${(h.nominalPbb || 0).toLocaleString('id-ID')})</div>` : ''}
          ${h.penerimaBansos ? `<div style="color: #7c3aed; font-size: 10px; font-weight: bold; margin-top: 2px;">🎁 Bansos: ${h.jenisBansos?.join(', ') || 'Ya'}</div>` : ''}
        </div>
      `,
        { sticky: true, direction: 'top' }
      );

      marker.on('click', () => {
        setSelectedHouse(h);
        setSelectedRoad(null);
      });

      houseGroup.addLayer(marker);
    });
  }, [houses, filterLingkungan, filterTheme, searchQuery]);

  // Auto-fly map camera to selected house location
  useEffect(() => {
    if (selectedHouse && selectedHouse.lat && selectedHouse.lng && mapInstanceRef.current) {
      const lat = Number(selectedHouse.lat);
      const lng = Number(selectedHouse.lng);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        mapInstanceRef.current.flyTo([lat, lng], 18, { animate: true, duration: 1 });
      }
    }
  }, [selectedHouse]);

  // 9. Statistics Roll-up Calculations
  const stats = useMemo(() => {
    const activeHouses = houses.filter(
      (h) => filterLingkungan === 'all' || h.lingkunganId === filterLingkungan
    );
    const activeRoads = roads.filter(
      (r) => filterLingkungan === 'all' || r.lingkunganId === filterLingkungan
    );

    const activeResidential = activeHouses.filter(
      (h) => !h.kategoriBangunan || h.kategoriBangunan === 'RUMAH_TINGGAL' || h.kategoriBangunan === 'RUMAH_USAHA'
    );
    const totalKk = activeResidential.length;
    const totalKkMangga = activeResidential.filter((h) => h.isKkMangga !== false).length;
    const totalKkLuar = activeResidential.filter((h) => h.isKkMangga === false).length;
    const totalJiwa = activeHouses.reduce((acc, h) => acc + (h.jumlahJiwa || (h.jumlahLakiLaki || 0) + (h.jumlahPerempuan || 0)), 0);
    const totalLaki = activeHouses.reduce((acc, h) => acc + (h.jumlahLakiLaki || 0), 0);
    const totalPerempuan = activeHouses.reduce((acc, h) => acc + (h.jumlahPerempuan || 0), 0);
    const totalLansia = activeHouses.reduce((acc, h) => acc + (h.jumlahLansia || 0), 0);
    const totalAnak = activeHouses.reduce((acc, h) => acc + (h.jumlahAnak || 0), 0);

    const wrsAktif = activeHouses.filter((h) => h.statusWrs === 'AKTIF').length;
    const wrsBelum = activeHouses.filter((h) => h.statusWrs === 'BELUM_MENOLAK').length;
    const wrsPersen = totalKk > 0 ? Math.round((wrsAktif / totalKk) * 100) : 0;

    // PBB Statistics
    const pbbLunasKk = activeHouses.filter((h) => h.statusPbb === 'LUNAS').length;
    const pbbBelumKk = activeHouses.filter((h) => h.statusPbb === 'BELUM_LUNAS' || !h.statusPbb).length;
    const pbbBebasKk = activeHouses.filter((h) => h.statusPbb === 'BEBAS_PAJAK').length;
    const pbbNominalLunas = activeHouses
      .filter((h) => h.statusPbb === 'LUNAS')
      .reduce((acc, h) => acc + (h.nominalPbb || 0), 0);
    const pbbNominalTarget = activeHouses.reduce((acc, h) => acc + (h.nominalPbb || 0), 0);
    const pbbPersen = totalKk > 0 ? Math.round((pbbLunasKk / totalKk) * 100) : 0;

    const bansosKk = activeHouses.filter((h) => h.penerimaBansos).length;

    // Public Facilities & Infrastructure Breakdown
    let totalMasjid = 0;
    let totalGereja = 0;
    let totalSekolah = 0;
    let totalFaskes = 0;
    let totalSpbu = 0;
    let totalKantorFasum = 0;
    let totalRuangPublik = 0;
    let totalPasarUsaha = 0;
    let totalFasilitasPublik = 0;

    activeHouses.forEach((h) => {
      const cat = h.kategoriBangunan;
      const nameLower = (h.namaKepalaKeluarga || '').toLowerCase();
      const jfLower = (h.jenisFasilitas || '').toLowerCase();

      if (
        cat === 'FASILITAS_KESEHATAN' ||
        /puskesmas|pustu|posyandu|klinik|faskes|kesehatan|apotek|rumah sakit|rsud|bidan/i.test(nameLower) ||
        /puskesmas|pustu|posyandu|klinik|faskes|kesehatan|apotek|rumah sakit|rsud|bidan/i.test(jfLower)
      ) {
        totalFasilitasPublik++;
        totalFaskes++;
      } else if (
        cat === 'SEKOLAH' ||
        /\b(sekolah|sd|smp|sma|smk|tk|paud|universitas|kampus|madrasah|pesantren|akademi|politeknik)\b/i.test(nameLower) ||
        /\b(sekolah|sd|smp|sma|smk|tk|paud|universitas|kampus|madrasah|pesantren|akademi|politeknik)\b/i.test(jfLower)
      ) {
        totalFasilitasPublik++;
        totalSekolah++;
      } else if (
        cat === 'RUMAH_IBADAH' ||
        /masjid|mushola|gereja|vihara|pura|klenteng/i.test(nameLower) ||
        /masjid|mushola|gereja|vihara|pura|klenteng/i.test(jfLower)
      ) {
        totalFasilitasPublik++;
        if (/masjid|mushola/i.test(nameLower) || /masjid|mushola/i.test(jfLower)) {
          totalMasjid++;
        } else {
          totalGereja++;
        }
      } else if (
        cat === 'SPBU_STASIUN' ||
        /spbu|pertashop|pertamina/i.test(nameLower) ||
        /spbu|pertashop|pertamina/i.test(jfLower)
      ) {
        totalFasilitasPublik++;
        totalSpbu++;
      } else if (
        cat === 'KANTOR_FASUM' ||
        /kantor|lurah|balai|pelayanan|poskamling/i.test(nameLower) ||
        /kantor|lurah|balai|pelayanan|poskamling/i.test(jfLower)
      ) {
        totalFasilitasPublik++;
        totalKantorFasum++;
      } else if (
        cat === 'RUANG_PUBLIK_TAMAN' ||
        /taman|lapangan|futsal|ronda/i.test(nameLower) ||
        /taman|lapangan|futsal|ronda/i.test(jfLower)
      ) {
        totalFasilitasPublik++;
        totalRuangPublik++;
      } else if (
        cat === 'PASAR_SARANA_EKONOMI' ||
        cat === 'RUMAH_USAHA' ||
        h.memilikiUsaha ||
        /pasar|bank|atm|toko|warung|minimarket|usah/i.test(nameLower)
      ) {
        totalPasarUsaha++;
        if (cat !== 'RUMAH_USAHA') totalFasilitasPublik++;
      }
    });

    const totalPanjangJalan = activeRoads.reduce((acc, r) => acc + (r.panjangMeter || 0), 0);
    const jalanBaik = activeRoads.filter((r) => r.kondisiJalan === 'BAIK').length;
    const jalanRusak = activeRoads.filter(
      (r) => r.kondisiJalan === 'RUSAK_SEDANG' || r.kondisiJalan === 'RUSAK_BERAT'
    ).length;

    return {
      totalKk,
      totalKkMangga,
      totalKkLuar,
      totalJiwa,
      totalLaki,
      totalPerempuan,
      totalLansia,
      totalAnak,
      wrsAktif,
      wrsBelum,
      wrsPersen,
      pbbLunasKk,
      pbbBelumKk,
      pbbBebasKk,
      pbbNominalLunas,
      pbbNominalTarget,
      pbbPersen,
      bansosKk,
      totalFasilitasPublik,
      totalMasjid,
      totalGereja,
      totalSekolah,
      totalFaskes,
      totalSpbu,
      totalKantorFasum,
      totalRuangPublik,
      totalPasarUsaha,
      totalPanjangJalan,
      jalanBaik,
      jalanRusak,
      totalJalan: activeRoads.length,
    };
  }, [houses, roads, filterLingkungan]);

  // Handler: Start Polygon Drawing
  const handleStartDrawPolygon = (lingkunganIdToDraw: string) => {
    setIsDrawingPolygon(true);
    setDrawLingkunganId(lingkunganIdToDraw);
    setDrawnPoints([]);
    onShowToast?.(
      'Mode gambar aktif: Ketuk titik-titik batas sudut di atas peta satelit.',
      'info'
    );
  };

  // Handler: Save Drawn Polygon
  const handleSaveDrawnPolygon = async () => {
    if (drawnPoints.length < 3) {
      alert('Minimal 3 titik koordinat diperlukan untuk membentuk poligon tertutup.');
      return;
    }

    const acc = KEPLING_ACCOUNTS.find((a) => a.id === drawLingkunganId);
    const lkNomor = acc?.nomorLingkungan || 1;
    const lkNama = acc?.lingkungan || `Lingkungan ${lkNomor}`;
    const kpNama = acc?.nama || 'Kepala Lingkungan';

    const closedCoords: [number, number][] = [...drawnPoints, drawnPoints[0]];

    const newPolygon: LingkunganPolygon = {
      id: `poly_${drawLingkunganId}`,
      lingkunganId: drawLingkunganId,
      lingkunganNomor: lkNomor,
      lingkunganNama: lkNama,
      keplingNama: kpNama,
      coordinates: closedCoords,
      color: LINGKUNGAN_COLORS[(lkNomor - 1) % LINGKUNGAN_COLORS.length],
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.nama,
    };

    await savePolygonToFirestore(newPolygon);
    setIsDrawingPolygon(false);
    setDrawnPoints([]);
    onShowToast?.(`Batas wilayah ${lkNama} berhasil disimpan permanen!`, 'success');
  };

  // Handler: Reset / Delete All Polygons to redraw
  const handleResetAllPolygons = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus SEMUA batas poligon lingkungan yang ada agar dapat digambar ulang dari awal?')) {
      return;
    }
    await deleteAllPolygons();
    setPolygons([]);
    onShowToast?.('Semua batas poligon berhasil dihapus. Silakan gambar ulang batas wilayah yang benar.', 'success');
  };

  // Helper: Process and save multi-polygon KML items
  const processAndSaveKmlItems = async (kmlText: string, sourceLabel: string) => {
    const items = parseAllKmlPolygons(kmlText);
    if (!items || items.length === 0) {
      alert('Gagal membaca koordinat poligon dari KML. Pastikan file berisi elemen <Polygon><coordinates>.');
      return;
    }

    let importedCount = 0;
    let firstCoords: [number, number][] | null = null;

    for (const item of items) {
      const numMatch = item.name.match(/(?:lingkungan|lingk|ling)?\s*0*([1-9]|1[0-9]|2[0-4])/i);
      let targetAcc = numMatch ? KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === parseInt(numMatch[1], 10)) : undefined;

      if (!targetAcc) {
        targetAcc = isKepling ? KEPLING_ACCOUNTS.find((k) => k.id === currentUser.id) : KEPLING_ACCOUNTS[importedCount % KEPLING_ACCOUNTS.length];
      }

      if (!targetAcc) continue;

      const newPolygon: LingkunganPolygon = {
        id: `poly_${targetAcc.id}`,
        lingkunganId: targetAcc.id,
        lingkunganNomor: targetAcc.nomorLingkungan || (importedCount + 1),
        lingkunganNama: targetAcc.lingkungan,
        keplingNama: targetAcc.nama,
        coordinates: item.coordinates,
        color: LINGKUNGAN_COLORS[((targetAcc.nomorLingkungan || 1) - 1) % LINGKUNGAN_COLORS.length],
        updatedAt: new Date().toISOString(),
        updatedBy: `${currentUser.nama} (${sourceLabel})`,
      };

      await savePolygonToFirestore(newPolygon);
      importedCount++;

      if (!firstCoords && item.coordinates.length >= 3) {
        firstCoords = item.coordinates;
      }
    }

    const updatedList = await fetchAllPolygons();
    setPolygons(updatedList);

    if (firstCoords && mapInstanceRef.current) {
      const bounds = L.latLngBounds(firstCoords.map((c) => [c[0], c[1]]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30] });
    }

    onShowToast?.(`Berhasil memuat dan menyimpan ${importedCount} batas wilayah lingkungan (${sourceLabel})!`, 'success');
  };

  // Handler: Import KML / KMZ File
  const handleImportKML = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let kmlText = '';
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.kmz')) {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        const kmlFileName = Object.keys(zipContent.files).find((fn) => fn.toLowerCase().endsWith('.kml'));
        if (kmlFileName) {
          kmlText = await zipContent.files[kmlFileName].async('text');
        } else {
          alert('File KMZ tidak berisi file .kml di dalamnya.');
          return;
        }
      } else {
        kmlText = await file.text();
      }

      await processAndSaveKmlItems(kmlText, 'KML/KMZ Upload');
    } catch (err) {
      alert('Terjadi kesalahan saat memproses file: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Handler: Import KML from pasted text
  const handleImportKmlText = async () => {
    if (!kmlRawInputText.trim()) {
      alert('Silakan tempel (paste) kode KML atau GeoJSON terlebih dahulu.');
      return;
    }
    try {
      await processAndSaveKmlItems(kmlRawInputText, 'KML Text Paste');
      setIsKmlTextModalOpen(false);
      setKmlRawInputText('');
    } catch (err) {
      alert('Terjadi kesalahan saat memproses teks: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Handler: Automatic Street & Gang Overlay Detection
  const handleAutoDetectStreet = async (targetLat?: number, targetLng?: number) => {
    const lat = targetLat !== undefined ? targetLat : houseForm.lat;
    const lng = targetLng !== undefined ? targetLng : houseForm.lng;

    if (!lat || !lng) {
      onShowToast?.('Silakan tentukan koordinat Latitude dan Longitude terlebih dahulu', 'error');
      return;
    }

    setIsDetectingStreet(true);
    try {
      const result = await detectStreetAndGangOverlay(lat, lng);
      setDetectedStreetOverlay({ ...result, lat, lng });

      // Automatically populate namaJalan if empty or default placeholder
      if (
        !houseForm.namaJalan.trim() ||
        houseForm.namaJalan.toLowerCase().includes('titik') ||
        houseForm.namaJalan.toLowerCase().includes('verifikasi')
      ) {
        setHouseForm((prev) => ({
          ...prev,
          namaJalan: result.streetName,
        }));
      }

      // Pan map to point
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([lat, lng], 18);
      }

      onShowToast?.(
        `Berhasil terdeteksi: ${result.streetName} (${result.isGang ? 'Gang' : 'Jalan'})`,
        'success'
      );
    } catch (err) {
      console.warn('Gagal mendeteksi nama jalan:', err);
      onShowToast?.('Gagal mendeteksi nama jalan secara otomatis', 'error');
    } finally {
      setIsDetectingStreet(false);
    }
  };

  // Handler: Parse pasted Google Maps link or coordinates
  const handlePasteGoogleMapsUrl = (rawInput: string) => {
    setGoogleMapsUrlInput(rawInput);
    const coords = parseCoordinatesFromInput(rawInput);
    if (coords) {
      setHouseForm((prev) => ({
        ...prev,
        lat: coords.lat,
        lng: coords.lng,
      }));
      handleAutoDetectStreet(coords.lat, coords.lng);
      onShowToast?.(`Koordinat Google Maps terdeteksi: Lat ${coords.lat}, Lng ${coords.lng}`, 'info');
    }
  };

  // Handler: Get Current GPS for House Form
  const handleGetHouseGPS = () => {
    if (!navigator.geolocation) {
      alert('Fitur GPS tidak didukung di browser ini.');
      return;
    }
    setIsDetectingStreet(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const lat = +latitude.toFixed(6);
        const lng = +longitude.toFixed(6);
        setHouseForm((prev) => ({ ...prev, lat, lng }));
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 18);
        }
        await handleAutoDetectStreet(lat, lng);
      },
      (err) => {
        setIsDetectingStreet(false);
        alert('Gagal mengambil titik GPS: ' + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  // Handler: Save House
  const handleSaveHouse = async (e: React.FormEvent) => {
    e.preventDefault();
    const isResidential = houseForm.kategoriBangunan === 'RUMAH_TINGGAL';
    let displayName = houseForm.namaKepalaKeluarga.trim();
    if (!displayName && !isResidential) {
      displayName = houseForm.namaUsaha || houseForm.jenisFasilitas || 'Fasilitas Umum';
    }
    if (!displayName) {
      alert(isResidential ? 'Nama Kepala Keluarga wajib diisi!' : 'Nama Bangunan / Fasilitas / Tempat wajib diisi!');
      return;
    }

    setIsSavingHouse(true);
    setSaveStatusMessage('⏳ Sedang menyimpan data ke Firestore Database...');

    try {
      const acc = KEPLING_ACCOUNTS.find((a) => a.id === houseForm.lingkunganId);
      const newHouse: TitikRumahBangunan = {
        id: editingHouse?.id || `rumah_${Date.now()}`,
        lingkunganId: houseForm.lingkunganId,
        lingkunganNomor: acc?.nomorLingkungan || 1,
        namaJalan: houseForm.namaJalan || 'Jl. Lingkungan',
        nomorRumah: houseForm.nomorRumah || (isResidential ? 'No. -' : 'S/N'),
        namaKepalaKeluarga: displayName,
        nikKk: isResidential ? houseForm.nikKk : undefined,
        isKkMangga: isResidential ? (houseForm.isKkMangga !== false) : false,
        asalKk: isResidential ? (houseForm.isKkMangga ? 'Kelurahan Mangga' : (houseForm.asalKk || 'Luar Kelurahan Mangga')) : 'Fasilitas Publik / Tempat Usaha',
        lat: Number(houseForm.lat) || KELURAHAN_MANGGA_CENTER[0],
        lng: Number(houseForm.lng) || KELURAHAN_MANGGA_CENTER[1],
        jumlahJiwa: isResidential ? ((Number(houseForm.jumlahLakiLaki) || 0) + (Number(houseForm.jumlahPerempuan) || 0) || 1) : 0,
        jumlahLakiLaki: isResidential ? (Number(houseForm.jumlahLakiLaki) || 0) : 0,
        jumlahPerempuan: isResidential ? (Number(houseForm.jumlahPerempuan) || 0) : 0,
        jumlahLansia: isResidential ? (Number(houseForm.jumlahLansia) || 0) : 0,
        jumlahAnak: isResidential ? (Number(houseForm.jumlahAnak) || 0) : 0,
        pekerjaanKk: isResidential ? houseForm.pekerjaanKk : (houseForm.jenisFasilitas || 'Fasilitas / Usaha'),
        penerimaBansos: isResidential ? houseForm.penerimaBansos : false,
        jenisBansos: isResidential ? houseForm.jenisBansos : undefined,
        desilBansos: isResidential ? houseForm.desilBansos : undefined,
        kategoriRentan: isResidential ? houseForm.kategoriRentan : false,
        statusWrs: houseForm.statusWrs,
        tarifRetribusi: Number(houseForm.tarifRetribusi) || 15000,
        nopPbb: houseForm.nopPbb,
        statusPbb: houseForm.statusPbb,
        nominalPbb: Number(houseForm.nominalPbb) || 0,
        tahunPbb: Number(houseForm.tahunPbb) || 2026,
        catatan: houseForm.catatan,
        memilikiUsaha: houseForm.memilikiUsaha,
        jenisUsaha: houseForm.memilikiUsaha ? houseForm.jenisUsaha : undefined,
        namaUsaha: houseForm.memilikiUsaha ? houseForm.namaUsaha : undefined,
        luasTanahM2: Number(houseForm.luasTanahM2) || 0,
        luasBangunanM2: Number(houseForm.luasBangunanM2) || 0,
        kategoriBangunan: houseForm.kategoriBangunan,
        jenisFasilitas: houseForm.kategoriBangunan === 'RUMAH_TINGGAL' || houseForm.kategoriBangunan === 'RUMAH_USAHA' ? undefined : houseForm.jenisFasilitas,
        createdAt: editingHouse?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByName: currentUser.nama,
      };

      // 1. Immediately update local state so marker appears on map instantly (0ms delay!)
      setHouses((prev) => {
        const idx = prev.findIndex((h) => h.id === newHouse.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = newHouse;
          return copy;
        }
        return [newHouse, ...prev];
      });

      if (mapInstanceRef.current && newHouse.lat && newHouse.lng) {
        mapInstanceRef.current.setView([newHouse.lat, newHouse.lng], 18);
      }
      setSelectedHouse(newHouse);
      setIsHouseModalOpen(false);
      setEditingHouse(null);

      // 2. Save online to Firestore and Server buffer concurrently in background
      const isSavedOk = await saveHouseToFirestore(newHouse);

      if (isSavedOk) {
        onShowToast?.(`✅ BERHASIL TERSIMPAN! ${newHouse.namaKepalaKeluarga} telah tersimpan & tersinkronisasi`, 'success');
      } else {
        onShowToast?.(`⚠️ Data ${newHouse.namaKepalaKeluarga} tersimpan di memori. Akan disinkronkan online.`, 'info');
      }
    } catch (err) {
      console.error('Error saving house:', err);
      onShowToast?.('Gagal menyimpan data ke Firestore', 'error');
    } finally {
      setIsSavingHouse(false);
      setSaveStatusMessage(null);
    }
  };

  // Handler: Quick Toggle PBB Status
  const handleTogglePbbStatus = async (house: TitikRumahBangunan, newStatus: StatusPbb) => {
    const updated: TitikRumahBangunan = {
      ...house,
      statusPbb: newStatus,
      updatedAt: new Date().toISOString(),
    };
    // Optimistic UI update instantly!
    setHouses((prev) => {
      const idx = prev.findIndex((h) => h.id === updated.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [updated, ...prev];
    });
    setSelectedHouse(updated);
    saveHouseToFirestore(updated).catch(() => {});
    onShowToast?.(
      `Status PBB ${house.namaKepalaKeluarga} diubah menjadi: ${newStatus === 'LUNAS' ? '🟢 LUNAS' : newStatus === 'BEBAS_PAJAK' ? '🔵 BEBAS PAJAK' : '🔴 BELUM LUNAS'}`,
      'success'
    );
  };

  // Handler: Save Road
  const handleSaveRoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roadForm.namaJalan.trim()) {
      alert('Nama Jalan wajib diisi!');
      return;
    }

    const acc = KEPLING_ACCOUNTS.find((a) => a.id === roadForm.lingkunganId);
    const newRoad: RuasJalanLingkungan = {
      id: `road_${Date.now()}`,
      lingkunganId: roadForm.lingkunganId,
      lingkunganNomor: acc?.nomorLingkungan || 1,
      namaJalan: roadForm.namaJalan,
      panjangMeter: Number(roadForm.panjangMeter) || 100,
      lebarMeter: Number(roadForm.lebarMeter) || 3.5,
      jenisPerkerasan: roadForm.jenisPerkerasan,
      kondisiJalan: roadForm.kondisiJalan,
      kondisiDrainase: roadForm.kondisiDrainase,
      titikKoordinat: [roadForm.lat, roadForm.lng],
      catatan: roadForm.catatan,
      createdAt: new Date().toISOString(),
      createdByName: currentUser.nama,
    };

    // Optimistic UI update
    setRoads((prev) => [newRoad, ...prev.filter((r) => r.id !== newRoad.id)]);
    setIsRoadModalOpen(false);

    saveRoadToFirestore(newRoad).catch(() => {});
    onShowToast?.(`Data ruas jalan ${newRoad.namaJalan} berhasil disimpan!`, 'success');
  };

  // Handler: Export Excel Data
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Data Rumah, WRS & PBB
    const houseRows = houses.map((h, i) => ({
      No: i + 1,
      Lingkungan: `Lingkungan ${h.lingkunganNomor}`,
      'Nama Jalan': h.namaJalan,
      'No. Rumah': h.nomorRumah,
      'Nama Kepala Keluarga': h.namaKepalaKeluarga,
      'Status KK': h.isKkMangga !== false ? 'KK Kelurahan Mangga' : 'Bukan KK Kelurahan Mangga',
      'Asal KK / Domisili': h.asalKk || (h.isKkMangga !== false ? 'Kelurahan Mangga' : 'Luar'),
      'NIK KK': h.nikKk || '-',
      'Total Jiwa': h.jumlahJiwa || (h.jumlahLakiLaki || 0) + (h.jumlahPerempuan || 0),
      'Laki-laki': h.jumlahLakiLaki,
      Perempuan: h.jumlahPerempuan,
      Lansia: h.jumlahLansia,
      Anak: h.jumlahAnak,
      'Pekerjaan KK': h.pekerjaanKk,
      'Status WRS': h.statusWrs,
      'Tarif WRS (Rp)': h.tarifRetribusi || 15000,
      'NOP PBB': h.nopPbb || '-',
      'Status PBB': h.statusPbb || 'BELUM_LUNAS',
      'Ketetapan PBB (Rp)': h.nominalPbb || 0,
      'Tahun Pajak PBB': h.tahunPbb || 2026,
      'Penerima Bansos': h.penerimaBansos ? 'YA' : 'TIDAK',
      'Jenis Bansos': h.jenisBansos?.join(', ') || '-',
      'Desil Bansos': h.desilBansos || '-',
      'Kategori Rentan': h.kategoriRentan ? 'YA' : 'TIDAK',
      Koordinat: `${h.lat}, ${h.lng}`,
      Catatan: h.catatan || '-',
      'Diinput Oleh': h.createdByName || '-',
    }));
    const wsHouses = XLSX.utils.json_to_sheet(houseRows);
    XLSX.utils.book_append_sheet(wb, wsHouses, 'Data Rumah, WRS & PBB');

    // Sheet 2: Data Jalan
    const roadRows = roads.map((r, i) => ({
      No: i + 1,
      Lingkungan: `Lingkungan ${r.lingkunganNomor}`,
      'Nama Jalan': r.namaJalan,
      'Panjang (m)': r.panjangMeter,
      'Lebar (m)': r.lebarMeter,
      Perkerasan: r.jenisPerkerasan,
      'Kondisi Jalan': r.kondisiJalan,
      'Kondisi Drainase': r.kondisiDrainase,
      Koordinat: r.titikKoordinat?.join(', ') || '-',
      Catatan: r.catatan || '-',
    }));
    const wsRoads = XLSX.utils.json_to_sheet(roadRows);
    XLSX.utils.book_append_sheet(wb, wsRoads, 'Data Ruas Jalan');

    // Download file
    XLSX.writeFile(
      wb,
      `WebGIS_Kelurahan_Mangga_${new Date().toISOString().split('T')[0]}.xlsx`
    );
    onShowToast?.('Data WebGIS berhasil diekspor ke Excel!', 'success');
  };

  // Center to user GPS on Map
  const handleFlyToMyGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 17);
          L.circleMarker([latitude, longitude], {
            radius: 8,
            fillColor: '#3b82f6',
            color: '#ffffff',
            weight: 3,
            fillOpacity: 1,
          })
            .addTo(mapInstanceRef.current)
            .bindPopup('<b>📍 Lokasi Anda Saat Ini</b>')
            .openPopup();
        }
      },
      (err) => alert('Gagal membaca GPS: ' + err.message)
    );
  };

  // Manual WebGIS Full Sync with Cloud Firestore & Server Buffer
  const handleManualSyncWebgis = async () => {
    setIsSyncingWebgis(true);
    try {
      const [pList, hList, rList] = await Promise.all([
        fetchAllPolygons(),
        fetchAllHouses(),
        fetchAllRoads(),
      ]);
      setPolygons(pList);
      setHouses(hList);
      setRoads(rList);
      onShowToast?.(
        `✅ WebGIS Tersinkron Sempurna! (${hList.length} Titik Bangunan, ${pList.length} Batas Wilayah, ${rList.length} Jalan)`,
        'success'
      );
    } catch (err: any) {
      console.error('Error syncing WebGIS:', err);
      onShowToast?.('Gagal menyinkronkan data WebGIS dari cloud.', 'error');
    } finally {
      setIsSyncingWebgis(false);
    }
  };

  if (isBapenda) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-400/40 text-amber-600 flex items-center justify-center mx-auto text-2xl">
          🔒
        </div>
        <h3 className="text-xl font-black text-slate-900">Akses Peta WebGIS Tidak Diizinkan</h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          Akun <strong>Petugas Bapenda Kota Medan</strong> dikhususkan hanya untuk melihat data Realisasi Pajak PBB-P2 dan tidak memiliki otoritas untuk melihat atau mengelola Peta Spasial WebGIS.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-1 sm:px-2 pb-12 animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white rounded-2xl p-5 border border-emerald-700/60 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1">
                <Compass className="w-3 h-3 text-emerald-400" />
                SISTEM INFORMASI GEOGRAFIS (WEBGIS)
              </span>
              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-500/40">
                24 LINGKUNGAN MANGGA
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
              <span>Pemetaan Wilayah, Infrastruktur &amp; WRS</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Visualisasi batas poligon 24 lingkungan, titik rumah warga, kepatuhan Wajib Retribusi
              Sampah (WRS), penerima bantuan sosial, dan kondisi ruas jalan.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Draw Polygon Button */}
            {!isDrawingPolygon ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleStartDrawPolygon(
                      isKepling
                        ? currentUser.id
                        : filterLingkungan === 'all'
                        ? 'kepling_1'
                        : filterLingkungan
                    )
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-md cursor-pointer transition-transform hover:scale-[1.02]"
                  title="Gambar poligon batas wilayah lingkungan langsung di atas peta"
                >
                  <Edit3 className="w-4 h-4 text-slate-950" />
                  <span>Gambar Batas Wilayah</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetAllPolygons}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md cursor-pointer transition-colors"
                  title="Hapus semua batas poligon lama untuk digambar ulang dari awal"
                >
                  <span>🗑️ Hapus Peta Lama</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-amber-950/90 p-1.5 rounded-xl border border-amber-500/60 animate-pulse">
                <button
                  type="button"
                  onClick={() => setDrawnPoints((prev) => prev.slice(0, -1))}
                  className="px-2.5 py-1 rounded-lg bg-amber-900 text-amber-200 text-xs font-bold hover:bg-amber-800 cursor-pointer"
                >
                  ↩️ Titik Terakhir
                </button>
                <button
                  type="button"
                  onClick={handleSaveDrawnPolygon}
                  className="px-3 py-1 rounded-lg bg-emerald-500 text-white text-xs font-black hover:bg-emerald-400 shadow-xs cursor-pointer"
                >
                  💾 Simpan Batas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawingPolygon(false);
                    setDrawnPoints([]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-red-900 text-red-200 text-xs font-bold hover:bg-red-800 cursor-pointer"
                >
                  ✖️ Batal
                </button>
              </div>
            )}

            {/* Add Building Pin */}
            <button
              type="button"
              onClick={() => {
                setEditingHouse(null);
                setHouseForm(getEmptyHouseFormData(isKepling ? currentUser.id : 'kepling_1'));
                setGoogleMapsUrlInput('');
                setDetectedStreetOverlay(null);
                setMatchedPbbItem(null);
                setIsPbbPickerOpen(false);
                setIsHouseModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md cursor-pointer transition-transform hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Titik Bangunan</span>
            </button>

            {/* Add Road */}
            <button
              type="button"
              onClick={() => {
                setRoadForm((prev) => ({
                  ...prev,
                  lingkunganId: isKepling ? currentUser.id : 'kepling_1',
                }));
                setIsRoadModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Ruas Jalan</span>
            </button>

            {/* Import KML */}
            <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-800 hover:bg-teal-700 text-teal-100 text-xs font-bold border border-teal-600/50 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Import KML</span>
              <input
                ref={kmlInputRef}
                type="file"
                accept=".kml,.kmz,.xml,.geojson,.json,.txt"
                onChange={handleImportKML}
                className="hidden"
              />
            </label>

            {/* Paste KML Teks Button */}
            <button
              type="button"
              onClick={() => setIsKmlTextModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-teal-100 text-xs font-bold border border-teal-500/50 cursor-pointer"
            >
              <span>📝 Paste KML Teks</span>
            </button>

            {/* Export Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-200 text-xs font-bold border border-emerald-700/60 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Ekspor Excel</span>
            </button>

            {/* Sync WebGIS Real-time */}
            <button
              type="button"
              onClick={handleManualSyncWebgis}
              disabled={isSyncingWebgis}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black shadow-md cursor-pointer transition-all ${
                isSyncingWebgis
                  ? 'bg-blue-900 text-blue-200 border border-blue-600/60 cursor-wait'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/40 hover:scale-[1.02]'
              }`}
              title="Sinkronkan data WebGIS langsung dengan Cloud Firestore & server"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingWebgis ? 'animate-spin text-blue-300' : 'text-white'}`} />
              <span>{isSyncingWebgis ? 'Menyinkronkan...' : 'Sinkronkan WebGIS'}</span>
            </button>
          </div>
        </div>

        {/* Drawing Guidance Alert */}
        {isDrawingPolygon && (
          <div className="mt-3 p-3 bg-amber-500/20 border border-amber-400/50 rounded-xl text-xs text-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                <b>Mode Gambar Aktif:</b> Ketuk atau klik peta pada setiap titik sudut wilayah
                (minimal 3 titik). Saat ini terpasang: <b>{drawnPoints.length} titik</b>.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* STATS ROLL-UP CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
        {/* KK */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Total KK</span>
            <Home className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-lg font-black text-slate-900 mt-1">{stats.totalKk} KK</p>
          <span className="text-[9px] text-slate-500 font-medium block">
            <span className="text-emerald-700 font-bold">{stats.totalKkMangga}</span> Mangga | <span className="text-amber-700 font-bold">{stats.totalKkLuar}</span> Luar
          </span>
        </div>

        {/* Jiwa */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Total Jiwa</span>
            <Users className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-lg font-black text-slate-900 mt-1">{stats.totalJiwa} Jiwa</p>
          <span className="text-[9px] text-slate-500 font-medium">
            {stats.totalLaki} L / {stats.totalPerempuan} P
          </span>
        </div>

        {/* WRS Aktif */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-emerald-700">WRS Aktif</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-lg font-black text-emerald-800 mt-1">{stats.wrsAktif} KK</p>
          <span className="text-[9px] text-emerald-600 font-bold">
            {stats.wrsPersen}% Kepatuhan WRS
          </span>
        </div>

        {/* PBB (Pajak Bumi & Bangunan) */}
        <div className="bg-white p-3 rounded-2xl border border-teal-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-teal-800">PBB Lunas</span>
            <span className="text-xs">🏛️</span>
          </div>
          <p className="text-lg font-black text-teal-900 mt-1">
            {stats.pbbLunasKk}/{stats.totalKk} KK
          </p>
          <span className="text-[9px] text-teal-700 font-bold">
            {stats.pbbPersen}% (Rp {stats.pbbNominalLunas.toLocaleString('id-ID')})
          </span>
        </div>

        {/* Belum WRS / PBB */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-rose-700">Tunggakan</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <p className="text-lg font-black text-rose-800 mt-1">{stats.pbbBelumKk} PBB</p>
          <span className="text-[9px] text-rose-600 font-medium">
            {stats.wrsBelum} Belum WRS
          </span>
        </div>

        {/* Bansos */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-purple-700">Penerima Bansos</span>
            <HeartHandshake className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <p className="text-lg font-black text-purple-900 mt-1">{stats.bansosKk} KK</p>
          <span className="text-[9px] text-purple-600 font-medium">PKH / BPNT / BLT</span>
        </div>

        {/* Jalan */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400">Ruas Jalan</span>
            <Compass className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-lg font-black text-slate-900 mt-1">{stats.totalJalan} Ruas</p>
          <span className="text-[9px] text-slate-500 font-medium">
            🟢 {stats.jalanBaik} Baik | 🔴 {stats.jalanRusak} Rusak
          </span>
        </div>
      </div>

      {/* FASILITAS PUBLIK & SARANA UMUM SUMMARY BAR */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-3.5 border border-indigo-700/50 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-800/60 pb-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm">🏛️</span>
            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-200">
              Fasilitas Publik &amp; Sarana Umum ({stats.totalFasilitasPublik} Titik Terpetakan)
            </h4>
          </div>
          <span className="text-[10px] text-indigo-300 font-medium">
            Non-Rumah Tinggal (Klik kartu di bawah untuk memfilter di peta)
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {/* Masjid / Mushola */}
          <button
            type="button"
            onClick={() => setFilterTheme(filterTheme === 'IBADAH' ? 'ALL' : 'IBADAH')}
            className={`p-2 rounded-xl text-left transition-all border cursor-pointer ${
              filterTheme === 'IBADAH'
                ? 'bg-emerald-500/30 border-emerald-400 ring-2 ring-emerald-400'
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-300 text-[10px] font-bold">
              <span>🕌 Masjid / Mushola</span>
            </div>
            <p className="text-base font-black text-white mt-0.5">{stats.totalMasjid}</p>
          </button>

          {/* Gereja / Rumah Ibadah */}
          <button
            type="button"
            onClick={() => setFilterTheme(filterTheme === 'IBADAH' ? 'ALL' : 'IBADAH')}
            className={`p-2 rounded-xl text-left transition-all border cursor-pointer ${
              filterTheme === 'IBADAH'
                ? 'bg-teal-500/30 border-teal-400 ring-2 ring-teal-400'
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-teal-300 text-[10px] font-bold">
              <span>⛪ Gereja / Ibadah</span>
            </div>
            <p className="text-base font-black text-white mt-0.5">{stats.totalGereja}</p>
          </button>

          {/* Sekolah */}
          <button
            type="button"
            onClick={() => setFilterTheme(filterTheme === 'SEKOLAH' ? 'ALL' : 'SEKOLAH')}
            className={`p-2 rounded-xl text-left transition-all border cursor-pointer ${
              filterTheme === 'SEKOLAH'
                ? 'bg-blue-500/30 border-blue-400 ring-2 ring-blue-400'
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-blue-300 text-[10px] font-bold">
              <span>🏫 Sekolah / Kampus</span>
            </div>
            <p className="text-base font-black text-white mt-0.5">{stats.totalSekolah}</p>
          </button>

          {/* Faskes */}
          <button
            type="button"
            onClick={() => setFilterTheme(filterTheme === 'FASKES' ? 'ALL' : 'FASKES')}
            className={`p-2 rounded-xl text-left transition-all border cursor-pointer ${
              filterTheme === 'FASKES'
                ? 'bg-rose-500/30 border-rose-400 ring-2 ring-rose-400'
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-rose-300 text-[10px] font-bold">
              <span>🏥 Puskesmas / Faskes</span>
            </div>
            <p className="text-base font-black text-white mt-0.5">{stats.totalFaskes}</p>
          </button>

          {/* SPBU */}
          <button
            type="button"
            onClick={() => setFilterTheme(filterTheme === 'SPBU' ? 'ALL' : 'SPBU')}
            className={`p-2 rounded-xl text-left transition-all border cursor-pointer ${
              filterTheme === 'SPBU'
                ? 'bg-orange-500/30 border-orange-400 ring-2 ring-orange-400'
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-orange-300 text-[10px] font-bold">
              <span>⛽ SPBU / Pertashop</span>
            </div>
            <p className="text-base font-black text-white mt-0.5">{stats.totalSpbu}</p>
          </button>

          {/* Kantor / Fasum */}
          <button
            type="button"
            onClick={() => setFilterTheme(filterTheme === 'FASUM' ? 'ALL' : 'FASUM')}
            className={`p-2 rounded-xl text-left transition-all border cursor-pointer ${
              filterTheme === 'FASUM'
                ? 'bg-indigo-500/30 border-indigo-400 ring-2 ring-indigo-400'
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-indigo-300 text-[10px] font-bold">
              <span>🏢 Kantor / Gedung</span>
            </div>
            <p className="text-base font-black text-white mt-0.5">{stats.totalKantorFasum}</p>
          </button>

          {/* Tempat Usaha / UMKM */}
          <button
            type="button"
            onClick={() => setFilterTheme(filterTheme === 'USAHA' ? 'ALL' : 'USAHA')}
            className={`p-2 rounded-xl text-left transition-all border cursor-pointer ${
              filterTheme === 'USAHA'
                ? 'bg-amber-500/30 border-amber-400 ring-2 ring-amber-400'
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-amber-300 text-[10px] font-bold">
              <span>🏪 Usaha / UMKM</span>
            </div>
            <p className="text-base font-black text-white mt-0.5">{stats.totalPasarUsaha}</p>
          </button>
        </div>
      </div>

      {/* CONTROLS & FILTER TOOLBAR */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Layer Switches & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Base Map Switcher */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setBaseMapType('satellite')}
              className={`px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                baseMapType === 'satellite'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🛰️ Citra Satelit
            </button>
            <button
              type="button"
              onClick={() => setBaseMapType('streets')}
              className={`px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer ${
                baseMapType === 'streets'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🗺️ Peta Jalan (OSM)
            </button>
          </div>

          {/* Street & Gang Overlay Layer Toggle */}
          <button
            type="button"
            onClick={() => setShowStreetOverlayLayer((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
              showStreetOverlayLayer
                ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
            title="Tampilkan label nama jalan & gang di peta satelit"
          >
            <span>🏷️</span>
            <span>Overlay Jalan & Gang</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                showStreetOverlayLayer ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {showStreetOverlayLayer ? 'AKTIF' : 'NONAKTIF'}
            </span>
          </button>

          {/* Theme Filters */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setFilterTheme('ALL')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterTheme === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilterTheme('WRS')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterTheme === 'WRS'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              🗑️ Fokus WRS
            </button>
            <button
              type="button"
              onClick={() => setFilterTheme('PBB')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterTheme === 'PBB'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-teal-800 hover:bg-teal-50'
              }`}
            >
              🏛️ Fokus PBB
            </button>
            <button
              type="button"
              onClick={() => setFilterTheme('BANSOS')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterTheme === 'BANSOS'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-purple-800 hover:bg-purple-50'
              }`}
            >
              🎁 Fokus Bansos
            </button>
            <button
              type="button"
              onClick={() => setFilterTheme('JALAN')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterTheme === 'JALAN'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              🛣️ Kondisi Jalan
            </button>
            <button
              type="button"
              onClick={() => setFilterTheme('HEATMAP')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                filterTheme === 'HEATMAP'
                  ? 'bg-rose-600 text-white shadow-xs animate-pulse'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
              title="Mewarnai lingkungan berdasarkan intensitas laporan harian Kepling"
            >
              <span>🔥 Heatmap Kejadian</span>
            </button>
          </div>
        </div>

        {/* Right Filter: Lingkungan Dropdown & Search */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Lingkungan Selector */}
          {isAdmin ? (
            <select
              value={filterLingkungan}
              onChange={(e) => {
                const val = e.target.value;
                setFilterLingkungan(val);
                setSelectedPolygon(null);
                if (val !== 'all' && mapInstanceRef.current) {
                  const targetPoly = polygons.find((p) => p.lingkunganId === val);
                  if (targetPoly && targetPoly.coordinates.length >= 3) {
                    const b = L.latLngBounds(targetPoly.coordinates.map((c) => [c[0], c[1]]));
                    mapInstanceRef.current.fitBounds(b, { padding: [40, 40] });
                  }
                }
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800 shadow-2xs focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">🌐 Semua Lingkungan (24 Lingkungan)</option>
              {KEPLING_ACCOUNTS.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.lingkungan} — {acc.nama}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-1.5 rounded-xl border border-emerald-300 text-xs font-black bg-emerald-50 text-emerald-900 shadow-2xs">
              📍 {currentUser.lingkungan} ({currentUser.nama})
            </div>
          )}

          {/* Search Box */}
          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari warga/jalan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* GPS Button */}
          <button
            type="button"
            onClick={handleFlyToMyGPS}
            className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all cursor-pointer"
            title="Arahkan peta ke posisi GPS saya saat ini"
          >
            <Navigation className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MAP VIEWPORT & SIDE PANEL CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Leaflet Map Viewport (Takes 3 columns on large screens) */}
        <div className="lg:col-span-3 bg-slate-900 rounded-3xl overflow-hidden border border-slate-300 shadow-md relative h-[520px] sm:h-[620px]">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Real-time Loading & Saving Warning Status Banner */}
          {(isSavingHouse || isSavingRoad || isLoading || saveStatusMessage) && (
            <div className="absolute top-3 left-3 right-3 z-[1000] bg-slate-950/95 text-white p-3 rounded-2xl border-2 border-amber-400/90 shadow-2xl flex items-center justify-between backdrop-blur-md animate-fade-in">
              <div className="flex items-center gap-3 text-xs">
                <RefreshCw className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
                <div>
                  <div className="font-black text-amber-300 text-xs sm:text-sm">
                    {isSavingHouse
                      ? '⏳ SEDANG MENYIMPAN DATA BANGUNAN / GEREJA KE FIRESTORE...'
                      : isSavingRoad
                      ? '⏳ SEDANG MENYIMPAN DATA RUAS JALAN KE FIRESTORE...'
                      : isLoading
                      ? '⏳ MEMUAT DATA GEOGRAFIS & TITIK LOKASI FIRESTORE...'
                      : saveStatusMessage || '⏳ PROSES DATA BERLANGSUNG...'}
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-300">
                    Sistem sedang mensinkronisasi data dengan database Firestore online. Mohon tunggu sejenak.
                  </div>
                </div>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl font-mono text-[10px] font-bold shrink-0">
                PROSES ONLINE
              </span>
            </div>
          )}

          {/* Active Coordinate Picking Banner */}
          {isPickingCoordinate && (
            <div className="absolute top-3 left-3 right-3 z-[1000] bg-emerald-950/95 text-white p-3 rounded-2xl border-2 border-emerald-400 shadow-2xl flex items-center justify-between backdrop-blur-md animate-pulse">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-xl">🎯</span>
                <div>
                  <div className="font-black text-emerald-300 text-xs sm:text-sm">
                    Mode Pemilihan Titik Aktif: Klik Peta
                  </div>
                  <div className="text-[10px] sm:text-xs text-emerald-100">
                    Klik posisi rumah warga di peta untuk mengambil koordinat & mendeteksi overlay nama jalan/gang secara otomatis.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPickingCoordinate(false);
                  setIsHouseModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-white text-emerald-950 font-bold text-xs hover:bg-emerald-100 cursor-pointer shadow-sm"
              >
                Kembali ke Form
              </button>
            </div>
          )}

          {/* Floating Map Legend (Bottom-Left) */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur-md text-white p-3 rounded-2xl border border-slate-700/80 shadow-lg text-[10px] space-y-1.5 max-w-[240px]">
            {filterTheme === 'HEATMAP' ? (
              <>
                <p className="font-black uppercase tracking-wider text-rose-400">🔥 Heatmap Kejadian:</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#10b981] border border-white" />
                  <span>0 Laporan (Aman / Kondusif)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#eab308] border border-white" />
                  <span>1 - 2 Laporan (Kerawanan Rendah)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#f97316] border border-white" />
                  <span>3 - 5 Laporan (Kerawanan Sedang)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-white animate-pulse" />
                  <span>&gt; 5 Laporan (Rawan / Padat Kejadian)</span>
                </div>
                <p className="text-[9px] text-slate-400 pt-1 leading-tight font-medium border-t border-slate-700 mt-1">
                  Warna merefleksikan total Laporan Harian yang dikirimkan Kepling.
                </p>
              </>
            ) : (
              <>
                <p className="font-black uppercase tracking-wider text-emerald-400">Legenda Peta:</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white" />
                  <span>WRS Aktif / PBB Lunas / Jalan Baik</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 border border-white" />
                  <span>Belum WRS / PBB Belum / Jalan Rusak</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-purple-500 border border-white" />
                  <span>Penerima Bantuan Sosial</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-1.5 bg-amber-400 border border-white" />
                  <span>Garis Batas Lingkungan</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Details & Inspection Side Panel (Takes 1 column) */}
        <div className="lg:col-span-1 space-y-3">
          {/* Selected House Detail Card */}
          {selectedHouse ? (
            <div className="bg-white rounded-2xl p-4 border border-emerald-300 shadow-md space-y-3 animate-fade-in">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Lingkungan {selectedHouse.lingkunganNomor}
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-sm mt-1">
                    {selectedHouse.namaKepalaKeluarga}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedHouse.namaJalan && selectedHouse.nomorRumah && selectedHouse.namaJalan.toLowerCase().includes(selectedHouse.nomorRumah.toLowerCase())
                      ? selectedHouse.namaJalan
                      : `${selectedHouse.namaJalan || ''} ${selectedHouse.nomorRumah || ''}`.trim()}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedHouse && selectedHouse.lat && selectedHouse.lng && mapInstanceRef.current) {
                        const lat = Number(selectedHouse.lat);
                        const lng = Number(selectedHouse.lng);
                        mapInstanceRef.current.flyTo([lat, lng], 18, { animate: true, duration: 1 });
                        document.getElementById('webgis-map-canvas')?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="mt-2 w-full py-1.5 px-3 bg-emerald-700 hover:bg-emerald-600 text-white font-black text-[11px] rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-emerald-600"
                  >
                    <Compass className="w-3.5 h-3.5 text-emerald-300" />
                    <span>🎯 Zoom &amp; Sorot Titik Ini di Peta</span>
                  </button>
                </div>
                <button
                  onClick={() => setSelectedHouse(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs border-t border-slate-100 pt-2">
                {(() => {
                  const isRes = !selectedHouse.kategoriBangunan || selectedHouse.kategoriBangunan === 'RUMAH_TINGGAL' || selectedHouse.kategoriBangunan === 'RUMAH_USAHA';
                  if (isRes) {
                    return (
                      <>
                        <div className="flex justify-between items-center bg-blue-50/70 p-2 rounded-xl border border-blue-100">
                          <span className="text-slate-600 font-medium">Status KK:</span>
                          <span
                            className={`font-black px-2 py-0.5 rounded text-[10px] ${
                              selectedHouse.isKkMangga !== false
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {selectedHouse.isKkMangga !== false
                              ? '🏠 KK Kelurahan Mangga'
                              : `🌐 Bukan KK Mangga ${selectedHouse.asalKk && selectedHouse.asalKk !== 'Luar Kelurahan Mangga' ? `(${selectedHouse.asalKk})` : ''}`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">NIK KK:</span>
                          <span className="font-bold text-slate-800">{selectedHouse.nikKk || '-'}</span>
                        </div>
                      </>
                    );
                  }
                  return (
                    <div className="flex justify-between items-center bg-purple-50/80 p-2.5 rounded-xl border border-purple-200">
                      <span className="text-purple-900 font-bold">Kategori Bangunan:</span>
                      <span className="font-black px-2 py-0.5 rounded text-[10px] bg-purple-600 text-white">
                        🏢 Fasilitas Umum / Usaha (Non-Rumah)
                      </span>
                    </div>
                  );
                })()}
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Jiwa:</span>
                  <span className="font-bold text-slate-800">
                    {selectedHouse.jumlahJiwa} Jiwa ({selectedHouse.jumlahLakiLaki}L /{' '}
                    {selectedHouse.jumlahPerempuan}P)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lansia / Anak:</span>
                  <span className="font-bold text-slate-800">
                    {selectedHouse.jumlahLansia} Lansia / {selectedHouse.jumlahAnak} Anak
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pekerjaan:</span>
                  <span className="font-bold text-slate-800">{selectedHouse.pekerjaanKk}</span>
                </div>

                {/* Status WRS */}
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                  <span className="text-slate-600 font-medium">Status WRS:</span>
                  <span
                    className={`font-black px-2 py-0.5 rounded text-[10px] ${
                      selectedHouse.statusWrs === 'AKTIF'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedHouse.statusWrs === 'BEBAS_WRS'
                        ? 'bg-sky-100 text-sky-800'
                        : selectedHouse.statusWrs === 'MANDIRI'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {selectedHouse.statusWrs === 'AKTIF'
                      ? '🟢 AKTIF BERLANGGANAN'
                      : selectedHouse.statusWrs === 'BEBAS_WRS'
                      ? '🔵 BEBAS WRS'
                      : selectedHouse.statusWrs === 'MANDIRI'
                      ? '🟡 PENGELOLAAN MANDIRI'
                      : '🔴 BELUM / MENOLAK'}
                    {selectedHouse.statusWrs === 'AKTIF' && ` (Rp ${(selectedHouse.tarifRetribusi || 15000).toLocaleString('id-ID')})`}
                  </span>
                </div>

                {/* Status PBB (Pajak Bumi & Bangunan) */}
                <div className="p-2.5 bg-teal-50/80 border border-teal-200 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-teal-900 font-bold flex items-center gap-1">
                      🏛️ Pajak PBB ({selectedHouse.tahunPbb || 2026}):
                    </span>
                    <span
                      className={`font-black px-2 py-0.5 rounded text-[10px] ${
                        selectedHouse.statusPbb === 'LUNAS'
                          ? 'bg-emerald-600 text-white'
                          : selectedHouse.statusPbb === 'BEBAS_PAJAK'
                          ? 'bg-sky-600 text-white'
                          : 'bg-rose-600 text-white animate-pulse'
                      }`}
                    >
                      {selectedHouse.statusPbb === 'LUNAS'
                        ? '🟢 LUNAS'
                        : selectedHouse.statusPbb === 'BEBAS_PAJAK'
                        ? '🔵 BEBAS PAJAK'
                        : '🔴 BELUM LUNAS'}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-teal-950">
                    <span className="text-slate-600">NOP:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {selectedHouse.nopPbb || 'Belum diisi'}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-teal-950">
                    <span className="text-slate-600">Ketetapan:</span>
                    <span className="font-bold text-teal-800">
                      Rp {(selectedHouse.nominalPbb || 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  {/* Quick Toggle PBB for Kepling/Admin */}
                  <div className="flex items-center gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => handleTogglePbbStatus(selectedHouse, 'LUNAS')}
                      className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-black cursor-pointer transition-all ${
                        selectedHouse.statusPbb === 'LUNAS'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                      }`}
                    >
                      ✓ Lunas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePbbStatus(selectedHouse, 'BELUM_LUNAS')}
                      className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-black cursor-pointer transition-all ${
                        selectedHouse.statusPbb === 'BELUM_LUNAS' || !selectedHouse.statusPbb
                          ? 'bg-rose-700 text-white'
                          : 'bg-white text-rose-700 border border-rose-300 hover:bg-rose-100'
                      }`}
                    >
                      ✕ Belum
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePbbStatus(selectedHouse, 'BEBAS_PAJAK')}
                      className={`py-1 px-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                        selectedHouse.statusPbb === 'BEBAS_PAJAK'
                          ? 'bg-sky-700 text-white'
                          : 'bg-white text-sky-700 border border-sky-300 hover:bg-sky-100'
                      }`}
                    >
                      Bebas
                    </button>
                  </div>
                </div>

                {/* Bansos */}
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                  <span className="text-slate-600 font-medium">Bansos:</span>
                  <span
                    className={`font-black px-2 py-0.5 rounded text-[10px] ${
                      selectedHouse.penerimaBansos
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {selectedHouse.penerimaBansos
                      ? `YA (${selectedHouse.jenisBansos?.join(', ') || 'Bansos'})`
                      : 'BUKAN'}
                  </span>
                </div>

                {/* Luas & Usaha */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Luas Tanah / Bangunan:</span>
                    <span className="font-bold text-slate-800">
                      {selectedHouse.luasTanahM2 || 0} m² / {selectedHouse.luasBangunanM2 || 0} m²
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Usaha / UMKM:</span>
                    <span className="font-bold text-amber-900">
                      {selectedHouse.memilikiUsaha ? `${selectedHouse.jenisUsaha || 'Ada'} ${selectedHouse.namaUsaha ? `(${selectedHouse.namaUsaha})` : ''}` : 'Tidak Ada'}
                    </span>
                  </div>
                </div>

                {selectedHouse.catatan && (
                  <p className="text-[11px] text-slate-500 italic bg-amber-50 p-2 rounded-lg border border-amber-100">
                    "{selectedHouse.catatan}"
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingHouse(selectedHouse);
                    setHouseForm({
                      lingkunganId: selectedHouse.lingkunganId,
                      namaJalan: selectedHouse.namaJalan,
                      nomorRumah: selectedHouse.nomorRumah,
                      namaKepalaKeluarga: selectedHouse.namaKepalaKeluarga,
                      nikKk: selectedHouse.nikKk || '',
                      lat: selectedHouse.lat,
                      lng: selectedHouse.lng,
                      jumlahJiwa: selectedHouse.jumlahJiwa,
                      jumlahLakiLaki: selectedHouse.jumlahLakiLaki,
                      jumlahPerempuan: selectedHouse.jumlahPerempuan,
                      jumlahLansia: selectedHouse.jumlahLansia,
                      jumlahAnak: selectedHouse.jumlahAnak,
                      pekerjaanKk: selectedHouse.pekerjaanKk,
                      penerimaBansos: selectedHouse.penerimaBansos,
                      jenisBansos: selectedHouse.jenisBansos || [],
                      desilBansos: selectedHouse.desilBansos || '',
                      kategoriRentan: selectedHouse.kategoriRentan || false,
                      statusWrs: selectedHouse.statusWrs,
                      tarifRetribusi: selectedHouse.tarifRetribusi || 15000,
                      nopPbb: selectedHouse.nopPbb || '',
                      statusPbb: selectedHouse.statusPbb || 'LUNAS',
                      nominalPbb: selectedHouse.nominalPbb !== undefined ? selectedHouse.nominalPbb : '',
                      tahunPbb: selectedHouse.tahunPbb !== undefined ? selectedHouse.tahunPbb : '',
                      catatan: selectedHouse.catatan || '',
                      memilikiUsaha: selectedHouse.memilikiUsaha || false,
                      jenisUsaha: selectedHouse.jenisUsaha || 'Toko Kelontong / Sembako',
                      namaUsaha: selectedHouse.namaUsaha || '',
                      luasTanahM2: selectedHouse.luasTanahM2 !== undefined ? selectedHouse.luasTanahM2 : '',
                      luasBangunanM2: selectedHouse.luasBangunanM2 !== undefined ? selectedHouse.luasBangunanM2 : '',
                      isKkMangga: selectedHouse.isKkMangga !== false,
                      asalKk: selectedHouse.asalKk || (selectedHouse.isKkMangga !== false ? 'Kelurahan Mangga' : 'Luar Kelurahan Mangga'),
                      kategoriBangunan: selectedHouse.kategoriBangunan || 'RUMAH_TINGGAL',
                      jenisFasilitas: selectedHouse.jenisFasilitas || '',
                    });
                    const cleanD = stripNonDigits(selectedHouse.nopPbb || '');
                    if (cleanD.length >= 8) {
                      const match = pbbSpptList.find(
                        (i) => stripNonDigits(i.nop) === cleanD || (cleanD.length >= 10 && stripNonDigits(i.nop).endsWith(cleanD))
                      );
                      setMatchedPbbItem(match || null);
                    } else {
                      setMatchedPbbItem(null);
                    }
                    setIsPbbPickerOpen(false);
                    setIsHouseModalOpen(true);
                  }}
                  className="flex-1 py-1.5 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 text-center cursor-pointer"
                >
                  ✏️ Edit Data Lengkap
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm(`Hapus titik rumah ${selectedHouse.namaKepalaKeluarga}?`)) {
                      const houseId = selectedHouse.id;
                      setHouses((prev) => prev.filter((h) => h.id !== houseId));
                      setSelectedHouse(null);
                      deleteHouseFromFirestore(houseId).catch(() => {});
                      onShowToast?.('Titik rumah berhasil dihapus', 'info');
                    }
                  }}
                  className="p-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                  title="Hapus Rumah"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : selectedRoad ? (
            /* Selected Road Detail Card */
            <div className="bg-white rounded-2xl p-4 border border-amber-300 shadow-md space-y-3 animate-fade-in">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Ruas Jalan Lk {selectedRoad.lingkunganNomor}
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-sm mt-1">
                    {selectedRoad.namaJalan}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedRoad(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs border-t border-slate-100 pt-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Dimensi:</span>
                  <span className="font-bold text-slate-800">
                    Panjang {selectedRoad.panjangMeter} m | Lebar {selectedRoad.lebarMeter} m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Perkerasan:</span>
                  <span className="font-bold text-slate-800">{selectedRoad.jenisPerkerasan}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                  <span className="text-slate-600 font-medium">Kondisi Jalan:</span>
                  <span
                    className={`font-black px-2 py-0.5 rounded text-[10px] ${
                      selectedRoad.kondisiJalan === 'BAIK'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedRoad.kondisiJalan === 'RUSAK_SEDANG'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {selectedRoad.kondisiJalan}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                  <span className="text-slate-600 font-medium">Drainase:</span>
                  <span className="font-bold text-slate-800">{selectedRoad.kondisiDrainase}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (confirm(`Hapus ruas jalan ${selectedRoad.namaJalan}?`)) {
                    const roadId = selectedRoad.id;
                    setRoads((prev) => prev.filter((r) => r.id !== roadId));
                    setSelectedRoad(null);
                    deleteRoadFromFirestore(roadId).catch(() => {});
                    onShowToast?.('Ruas jalan berhasil dihapus', 'info');
                  }
                }}
                className="w-full py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs hover:bg-rose-100 cursor-pointer"
              >
                Hapus Ruas Jalan
              </button>
            </div>
          ) : selectedPolygon ? (
            /* Selected Polygon Detail Card */
            <div className="bg-white rounded-2xl p-4 border border-blue-300 shadow-md space-y-3 animate-fade-in">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    Wilayah Administrasi
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-sm mt-1">
                    {selectedPolygon.lingkunganNama}
                  </h3>
                  <p className="text-xs text-slate-500">Kepling: {selectedPolygon.keplingNama}</p>
                </div>
                <button
                  onClick={() => setSelectedPolygon(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs border-t border-slate-100 pt-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Titik Sudut:</span>
                  <span className="font-bold text-slate-800">
                    {selectedPolygon.coordinates?.length || 0} Titik
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Diperbarui:</span>
                  <span className="font-medium text-slate-600">
                    {new Date(selectedPolygon.updatedAt).toLocaleDateString('id-ID')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleStartDrawPolygon(selectedPolygon.lingkunganId)}
                className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-xs cursor-pointer"
              >
                ✏️ Gambar Ulang Batas Wilayah Ini
              </button>
            </div>
          ) : (
            /* Default Instruction Card */
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2 text-slate-800">
                <Info className="w-4 h-4 text-emerald-700" />
                <h4 className="font-extrabold text-xs">Petunjuk Penggunaan WebGIS</h4>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                <li>
                  <b>Klik area warna</b> di peta untuk melihat profil Lingkungan 1 s/d 24.
                </li>
                <li>
                  <b>Klik pin rumah</b> (🟢/🔴/🎁) untuk melihat data KK, WRS, dan Bansos.
                </li>
                <li>
                  Gunakan tombol <b>"Gambar Batas Wilayah"</b> untuk menarik garis poligon batas
                  lingkungan Anda.
                </li>
                <li>
                  Tekan <b>"+ Tambah Titik Bangunan"</b> saat di lapangan untuk menandai posisi bangunan / rumah / fasilitas warga.
                </li>
              </ul>
            </div>
          )}

          {/* Quick List of 24 Lingkungan (Admin / Kasi Only) */}
          {isAdmin && (
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs space-y-2 max-h-[300px] overflow-y-auto">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider px-1">
                Daftar 24 Lingkungan:
              </h4>
              <div className="space-y-1">
                {KEPLING_ACCOUNTS.map((acc) => {
                  const countH = houses.filter((h) => h.lingkunganId === acc.id).length;
                  const isSelected = filterLingkungan === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setFilterLingkungan(acc.id);
                        const poly = polygons.find((p) => p.lingkunganId === acc.id);
                        if (poly && poly.coordinates.length >= 3 && mapInstanceRef.current) {
                          setSelectedPolygon(poly);
                          const b = L.latLngBounds(poly.coordinates.map((c) => [c[0], c[1]]));
                          mapInstanceRef.current.fitBounds(b, { padding: [40, 40] });
                        }
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-900 text-white font-black'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold truncate">{acc.lingkungan}</div>
                        <div className="text-[10px] opacity-75 truncate">{acc.nama}</div>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-black shrink-0 ${
                          isSelected
                            ? 'bg-emerald-800 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {countH} Titik
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: TAMBAH / EDIT TITIK BANGUNAN */}
      {isHouseModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingHouse ? 'Edit Titik Bangunan / Fasilitas' : 'Tambah Titik Bangunan'}
                </h3>
                <p className="text-xs text-slate-500">
                  Data kependudukan, kepatuhan sampah, dan bantuan sosial
                </p>
              </div>
              <button
                onClick={() => setIsHouseModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHouse} className="space-y-4 text-xs">
              {/* SAVING IN PROGRESS WARNING INDICATOR */}
              {isSavingHouse && (
                <div className="p-4 bg-amber-500/15 border-2 border-amber-500/60 rounded-2xl flex items-center gap-3 text-amber-950 animate-pulse shadow-sm">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-600 shrink-0" />
                  <div>
                    <div className="font-black text-xs sm:text-sm">
                      ⏳ SEDANG MENYIMPAN DATA KE FIRESTORE DATABASE
                    </div>
                    <div className="text-[11px] text-amber-800">
                      Sistem sedang mengirim koordinat &amp; data ke server online. Mohon jangan menutup modal...
                    </div>
                  </div>
                </div>
              )}
              {/* Lingkungan Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Lingkungan:</label>
                <select
                  value={houseForm.lingkunganId}
                  onChange={(e) =>
                    setHouseForm((prev) => ({ ...prev, lingkunganId: e.target.value }))
                  }
                  disabled={isKepling}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-slate-50 font-bold text-slate-800"
                >
                  {KEPLING_ACCOUNTS.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.lingkungan} — {acc.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* INTEGRASI GOOGLE MAPS & LEAFLET: DETEKSI NAMA JALAN & GANG OTOMATIS */}
              <div className="p-3.5 bg-gradient-to-br from-emerald-50 via-teal-50 to-blue-50 border-2 border-emerald-300/90 rounded-2xl space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-950 font-black text-xs">
                    <span className="text-base">🌐</span>
                    <span>Integrasi Google Maps & Leaflet: Deteksi Jalan & Gang</span>
                  </div>
                  {isDetectingStreet && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Mendeteksi...
                    </span>
                  )}
                </div>

                {/* Quick Input: Paste Google Maps Link or Raw Coordinates */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tempel Tautan Google Maps / Koordinat (Otomatis Deteksi):
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="misal: https://maps.app.goo.gl/... atau 3.532434, 98.642649"
                      value={googleMapsUrlInput}
                      onChange={(e) => handlePasteGoogleMapsUrl(e.target.value)}
                      className="flex-1 p-2 rounded-xl border border-emerald-300 bg-white text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                    />
                    {googleMapsUrlInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setGoogleMapsUrlInput('');
                        }}
                        className="px-2.5 rounded-xl bg-slate-200 text-slate-600 hover:bg-slate-300 text-xs font-bold cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    💡 Salin tautan Google Maps (dari WhatsApp/HP) lalu tempel di sini. Koordinat, nama jalan, dan gang akan terisi otomatis.
                  </p>
                </div>

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleAutoDetectStreet()}
                    disabled={isDetectingStreet}
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
                    title="Deteksi nama jalan & gang dari koordinat Latitude/Longitude saat ini"
                  >
                    <Search className="w-3 h-3" />
                    <span>Deteksi Jalan</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGetHouseGPS}
                    disabled={isDetectingStreet}
                    className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
                    title="Kunci titik GPS HP/laptop dan deteksi jalan secara otomatis"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>GPS + Deteksi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHouseModalOpen(false);
                      setIsPickingCoordinate(true);
                      onShowToast?.(
                        'Silakan klik posisi rumah warga di peta untuk mengambil koordinat & deteksi jalan',
                        'info'
                      );
                    }}
                    className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                    title="Klik langsung titik lokasi rumah di peta Leaflet"
                  >
                    <Compass className="w-3 h-3" />
                    <span>Pilih di Peta</span>
                  </button>
                </div>

                {/* Detected Overlay Info Badge */}
                {detectedStreetOverlay && (
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-300 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-emerald-800 flex items-center gap-1">
                        <span>{detectedStreetOverlay.isGang ? '🏘️' : '🛣️'}</span>
                        <span>
                          {detectedStreetOverlay.isGang
                            ? 'Gang / Lorong Terdeteksi:'
                            : 'Nama Jalan Terdeteksi:'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setHouseForm((prev) => ({
                            ...prev,
                            namaJalan: detectedStreetOverlay.streetName,
                          }));
                          onShowToast?.('Nama jalan berhasil diterapkan ke formulir!', 'success');
                        }}
                        className="text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded cursor-pointer"
                      >
                        ✓ Gunakan Nama Ini
                      </button>
                    </div>
                    <div className="font-black text-slate-900 text-xs">
                      {detectedStreetOverlay.streetName}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center justify-between">
                      <span>
                        📍 {detectedStreetOverlay.lat.toFixed(6)},{' '}
                        {detectedStreetOverlay.lng.toFixed(6)}
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${detectedStreetOverlay.lat},${detectedStreetOverlay.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline font-bold flex items-center gap-0.5"
                      >
                        Buka Google Maps ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Nama Jalan & No Rumah */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Jalan / Gang / Lorong:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="misal: Jl. Tembakau Raya Gg. Mawar"
                    value={houseForm.namaJalan}
                    onChange={(e) =>
                      setHouseForm((prev) => ({ ...prev, namaJalan: e.target.value }))
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {houseForm.kategoriBangunan === 'RUMAH_TINGGAL' ? 'No. Rumah:' : 'No. Bangunan (Opsional):'}
                  </label>
                  <input
                    type="text"
                    required={houseForm.kategoriBangunan === 'RUMAH_TINGGAL'}
                    placeholder={houseForm.kategoriBangunan === 'RUMAH_TINGGAL' ? 'No. 14A' : 'Opsional / S/N'}
                    value={houseForm.nomorRumah}
                    onChange={(e) =>
                      setHouseForm((prev) => ({ ...prev, nomorRumah: e.target.value }))
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Kategori Bangunan / Fasilitas Umum / Ibadah / Sekolah / Kesehatan / SPBU / Pasar */}
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl space-y-2">
                <label className="block font-black text-teal-950 text-xs">🏛️ Pilih Kategori Jenis Bangunan / Fasilitas:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { id: 'RUMAH_TINGGAL', label: '🏠 Rumah Tinggal' },
                    { id: 'FASILITAS_KESEHATAN', label: '🏥 Puskesmas / Pustu' },
                    { id: 'SPBU_STASIUN', label: '⛽ SPBU / Pertashop' },
                    { id: 'RUMAH_IBADAH', label: '⛪ Rumah Ibadah' },
                    { id: 'SEKOLAH', label: '🏫 Sekolah / Kampus' },
                    { id: 'KANTOR_FASUM', label: '🏢 Kantor / Pelayanan' },
                    { id: 'RUANG_PUBLIK_TAMAN', label: '🛝 Taman / Poskamling' },
                    { id: 'PASAR_SARANA_EKONOMI', label: '🛒 Pasar / Bank / ATM' },
                    { id: 'RUMAH_USAHA', label: '🏪 Toko / Usaha' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        let defaultJenis = '';
                        if (cat.id === 'FASILITAS_KESEHATAN') defaultJenis = 'Puskesmas Pembantu (Pustu)';
                        else if (cat.id === 'SPBU_STASIUN') defaultJenis = 'SPBU Pertamina Resmi';
                        else if (cat.id === 'RUMAH_IBADAH') defaultJenis = 'Gereja';
                        else if (cat.id === 'SEKOLAH') defaultJenis = 'SD Negeri / Swasta';
                        else if (cat.id === 'KANTOR_FASUM') defaultJenis = 'Kantor Kelurahan';
                        else if (cat.id === 'RUANG_PUBLIK_TAMAN') defaultJenis = 'Poskamling / Pos Ronda';
                        else if (cat.id === 'PASAR_SARANA_EKONOMI') defaultJenis = 'Pasar Tradisional';

                        setHouseForm((prev) => ({
                          ...prev,
                          kategoriBangunan: cat.id as any,
                          jenisFasilitas: defaultJenis || prev.jenisFasilitas,
                        }));
                      }}
                      className={`p-2 rounded-xl text-left text-xs font-bold border transition-all cursor-pointer ${
                        houseForm.kategoriBangunan === cat.id
                          ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                          : 'bg-white text-teal-900 border-teal-200 hover:bg-teal-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Sub-Kategori Dynamic Selectors */}
                {houseForm.kategoriBangunan === 'FASILITAS_KESEHATAN' && (
                  <div className="pt-2 border-t border-teal-200">
                    <label className="block font-bold text-teal-900 mb-1 text-[11px]">Jenis Fasilitas Kesehatan:</label>
                    <select
                      value={houseForm.jenisFasilitas || 'Puskesmas Pembantu (Pustu)'}
                      onChange={(e) => setHouseForm((prev) => ({ ...prev, jenisFasilitas: e.target.value }))}
                      className="w-full p-2 rounded-xl border border-teal-300 bg-white text-xs font-bold text-teal-950"
                    >
                      {['Puskesmas Pembantu (Pustu)', 'Puskesmas Induk', 'Posyandu Lingkungan', 'Klinik Pratama / Swasta', 'Rumah Sakit / Bersalin', 'Apotek / Laboratorium'].map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  </div>
                )}

                {houseForm.kategoriBangunan === 'SPBU_STASIUN' && (
                  <div className="pt-2 border-t border-teal-200">
                    <label className="block font-bold text-teal-900 mb-1 text-[11px]">Jenis SPBU / Stasiun Pengisian:</label>
                    <select
                      value={houseForm.jenisFasilitas || 'SPBU Pertamina'}
                      onChange={(e) => setHouseForm((prev) => ({ ...prev, jenisFasilitas: e.target.value }))}
                      className="w-full p-2 rounded-xl border border-teal-300 bg-white text-xs font-bold text-teal-950"
                    >
                      {['SPBU Pertamina Resmi', 'Pertashop / SPBU Mini', 'Stasiun Pengisian Listrik (EV Charger)', 'Pangkalan / Sub-Agen LPG'].map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  </div>
                )}

                {houseForm.kategoriBangunan === 'RUMAH_IBADAH' && (
                  <div className="pt-2 border-t border-teal-200">
                    <label className="block font-bold text-teal-900 mb-1 text-[11px]">Jenis Rumah Ibadah:</label>
                    <select
                      value={houseForm.jenisFasilitas || 'Gereja'}
                      onChange={(e) => setHouseForm((prev) => ({ ...prev, jenisFasilitas: e.target.value }))}
                      className="w-full p-2 rounded-xl border border-teal-300 bg-white text-xs font-bold text-teal-950"
                    >
                      {['Gereja', 'Masjid', 'Mushola', 'Vihara', 'Pura', 'Klenteng'].map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  </div>
                )}

                {houseForm.kategoriBangunan === 'SEKOLAH' && (
                  <div className="pt-2 border-t border-teal-200">
                    <label className="block font-bold text-teal-900 mb-1 text-[11px]">Jenjang &amp; Nama Sekolah:</label>
                    <select
                      value={houseForm.jenisFasilitas || 'SD Negeri / Swasta'}
                      onChange={(e) => setHouseForm((prev) => ({ ...prev, jenisFasilitas: e.target.value }))}
                      className="w-full p-2 rounded-xl border border-teal-300 bg-white text-xs font-bold text-teal-950"
                    >
                      {['SD Negeri / Swasta', 'SMP Negeri / Swasta', 'SMA / SMK Negeri / Swasta', 'Universitas / Perguruan Tinggi', 'PAUD / TK', 'Madrasah / Pesantren'].map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  </div>
                )}

                {houseForm.kategoriBangunan === 'KANTOR_FASUM' && (
                  <div className="pt-2 border-t border-teal-200">
                    <label className="block font-bold text-teal-900 mb-1 text-[11px]">Jenis Pelayanan Publik / Kantor:</label>
                    <select
                      value={houseForm.jenisFasilitas || 'Kantor Kelurahan'}
                      onChange={(e) => setHouseForm((prev) => ({ ...prev, jenisFasilitas: e.target.value }))}
                      className="w-full p-2 rounded-xl border border-teal-300 bg-white text-xs font-bold text-teal-950"
                    >
                      {['Kantor Kelurahan', 'Kantor Polisi / Polsek / Bhabinkamtibmas', 'Pos Koramil / Babinsa', 'Kantor Pos / Logistik', 'Bank / Kantor BUMD', 'Pos Damkar / BPBD'].map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  </div>
                )}

                {houseForm.kategoriBangunan === 'RUANG_PUBLIK_TAMAN' && (
                  <div className="pt-2 border-t border-teal-200">
                    <label className="block font-bold text-teal-900 mb-1 text-[11px]">Jenis Ruang Publik / Sarana:</label>
                    <select
                      value={houseForm.jenisFasilitas || 'Poskamling / Pos Ronda'}
                      onChange={(e) => setHouseForm((prev) => ({ ...prev, jenisFasilitas: e.target.value }))}
                      className="w-full p-2 rounded-xl border border-teal-300 bg-white text-xs font-bold text-teal-950"
                    >
                      {['Poskamling / Pos Ronda', 'Taman Kota / RPTRA', 'Lapangan Olahraga / Futsal', 'Balai Serbaguna / Gedung Pertemuan', 'TPU / Pemakaman Umum'].map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  </div>
                )}

                {houseForm.kategoriBangunan === 'PASAR_SARANA_EKONOMI' && (
                  <div className="pt-2 border-t border-teal-200">
                    <label className="block font-bold text-teal-900 mb-1 text-[11px]">Jenis Sarana Ekonomi / Pasar:</label>
                    <select
                      value={houseForm.jenisFasilitas || 'Pasar Tradisional'}
                      onChange={(e) => setHouseForm((prev) => ({ ...prev, jenisFasilitas: e.target.value }))}
                      className="w-full p-2 rounded-xl border border-teal-300 bg-white text-xs font-bold text-teal-950"
                    >
                      {['Pasar Tradisional', 'Minimarket (Indomaret / Alfamart)', 'Bank / Galeri ATM Center', 'Gudang / Sentra Logistik'].map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Nama KK atau Nama Bangunan / Fasilitas */}
              <div className={houseForm.kategoriBangunan === 'RUMAH_TINGGAL' ? "grid grid-cols-2 gap-2" : "block"}>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {houseForm.kategoriBangunan === 'RUMAH_TINGGAL'
                      ? 'Nama Kepala Keluarga (KK):'
                      : 'Nama Bangunan / Fasilitas / Tempat:'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      houseForm.kategoriBangunan === 'RUMAH_TINGGAL'
                        ? 'Nama Lengkap KK'
                        : houseForm.kategoriBangunan === 'FASILITAS_KESEHATAN'
                        ? 'contoh: Puskesmas Pembantu Mangga / Pustu'
                        : houseForm.kategoriBangunan === 'SPBU_STASIUN'
                        ? 'contoh: SPBU Tembakau Raya / Pertashop'
                        : houseForm.kategoriBangunan === 'RUMAH_IBADAH'
                        ? 'contoh: Gereja HKBP / Masjid Al-Ikhlas'
                        : houseForm.kategoriBangunan === 'SEKOLAH'
                        ? 'contoh: SD Negeri 060932 Mangga'
                        : houseForm.kategoriBangunan === 'RUANG_PUBLIK_TAMAN'
                        ? 'contoh: Poskamling Lingkungan IV'
                        : houseForm.kategoriBangunan === 'PASAR_SARANA_EKONOMI'
                        ? 'contoh: Pasar Mangga / Indomaret Tembakau'
                        : 'Nama Bangunan / Tempat / Pengelola'
                    }
                    value={houseForm.namaKepalaKeluarga}
                    onChange={(e) =>
                      setHouseForm((prev) => ({ ...prev, namaKepalaKeluarga: e.target.value }))
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
                {houseForm.kategoriBangunan === 'RUMAH_TINGGAL' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">NIK KK (Opsional):</label>
                    <input
                      type="text"
                      placeholder="127101..."
                      value={houseForm.nikKk}
                      onChange={(e) => setHouseForm((prev) => ({ ...prev, nikKk: e.target.value }))}
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    />
                  </div>
                )}
              </div>

              {/* STATUS KARTU KELUARGA (HANYA UNTUK RUMAH TINGGAL) */}
              {houseForm.kategoriBangunan === 'RUMAH_TINGGAL' ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl space-y-2">
                  <label className="block font-black text-blue-950 text-xs">
                    🪪 Domisili / Status Kartu Keluarga (KK):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setHouseForm((prev) => ({
                          ...prev,
                          isKkMangga: true,
                          asalKk: 'Kelurahan Mangga',
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        houseForm.isKkMangga
                          ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                          : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      <span className="text-base">🏠</span>
                      <div>
                        <div>KK Kelurahan Mangga</div>
                        <div className={`text-[10px] font-normal ${houseForm.isKkMangga ? 'text-blue-100' : 'text-slate-500'}`}>
                          Warga Asli / Ber-KK Setempat
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setHouseForm((prev) => ({
                          ...prev,
                          isKkMangga: false,
                          asalKk: prev.asalKk && prev.asalKk !== 'Kelurahan Mangga' ? prev.asalKk : '',
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        !houseForm.isKkMangga
                          ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-base">🌐</span>
                      <div>
                        <div>Bukan KK Kelurahan Mangga</div>
                        <div className={`text-[10px] font-normal ${!houseForm.isKkMangga ? 'text-amber-100' : 'text-slate-500'}`}>
                          Pendatang / Domisili Luar
                        </div>
                      </div>
                    </button>
                  </div>

                  {!houseForm.isKkMangga && (
                    <div className="pt-2 border-t border-blue-200">
                      <label className="block font-bold text-blue-900 mb-1 text-[11px]">
                        Keterangan Asal / Domisili KK Luar (Opsional):
                      </label>
                      <input
                        type="text"
                        value={houseForm.asalKk}
                        onChange={(e) => setHouseForm((prev) => ({ ...prev, asalKk: e.target.value }))}
                        placeholder="Contoh: Kelurahan Simpang Selayang / Luar Kota Medan"
                        className="w-full p-2 rounded-xl border border-blue-300 bg-white text-xs font-medium text-slate-800"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2.5 bg-slate-100 border border-slate-300/80 rounded-2xl flex items-center gap-2 text-slate-700 text-[11px]">
                  <span className="text-base shrink-0">ℹ️</span>
                  <span>
                    Kategori <b>Fasilitas Publik / Tempat Usaha</b> tidak memerlukan pengisian data Kartu Keluarga (KK), NIK KK, maupun demografi jiwa.
                  </span>
                </div>
              )}

              {/* STATUS WRS (WAJIB RETRIBUSI SAMPAH) */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                <label className="block font-black text-emerald-950">
                  🗑️ Status Wajib Retribusi Sampah (WRS):
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label
                    className={`flex items-center gap-1.5 p-2.5 rounded-xl border cursor-pointer ${
                      houseForm.statusWrs === 'AKTIF'
                        ? 'bg-emerald-600 text-white border-emerald-700 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="statusWrs"
                      checked={houseForm.statusWrs === 'AKTIF'}
                      onChange={() => setHouseForm((prev) => ({ ...prev, statusWrs: 'AKTIF' }))}
                      className="hidden"
                    />
                    <span>🟢 Aktif Berlangganan</span>
                  </label>
                  <label
                    className={`flex items-center gap-1.5 p-2.5 rounded-xl border cursor-pointer ${
                      houseForm.statusWrs === 'BEBAS_WRS'
                        ? 'bg-sky-600 text-white border-sky-700 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="statusWrs"
                      checked={houseForm.statusWrs === 'BEBAS_WRS'}
                      onChange={() => setHouseForm((prev) => ({ ...prev, statusWrs: 'BEBAS_WRS' }))}
                      className="hidden"
                    />
                    <span>🔵 Bebas WRS</span>
                  </label>
                  <label
                    className={`flex items-center gap-1.5 p-2.5 rounded-xl border cursor-pointer ${
                      houseForm.statusWrs === 'BELUM_MENOLAK'
                        ? 'bg-rose-600 text-white border-rose-700 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="statusWrs"
                      checked={houseForm.statusWrs === 'BELUM_MENOLAK'}
                      onChange={() =>
                        setHouseForm((prev) => ({ ...prev, statusWrs: 'BELUM_MENOLAK' }))
                      }
                      className="hidden"
                    />
                    <span>🔴 Belum / Menolak</span>
                  </label>
                  <label
                    className={`flex items-center gap-1.5 p-2.5 rounded-xl border cursor-pointer ${
                      houseForm.statusWrs === 'MANDIRI'
                        ? 'bg-amber-600 text-white border-amber-700 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="statusWrs"
                      checked={houseForm.statusWrs === 'MANDIRI'}
                      onChange={() => setHouseForm((prev) => ({ ...prev, statusWrs: 'MANDIRI' }))}
                      className="hidden"
                    />
                    <span>🟡 Pengelolaan Mandiri</span>
                  </label>
                </div>
              </div>

              {/* PAJAK BUMI & BANGUNAN (PBB) */}
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl space-y-2.5">
                <label className="block font-black text-teal-950">
                  🏛️ Pajak Bumi &amp; Bangunan (PBB):
                </label>

                {/* Status PBB */}
                <div className="grid grid-cols-3 gap-2">
                  <label
                    className={`flex items-center justify-center p-2 rounded-xl border text-center cursor-pointer ${
                      houseForm.statusPbb === 'LUNAS'
                        ? 'bg-emerald-600 text-white border-emerald-700 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="statusPbb"
                      checked={houseForm.statusPbb === 'LUNAS'}
                      onChange={() => setHouseForm((prev) => ({ ...prev, statusPbb: 'LUNAS' }))}
                      className="hidden"
                    />
                    <span>🟢 Lunas</span>
                  </label>

                  <label
                    className={`flex items-center justify-center p-2 rounded-xl border text-center cursor-pointer ${
                      houseForm.statusPbb === 'BELUM_LUNAS'
                        ? 'bg-rose-600 text-white border-rose-700 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="statusPbb"
                      checked={houseForm.statusPbb === 'BELUM_LUNAS'}
                      onChange={() => setHouseForm((prev) => ({ ...prev, statusPbb: 'BELUM_LUNAS' }))}
                      className="hidden"
                    />
                    <span>🔴 Belum Lunas</span>
                  </label>

                  <label
                    className={`flex items-center justify-center p-2 rounded-xl border text-center cursor-pointer ${
                      houseForm.statusPbb === 'BEBAS_PAJAK'
                        ? 'bg-sky-600 text-white border-sky-700 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="statusPbb"
                      checked={houseForm.statusPbb === 'BEBAS_PAJAK'}
                      onChange={() => setHouseForm((prev) => ({ ...prev, statusPbb: 'BEBAS_PAJAK' }))}
                      className="hidden"
                    />
                    <span>🔵 Bebas Pajak</span>
                  </label>
                </div>

                {/* NOP, Ketetapan, Tahun */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-700 text-xs">
                      NOP PBB: <span className="font-normal text-slate-500">(18 Digit)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setPbbPickerSearch('');
                        setIsPbbPickerOpen(!isPbbPickerOpen);
                      }}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-3xs"
                    >
                      <Search className="w-3 h-3" />
                      <span>{isPbbPickerOpen ? 'Tutup Daftar' : 'Cari di Database PBB'}</span>
                    </button>
                  </div>

                  {/* NOP Picker Dropdown / Search panel if open */}
                  {isPbbPickerOpen && (
                    <div className="p-3 bg-white rounded-2xl border-2 border-emerald-400 shadow-xl space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5">
                        <span className="flex items-center gap-1.5 text-emerald-900">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Pilih SPPT Realisasi PBB:
                        </span>
                        <span className="text-[10px] text-slate-500">{pbbNopSuggestions.length} Data Tersedia</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Ketik nama WP, NOP, atau alamat objek..."
                        value={pbbPickerSearch}
                        onChange={(e) => setPbbPickerSearch(e.target.value)}
                        className="w-full p-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                      />
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 space-y-1 pr-1 custom-scrollbar">
                        {pbbNopSuggestions
                          .filter((s) => {
                            if (!pbbPickerSearch.trim()) return true;
                            const q = pbbPickerSearch.toLowerCase();
                            return (
                              s.nop.toLowerCase().includes(q) ||
                              s.namaWp.toLowerCase().includes(q) ||
                              s.alamatOp.toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 20)
                          .map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleApplySpptToHouse(s)}
                              className="w-full text-left p-2 rounded-xl hover:bg-emerald-50 transition-colors flex items-center justify-between gap-2 cursor-pointer border border-transparent hover:border-emerald-200"
                            >
                              <div className="truncate flex-1">
                                <p className="font-bold text-slate-900 text-xs truncate">{s.namaWp}</p>
                                <p className="font-mono text-[10px] text-slate-500">{formatNopPbb(s.nop)}</p>
                                <p className="text-[10px] text-slate-600 truncate">{s.alamatOp}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                    s.status === 'Sudah Bayar'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {s.status === 'Sudah Bayar' ? 'LUNAS' : 'BELUM'}
                                </span>
                                <p className="text-[11px] font-bold text-slate-800 mt-0.5">
                                  Rp {s.pbbTerutang?.toLocaleString('id-ID')}
                                </p>
                              </div>
                            </button>
                          ))}
                        {pbbNopSuggestions.length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-2">Belum ada data SPPT di lingkungan ini.</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-1">
                      <input
                        type="text"
                        list="pbb-nop-datalist"
                        placeholder="12.75.010.009.001-0010.0"
                        value={houseForm.nopPbb}
                        onChange={(e) => handleNopPbbChange(e.target.value)}
                        className="w-full p-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                      />
                      <datalist id="pbb-nop-datalist">
                        {pbbNopSuggestions.slice(0, 50).map((s) => (
                          <option key={s.id} value={formatNopPbb(s.nop)}>
                            {s.namaWp} - Rp {s.pbbTerutang?.toLocaleString('id-ID')} ({s.status})
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="Ketetapan (Rp)"
                        value={houseForm.nominalPbb}
                        onChange={(e) =>
                          setHouseForm((prev) => ({ ...prev, nominalPbb: e.target.value === '' ? '' : +e.target.value }))
                        }
                        className="w-full p-2 rounded-xl border border-slate-300 font-bold text-xs"
                      />
                    </div>

                    <div>
                      <input
                        type="number"
                        min="2020"
                        max="2030"
                        placeholder="Tahun (2026)"
                        value={houseForm.tahunPbb}
                        onChange={(e) =>
                          setHouseForm((prev) => ({ ...prev, tahunPbb: e.target.value === '' ? '' : +e.target.value }))
                        }
                        className="w-full p-2 rounded-xl border border-slate-300 font-bold text-xs"
                      />
                    </div>
                  </div>

                  {/* Realtime PBB Match Feedback Card */}
                  {matchedPbbItem ? (
                    <div className="p-3 rounded-2xl bg-emerald-50/90 border border-emerald-300 text-xs text-emerald-950 flex items-start gap-2.5 shadow-2xs animate-fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className="font-black text-emerald-900 text-xs">
                            ✅ NOP Terhubung ke Realisasi PBB
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase shadow-2xs ${
                              matchedPbbItem.status === 'Sudah Bayar'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {matchedPbbItem.status === 'Sudah Bayar' ? '🟢 SUDAH LUNAS' : '🔴 BELUM LUNAS'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-800">
                          Wajib Pajak: <strong>{matchedPbbItem.namaWp}</strong> • Ketetapan: <strong>Rp {matchedPbbItem.pbbTerutang?.toLocaleString('id-ID')}</strong>
                        </p>
                        <p className="text-[10px] text-slate-600 truncate">
                          Alamat Objek: {matchedPbbItem.alamatOp}
                        </p>
                        <div className="flex gap-2 pt-1 flex-wrap">
                          {houseForm.namaKepalaKeluarga !== matchedPbbItem.namaWp && (
                            <button
                              type="button"
                              onClick={() => setHouseForm((prev) => ({ ...prev, namaKepalaKeluarga: matchedPbbItem.namaWp }))}
                              className="px-2 py-0.5 bg-emerald-200 hover:bg-emerald-300 text-emerald-900 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Gunakan Nama WP: {matchedPbbItem.namaWp}
                            </button>
                          )}
                          {houseForm.namaJalan !== matchedPbbItem.alamatOp && (
                            <button
                              type="button"
                              onClick={() => setHouseForm((prev) => ({ ...prev, namaJalan: matchedPbbItem.alamatOp }))}
                              className="px-2 py-0.5 bg-emerald-200 hover:bg-emerald-300 text-emerald-900 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Gunakan Alamat OP: {matchedPbbItem.alamatOp}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : stripNonDigits(houseForm.nopPbb).length >= 10 ? (
                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>NOP belum terdaftar di tabel SPPT PBB (Ketetapan &amp; status bayar tetap bisa diatur manual).</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* BANTUAN SOSIAL */}
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-black text-purple-950">🎁 Bantuan Sosial (Bansos):</label>
                  <label className="flex items-center gap-2 font-bold text-purple-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={houseForm.penerimaBansos}
                      onChange={(e) =>
                        setHouseForm((prev) => ({ ...prev, penerimaBansos: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-purple-600"
                    />
                    <span>Penerima Bansos</span>
                  </label>
                </div>
                {houseForm.penerimaBansos && (
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap gap-2">
                      {['PKH', 'BPNT', 'BLT', 'PBI-JK'].map((prog) => (
                        <label
                          key={prog}
                          className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-purple-200 text-purple-900 font-semibold cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={houseForm.jenisBansos.includes(prog)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setHouseForm((prev) => ({
                                  ...prev,
                                  jenisBansos: [...prev.jenisBansos, prog],
                                }));
                              } else {
                                setHouseForm((prev) => ({
                                  ...prev,
                                  jenisBansos: prev.jenisBansos.filter((x) => x !== prog),
                                }));
                              }
                            }}
                            className="rounded text-purple-600"
                          />
                          <span>{prog}</span>
                        </label>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-purple-200">
                      <label className="block font-bold text-xs text-purple-900 mb-1">Klasifikasi Desil Kemiskinan:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {['Desil 1', 'Desil 2', 'Desil 3', 'Desil 4', 'Desil 5', 'Desil 6-10'].map((d) => (
                          <label
                            key={d}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                              houseForm.desilBansos === d
                                ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                                : 'bg-white text-purple-900 border-purple-200 hover:bg-purple-100'
                            }`}
                          >
                            <input
                              type="radio"
                              name="desilBansos"
                              checked={houseForm.desilBansos === d}
                              onChange={() => setHouseForm((prev) => ({ ...prev, desilBansos: d }))}
                              className="hidden"
                            />
                            <span>{d}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Demografi: Jiwa, Laki, Perempuan, Lansia, Anak */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-xs">
                    Total Jiwa <span className="text-[10px] text-emerald-600 font-bold block sm:inline">(Otomatis L+P)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    readOnly
                    placeholder="0"
                    value={((Number(houseForm.jumlahLakiLaki) || 0) + (Number(houseForm.jumlahPerempuan) || 0)) || ''}
                    className="w-full p-2 rounded-xl border border-emerald-400 bg-emerald-50/80 font-black text-emerald-950 cursor-not-allowed text-center"
                    title="Dihitung otomatis: Laki-laki + Perempuan"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1 text-xs">Laki-laki:</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="misal: 2"
                    value={houseForm.jumlahLakiLaki}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(0, +e.target.value);
                      setHouseForm((prev) => ({
                        ...prev,
                        jumlahLakiLaki: val,
                        jumlahJiwa: (val === '' ? 0 : val) + (Number(prev.jumlahPerempuan) || 0),
                      }));
                    }}
                    className="w-full p-2 rounded-xl border border-slate-300 font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1 text-xs">Perempuan:</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="misal: 2"
                    value={houseForm.jumlahPerempuan}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(0, +e.target.value);
                      setHouseForm((prev) => ({
                        ...prev,
                        jumlahPerempuan: val,
                        jumlahJiwa: (Number(prev.jumlahLakiLaki) || 0) + (val === '' ? 0 : val),
                      }));
                    }}
                    className="w-full p-2 rounded-xl border border-slate-300 font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1 text-xs">Lansia (≥60):</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="misal: 0"
                    value={houseForm.jumlahLansia}
                    onChange={(e) =>
                      setHouseForm((prev) => ({ ...prev, jumlahLansia: e.target.value === '' ? '' : +e.target.value }))
                    }
                    className="w-full p-2 rounded-xl border border-slate-300 text-center"
                  />
                </div>
              </div>

              {/* Pekerjaan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pekerjaan Utama Kepala Keluarga:
                </label>
                <input
                  type="text"
                  placeholder="misal: Wiraswasta / Karyawan Swasta / ASN"
                  value={houseForm.pekerjaanKk}
                  onChange={(e) =>
                    setHouseForm((prev) => ({ ...prev, pekerjaanKk: e.target.value }))
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              {/* Luas Tanah & Bangunan (m²) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-xs text-slate-700 mb-1">
                    Luas Tanah (m²) <span className="text-[10px] text-slate-500 font-normal block sm:inline">(Opsional)</span>:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={houseForm.luasTanahM2}
                    onChange={(e) => setHouseForm((prev) => ({ ...prev, luasTanahM2: e.target.value === '' ? '' : +e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 text-xs"
                    placeholder="misal: 100 (boleh dikosongkan)"
                  />
                </div>
                <div>
                  <label className="block font-bold text-xs text-slate-700 mb-1">
                    Luas Bangunan (m²) <span className="text-[10px] text-slate-500 font-normal block sm:inline">(Opsional)</span>:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={houseForm.luasBangunanM2}
                    onChange={(e) => setHouseForm((prev) => ({ ...prev, luasBangunanM2: e.target.value === '' ? '' : +e.target.value }))}
                    className="w-full p-2 rounded-xl border border-slate-300 text-xs"
                    placeholder="misal: 70 (boleh dikosongkan)"
                  />
                </div>
              </div>

              {/* Usaha / UMKM di Rumah */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-black text-amber-950 text-xs">🏪 Kepemilikan Usaha / UMKM di Rumah:</label>
                  <label className="flex items-center gap-2 font-bold text-amber-900 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={houseForm.memilikiUsaha}
                      onChange={(e) => setHouseForm((prev) => ({ ...prev, memilikiUsaha: e.target.checked }))}
                      className="w-4 h-4 rounded text-amber-600"
                    />
                    <span>Ada Usaha</span>
                  </label>
                </div>
                {houseForm.memilikiUsaha && (
                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="block font-bold text-[11px] text-amber-900 mb-1">Jenis Usaha:</label>
                      <select
                        value={houseForm.jenisUsaha}
                        onChange={(e) => setHouseForm((prev) => ({ ...prev, jenisUsaha: e.target.value }))}
                        className="w-full p-2 rounded-xl border border-amber-300 bg-white text-xs font-bold text-amber-950"
                      >
                        {[
                          'Toko Kelontong / Sembako',
                          'Warung Nasi / Kuliner / Kedai Kopi',
                          'Pangkas Rambut / Salon',
                          'Bengkel Kendaraan / Tambal Ban',
                          'Laundry / Cuci Pakaian',
                          'Konveksi / Penjahit Pakaian',
                          'Dagang Eceran / Kaki Lima',
                          'Lainnya',
                        ].map((j) => (
                          <option key={j} value={j}>{j}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-[11px] text-amber-900 mb-1">Nama Usaha / Toko (Opsional):</label>
                      <input
                        type="text"
                        placeholder="Contoh: Warung Berkah / Pangkas Surya"
                        value={houseForm.namaUsaha}
                        onChange={(e) => setHouseForm((prev) => ({ ...prev, namaUsaha: e.target.value }))}
                        className="w-full p-2 rounded-xl border border-amber-300 bg-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Titik Koordinat GPS */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="font-bold text-slate-700">📍 Titik Koordinat Rumah:</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleGetHouseGPS}
                      className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Ambil GPS perangkat Anda & deteksi jalan otomatis"
                    >
                      <Navigation className="w-3 h-3" />
                      GPS
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAutoDetectStreet()}
                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Deteksi nama jalan & gang dari koordinat ini"
                    >
                      <Search className="w-3 h-3" />
                      Deteksi Jalan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsHouseModalOpen(false);
                        setIsPickingCoordinate(true);
                        onShowToast?.('Klik posisi rumah warga di peta untuk mengambil koordinat', 'info');
                      }}
                      className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-bold text-[11px] cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Pilih titik langsung di peta"
                    >
                      <Compass className="w-3 h-3" />
                      Peta
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Lat:</span>
                    <input
                      type="text"
                      placeholder="misal: 3.523456"
                      value={houseForm.lat}
                      onChange={(e) => {
                        setHouseForm((prev) => ({ ...prev, lat: e.target.value }));
                      }}
                      className="w-full p-1.5 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500">Lng:</span>
                    <input
                      type="text"
                      placeholder="misal: 98.634567"
                      value={houseForm.lng}
                      onChange={(e) => {
                        setHouseForm((prev) => ({ ...prev, lng: e.target.value }));
                      }}
                      className="w-full p-1.5 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan:</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan khusus mengenai rumah/warga ini..."
                  value={houseForm.catatan}
                  onChange={(e) => setHouseForm((prev) => ({ ...prev, catatan: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingHouse}
                  onClick={() => setIsHouseModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingHouse}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-500 shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingHouse ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Menyimpan ke Firestore...</span>
                    </>
                  ) : (
                    <span>💾 Simpan Data Bangunan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH RUAS JALAN */}
      {isRoadModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Tambah Data Ruas Jalan</h3>
                <p className="text-xs text-slate-500">Spesifikasi fisik dan kondisi jalan</p>
              </div>
              <button
                onClick={() => setIsRoadModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoad} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Jalan / Gang:</label>
                <input
                  type="text"
                  required
                  placeholder="misal: Jl. Flamboyan Raya Gg. Sepakat"
                  value={roadForm.namaJalan}
                  onChange={(e) => setRoadForm((prev) => ({ ...prev, namaJalan: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Panjang (Meter):</label>
                  <input
                    type="number"
                    min="1"
                    value={roadForm.panjangMeter}
                    onChange={(e) =>
                      setRoadForm((prev) => ({ ...prev, panjangMeter: +e.target.value }))
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lebar (Meter):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={roadForm.lebarMeter}
                    onChange={(e) =>
                      setRoadForm((prev) => ({ ...prev, lebarMeter: +e.target.value }))
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Perkerasan:</label>
                  <select
                    value={roadForm.jenisPerkerasan}
                    onChange={(e) =>
                      setRoadForm((prev) => ({ ...prev, jenisPerkerasan: e.target.value }))
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Aspal Hotmix">Aspal Hotmix</option>
                    <option value="Rabat Beton">Rabat Beton</option>
                    <option value="Paving Block">Paving Block</option>
                    <option value="Tanah / Batu">Tanah / Batu</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kondisi Jalan:</label>
                  <select
                    value={roadForm.kondisiJalan}
                    onChange={(e) =>
                      setRoadForm((prev) => ({
                        ...prev,
                        kondisiJalan: e.target.value as KondisiJalanType,
                      }))
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    <option value="BAIK">🟢 Baik (Mulus)</option>
                    <option value="RUSAK_SEDANG">🟡 Rusak Sedang</option>
                    <option value="RUSAK_BERAT">🔴 Rusak Berat</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Saluran Drainase:</label>
                <select
                  value={roadForm.kondisiDrainase}
                  onChange={(e) =>
                    setRoadForm((prev) => ({
                      ...prev,
                      kondisiDrainase: e.target.value as KondisiDrainaseType,
                    }))
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="LANCAR">Lancar / Terawat</option>
                  <option value="TERSUMBAT">Ada tapi Tersumbat</option>
                  <option value="TIDAK_ADA">Belum Ada Parit</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRoadModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400 shadow-md cursor-pointer"
                >
                  Simpan Ruas Jalan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KML Text Paste Modal */}
      {isKmlTextModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-teal-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg">Import KML / GeoJSON via Teks</h3>
                <p className="text-xs text-teal-200">Salin dan tempel (paste) kode KML atau GeoJSON langsung di sini</p>
              </div>
              <button
                type="button"
                onClick={() => setIsKmlTextModalOpen(false)}
                className="text-teal-200 hover:text-white font-bold p-1 rounded-lg hover:bg-teal-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tempel Kode KML (&lt;coordinates&gt;...) atau GeoJSON:
                </label>
                <textarea
                  rows={10}
                  value={kmlRawInputText}
                  onChange={(e) => setKmlRawInputText(e.target.value)}
                  placeholder="<Polygon><outerBoundaryIs><LinearRing><coordinates>...</coordinates></LinearRing></outerBoundaryIs></Polygon> atau format GeoJSON {...}"
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsKmlTextModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleImportKmlText}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white font-black hover:bg-teal-500 shadow-md cursor-pointer"
                >
                  Proses & Simpan Peta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
