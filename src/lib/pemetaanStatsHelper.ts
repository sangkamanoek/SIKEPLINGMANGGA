import { TitikRumahBangunan, RuasJalanLingkungan, LingkunganPolygon } from '../types';
import { KEPLING_ACCOUNTS } from '../data/keplingList';

export interface LingkunganPemetaanStats {
  lingkunganId: string; // e.g. "kepling_1"
  lingkunganNomor: number; // 1 - 24
  lingkunganNama: string; // "Lingkungan I"
  keplingNama: string;
  keplingTelepon?: string;
  totalRumah: number;
  totalJiwa: number;
  totalLakiLaki: number;
  totalPerempuan: number;
  totalAnak: number;
  totalLansia: number;
  kkMangga: number;
  kkLuar: number;
  persenKkMangga: number;
  wrsAktif: number;
  wrsMandiri: number;
  wrsBelum: number;
  persenWrsAktif: number;
  potensiRetribusiWrs: number;
  pbbLunas: number;
  pbbBelumLunas: number;
  pbbBebas: number;
  persenPbbLunas: number;
  totalNominalPbb: number;
  bansosKk: number;
  bansosKategoriRentan: number;
  totalRuasJalan: number;
  totalPanjangJalanMeter: number;
  jalanBaik: number;
  jalanRusak: number;
  hasPolygon: boolean;
  polygonPointsCount: number;
  recentHouses: TitikRumahBangunan[];
}

export interface KelurahanPemetaanOverview {
  totalRumahAll: number;
  totalJiwaAll: number;
  totalLakiLakiAll: number;
  totalPerempuanAll: number;
  totalAnakAll: number;
  totalLansiaAll: number;
  totalKkManggaAll: number;
  totalKkLuarAll: number;
  persenKkManggaAll: number;
  totalWrsAktifAll: number;
  totalWrsMandiriAll: number;
  totalWrsBelumAll: number;
  persenWrsAktifAll: number;
  potensiRetribusiWrsAll: number;
  totalPbbLunasAll: number;
  totalPbbBelumLunasAll: number;
  persenPbbLunasAll: number;
  totalNominalPbbAll: number;
  totalBansosAll: number;
  totalBansosRentanAll: number;
  totalRuasJalanAll: number;
  totalPanjangJalanMeterAll: number;
  totalJalanBaikAll: number;
  totalJalanRusakAll: number;
  totalLingkunganTerpetakan: number;
  totalLingkunganPoligon: number;
  perLingkunganMap: Record<string, LingkunganPemetaanStats>;
  perLingkunganList: LingkunganPemetaanStats[];
  topLingkunganList: LingkunganPemetaanStats[];
}

