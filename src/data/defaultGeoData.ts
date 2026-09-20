import { LingkunganPolygon, TitikRumahBangunan, RuasJalanLingkungan } from '../types';
import { KEPLING_ACCOUNTS } from './keplingList';
import { parseAllKmlPolygons } from '../lib/webgisService';

export const KELURAHAN_MANGGA_CENTER: [number, number] = [3.5230, 98.6340];
export const DEFAULT_MAP_ZOOM = 14;

// Official Kelurahan Mangga Boundary in Medan Tuntungan (ArcGIS reference geometry)
export const KELURAHAN_MANGGA_BOUNDARY: [number, number][] = [];

// Distinct aesthetic palette for 24 Lingkungan boundaries
export const LINGKUNGAN_COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899',
  '#06b6d4', '#84cc16', '#d97706', '#2563eb', '#059669', '#dc2626',
  '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#b45309', '#1d4ed8',
  '#047857', '#b91c1c', '#6d28d9', '#be185d', '#0e7490', '#4d7c0f'
];

const USER_UPLOADED_KML_DATA = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom">
<Document id="1Vx6cX1i_W-ZIPHYtoYkPjTSx7ldMmfTU">
	<name>LINGKUNGAN1</name>
	<Placemark id="0D2AD9BAF03E8DC6F3CC">
		<name>LINGKUNGAN I KELURAHAN MANGGA</name>
		<Polygon>
			<outerBoundaryIs>
				<LinearRing>
					<coordinates>
						98.64452781508719,3.532188558668543,0 98.64259709611109,3.534465979709174,0 98.63823890843535,3.531048288638262,0 98.63933066679994,3.529912813433703,0 98.6394357124879,3.529738531888544,0 98.640201892551,3.527967827188943,0 98.64031261586209,3.527109487387563,0 98.64025007828053,3.524283262452784,0 98.64263013558973,3.524897708777571,0 98.64281265832554,3.524450204856383,0 98.64377991880636,3.523971500950582,0 98.64429998011703,3.523970707040512,0 98.64452553211538,3.524624382568175,0 98.64515408332366,3.52584794927992,0 98.64437185587093,3.527448531189798,0 98.64558950967979,3.528502614622596,0 98.64452781508719,3.532188558668543,0 
					</coordinates>
				</LinearRing>
			</outerBoundaryIs>
		</Polygon>
	</Placemark>
</Document>
</kml>`;

function generateDefaultPolygons(): LingkunganPolygon[] {
  const parsed = parseAllKmlPolygons(USER_UPLOADED_KML_DATA);
  const polygons: LingkunganPolygon[] = [];

  parsed.forEach((item, idx) => {
    const numMatch = item.name.match(/(?:lingkungan|lingk|ling)?\s*0*([1-9]|1[0-9]|2[0-4])/i);
    const targetAcc = numMatch 
      ? KEPLING_ACCOUNTS.find((k) => k.nomorLingkungan === parseInt(numMatch[1], 10)) 
      : KEPLING_ACCOUNTS[idx % KEPLING_ACCOUNTS.length];

    if (!targetAcc) return;

    polygons.push({
      id: `poly_${targetAcc.id}`,
      lingkunganId: targetAcc.id,
      lingkunganNomor: targetAcc.nomorLingkungan || (idx + 1),
      lingkunganNama: targetAcc.lingkungan,
      keplingNama: targetAcc.nama,
      coordinates: item.coordinates,
      color: LINGKUNGAN_COLORS[idx % LINGKUNGAN_COLORS.length],
      updatedAt: new Date().toISOString(),
      updatedBy: 'Imported from User KML (Lingkungan 1)',
    });
  });

  return polygons;
}

export const DEFAULT_LINGKUNGAN_POLYGONS: LingkunganPolygon[] = generateDefaultPolygons();


/**
 * Initial sample roads across Lingkungan 1 - 24
 */
export const DEFAULT_RUAS_JALAN: RuasJalanLingkungan[] = [];

/**
 * Initial sample house points with WRS and Bansos statuses
 */
export const DEFAULT_TITIK_RUMAH: TitikRumahBangunan[] = [
  {
    id: 'rumah_juan_lingk1',
    lingkunganId: 'kepling_1',
    lingkunganNomor: 1,
    namaJalan: 'Jl. Bunga Ncole Raya (Lingkungan 1)',
    nomorRumah: 'No. 50',
    namaKepalaKeluarga: 'Juan',
    nikKk: '1271010101900001',
    isKkMangga: true,
    asalKk: 'Kelurahan Mangga',
    lat: 3.532434,
    lng: 98.642649,
    jumlahJiwa: 3,
    jumlahLakiLaki: 2,
    jumlahPerempuan: 1,
    jumlahLansia: 0,
    jumlahAnak: 0,
    pekerjaanKk: 'Wiraswasta',
    penerimaBansos: false,
    statusWrs: 'AKTIF',
    tarifRetribusi: 15000,
    statusPbb: 'LUNAS',
    nominalPbb: 150000,
    tahunPbb: 2026,
    luasTanahM2: 50,
    luasBangunanM2: 50,
    kategoriBangunan: 'RUMAH_TINGGAL',
    catatan: 'Titik Rumah Kepala Keluarga Juan (Ukuran Tanah & Bangunan 50 m²)',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdByName: 'Juan Prananta Purba',
  },
];
