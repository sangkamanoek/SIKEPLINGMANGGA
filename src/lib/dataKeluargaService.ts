export interface DeduplicateResult {
  removedCount: number;
}

export interface ImportParsedResult {
  valid: any[];
  invalid: any[];
}

export const subscribeDataKeluarga = (cb: any) => { cb([]); return () => {}; };
export const saveDataKeluarga = async () => {};
export const autoCleanDuplicateDataKeluarga = async () => ({ removedCount: 0 });

export const fetchAllDataKeluarga = async (): Promise<any[]> => [];
export const getLocalDataKeluarga = (): any[] => [];
export const saveDataKeluargaToFirestore = async () => {};
export const deleteDataKeluargaFromFirestore = async () => {};
export const wipeAllFirestoreDataKeluarga = async () => {};
export const exportDataKeluargaToExcel = async () => {};
export const downloadImportTemplateExcel = async () => {};
export const parseDataKeluargaFile = async (): Promise<ImportParsedResult> => ({ valid: [], invalid: [] });
export const parseDataKeluargaText = (): ImportParsedResult => ({ valid: [], invalid: [] });
export const batchSaveDataKeluarga = async () => {};
export const batchUpdateLingkunganDataKeluarga = async () => {};
export const normalizeStreetName = (str: string) => (str || '').trim();
export const maskNik = (nik: string) => {
  if (!nik || nik.length < 6) return nik;
  return nik.slice(0, 6) + '******' + nik.slice(-4);
};