export function computeLingkunganPemetaanStats(
  lingkunganNomor: number,
  houses: TitikRumahBangunan[],
  roads: RuasJalanLingkungan[],
  polygons: LingkunganPolygon[]
): LingkunganPemetaanStats {
  const account = KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === lingkunganNomor);
  const lingkunganId = account?.id || `kepling_${lingkunganNomor}`;
  const lingkunganNama = account?.lingkungan || `Lingkungan ${lingkunganNomor}`;
  const keplingNama = account?.nama || `Kepling Lingkungan ${lingkunganNomor}`;
  const keplingTelepon = account?.telepon;

  // Filter items belonging to this Lingkungan
  const lingHouses = houses.filter(
    (h) => h.lingkunganNomor === lingkunganNomor || h.lingkunganId === lingkunganId
  );
  const lingRoads = roads.filter(
    (r) => r.lingkunganNomor === lingkunganNomor || r.lingkunganId === lingkunganId
  );
  const lingPolygon = polygons.find(
    (p) => p.lingkunganNomor === lingkunganNomor || p.lingkunganId === lingkunganId
  );

  let totalJiwa = 0;
  let totalLakiLaki = 0;
  let totalPerempuan = 0;
  let totalAnak = 0;
  let totalLansia = 0;
  let kkMangga = 0;
  let kkLuar = 0;
  let wrsAktif = 0;
  let wrsMandiri = 0;
  let wrsBelum = 0;
  let potensiRetribusiWrs = 0;
  let pbbLunas = 0;
  let pbbBelumLunas = 0;
  let pbbBebas = 0;
  let totalNominalPbb = 0;
  let bansosKk = 0;
  let bansosKategoriRentan = 0;

  lingHouses.forEach((h) => {
    const l = Number(h.jumlahLakiLaki) || 0;
    const p = Number(h.jumlahPerempuan) || 0;
    totalLakiLaki += l;
    totalPerempuan += p;
    totalJiwa += Number(h.jumlahJiwa) || l + p || 1;
    totalAnak += Number(h.jumlahAnak) || 0;
    totalLansia += Number(h.jumlahLansia) || 0;

    if (h.isKkMangga !== false) {
      kkMangga++;
    } else {
      kkLuar++;
    }

    if (h.statusWrs === 'AKTIF') {
      wrsAktif++;
      potensiRetribusiWrs += Number(h.tarifRetribusi) || 15000;
    } else if (h.statusWrs === 'MANDIRI') {
      wrsMandiri++;
    } else {
      wrsBelum++;
    }

    if (h.statusPbb === 'LUNAS') {
      pbbLunas++;
      totalNominalPbb += Number(h.nominalPbb) || 0;
    } else if (h.statusPbb === 'BEBAS_PAJAK') {
      pbbBebas++;
    } else {
      pbbBelumLunas++;
    }

    if (h.penerimaBansos) {
      bansosKk++;
    }
    if (h.kategoriRentan) {
      bansosKategoriRentan++;
    }
  });

  const totalRumah = lingHouses.length;
  const persenKkMangga = totalRumah > 0 ? Math.round((kkMangga / totalRumah) * 100) : 0;
  const persenWrsAktif = totalRumah > 0 ? Math.round((wrsAktif / totalRumah) * 100) : 0;
  const persenPbbLunas = totalRumah > 0 ? Math.round((pbbLunas / totalRumah) * 100) : 0;

  let totalPanjangJalanMeter = 0;
  let jalanBaik = 0;
  let jalanRusak = 0;

  lingRoads.forEach((r) => {
    totalPanjangJalanMeter += Number(r.panjangMeter) || 0;
    if (r.kondisiJalan === 'BAIK') {
      jalanBaik++;
    } else {
      jalanRusak++;
    }
  });

  // Sort recent houses (latest first)
  const recentHouses = [...lingHouses].sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return db - da;
  });

  return {
    lingkunganId,
    lingkunganNomor,
    lingkunganNama,
    keplingNama,
    keplingTelepon,
    totalRumah,
    totalJiwa,
    totalLakiLaki,
    totalPerempuan,
    totalAnak,
    totalLansia,
    kkMangga,
    kkLuar,
    persenKkMangga,
    wrsAktif,
    wrsMandiri,
    wrsBelum,
    persenWrsAktif,
    potensiRetribusiWrs,
    pbbLunas,
    pbbBelumLunas,
    pbbBebas,
    persenPbbLunas,
    totalNominalPbb,
    bansosKk,
    bansosKategoriRentan,
    totalRuasJalan: lingRoads.length,
    totalPanjangJalanMeter,
    jalanBaik,
    jalanRusak,
    hasPolygon: Boolean(lingPolygon && lingPolygon.coordinates?.length > 2),
    polygonPointsCount: lingPolygon?.coordinates?.length || 0,
    recentHouses: recentHouses.slice(0, 10),
  };
}

export function computeKelurahanPemetaanOverview(
  houses: TitikRumahBangunan[],
  roads: RuasJalanLingkungan[],
  polygons: LingkunganPolygon[]
): KelurahanPemetaanOverview {
  const perLingkunganList: LingkunganPemetaanStats[] = [];
  const perLingkunganMap: Record<string, LingkunganPemetaanStats> = {};

  let totalRumahAll = 0;
  let totalJiwaAll = 0;
  let totalLakiLakiAll = 0;
  let totalPerempuanAll = 0;
  let totalAnakAll = 0;
  let totalLansiaAll = 0;
  let totalKkManggaAll = 0;
  let totalKkLuarAll = 0;
  let totalWrsAktifAll = 0;
  let totalWrsMandiriAll = 0;
  let totalWrsBelumAll = 0;
  let potensiRetribusiWrsAll = 0;
  let totalPbbLunasAll = 0;
  let totalPbbBelumLunasAll = 0;
  let totalNominalPbbAll = 0;
  let totalBansosAll = 0;
  let totalBansosRentanAll = 0;
  let totalRuasJalanAll = 0;
  let totalPanjangJalanMeterAll = 0;
  let totalJalanBaikAll = 0;
  let totalJalanRusakAll = 0;
  let totalLingkunganTerpetakan = 0;
  let totalLingkunganPoligon = 0;

  KEPLING_ACCOUNTS.forEach((k) => {
    const lingNomor = k.nomorLingkungan || 1;
    const stats = computeLingkunganPemetaanStats(lingNomor, houses, roads, polygons);
    perLingkunganList.push(stats);
    perLingkunganMap[stats.lingkunganId] = stats;
    perLingkunganMap[`ling_${lingNomor}`] = stats;

    totalRumahAll += stats.totalRumah;
    totalJiwaAll += stats.totalJiwa;
    totalLakiLakiAll += stats.totalLakiLaki;
    totalPerempuanAll += stats.totalPerempuan;
    totalAnakAll += stats.totalAnak;
    totalLansiaAll += stats.totalLansia;
    totalKkManggaAll += stats.kkMangga;
    totalKkLuarAll += stats.kkLuar;
    totalWrsAktifAll += stats.wrsAktif;
    totalWrsMandiriAll += stats.wrsMandiri;
    totalWrsBelumAll += stats.wrsBelum;
    potensiRetribusiWrsAll += stats.potensiRetribusiWrs;
    totalPbbLunasAll += stats.pbbLunas;
    totalPbbBelumLunasAll += stats.pbbBelumLunas;
    totalNominalPbbAll += stats.totalNominalPbb;
    totalBansosAll += stats.bansosKk;
    totalBansosRentanAll += stats.bansosKategoriRentan;
    totalRuasJalanAll += stats.totalRuasJalan;
    totalPanjangJalanMeterAll += stats.totalPanjangJalanMeter;
    totalJalanBaikAll += stats.jalanBaik;
    totalJalanRusakAll += stats.jalanRusak;

    if (stats.totalRumah > 0 || stats.totalRuasJalan > 0) {
      totalLingkunganTerpetakan++;
    }
    if (stats.hasPolygon) {
      totalLingkunganPoligon++;
    }
  });

  const persenKkManggaAll =
    totalRumahAll > 0 ? Math.round((totalKkManggaAll / totalRumahAll) * 100) : 0;
  const persenWrsAktifAll =
    totalRumahAll > 0 ? Math.round((totalWrsAktifAll / totalRumahAll) * 100) : 0;
  const persenPbbLunasAll =
    totalRumahAll > 0 ? Math.round((totalPbbLunasAll / totalRumahAll) * 100) : 0;

  // Top 5 Lingkungan with most mapped houses
  const topLingkunganList = [...perLingkunganList]
    .sort((a, b) => b.totalRumah - a.totalRumah || b.totalJiwa - a.totalJiwa)
    .filter((l) => l.totalRumah > 0)
    .slice(0, 5);

  return {
    totalRumahAll,
    totalJiwaAll,
    totalLakiLakiAll,
    totalPerempuanAll,
    totalAnakAll,
    totalLansiaAll,
    totalKkManggaAll,
    totalKkLuarAll,
    persenKkManggaAll,
    totalWrsAktifAll,
    totalWrsMandiriAll,
    totalWrsBelumAll,
    persenWrsAktifAll,
    potensiRetribusiWrsAll,
    totalPbbLunasAll,
    totalPbbBelumLunasAll,
    persenPbbLunasAll,
    totalNominalPbbAll,
    totalBansosAll,
    totalBansosRentanAll,
    totalRuasJalanAll,
    totalPanjangJalanMeterAll,
    totalJalanBaikAll,
    totalJalanRusakAll,
    totalLingkunganTerpetakan,
    totalLingkunganPoligon,
    perLingkunganMap,
    perLingkunganList,
    topLingkunganList,
  };
}
