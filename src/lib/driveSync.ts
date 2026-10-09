import { LaporanHarianItem, FotoDokumentasi } from '../types';
import { ensureAppFolderStructure, uploadBase64ImageToDrive, getOrCreateFolder } from './driveService';

/**
 * Uploads all base64 photos in a report to Google Drive and updates their URLs.
 * Returns the updated report item.
 */
export async function syncReportPhotosToDrive(
  item: LaporanHarianItem,
  accessToken: string
): Promise<LaporanHarianItem> {
  if (!item.dokumentasiFoto || item.dokumentasiFoto.length === 0) {
    return item;
  }

  try {
    // 1. Ensure folder structure
    const { photosId } = await ensureAppFolderStructure(accessToken);

    // 2. Clone the report to avoid side effects
    const updatedItem = { ...item };
    const updatedPhotos: FotoDokumentasi[] = [];

    // 3. Process each photo
    for (const photo of item.dokumentasiFoto) {
      // Skip if already a Drive URL (starts with https://drive.google.com or similar)
      if (photo.url && !photo.url.startsWith('data:')) {
        updatedPhotos.push(photo);
        continue;
      }

      try {
        const fileName = `FOTO_${item.namaKepling.replace(/\s+/g, '_')}_${item.tanggal.replace(/\s+/g, '_')}_${photo.id}.jpg`;
        const driveFile = await uploadBase64ImageToDrive(accessToken, photosId, photo.url, fileName);
        
        updatedPhotos.push({
          ...photo,
          url: driveFile.webViewLink,
          namaFile: fileName,
        });
      } catch (err) {
        console.warn(`Failed to upload photo ${photo.id} to Drive:`, err);
        updatedPhotos.push(photo); // Keep original base64 as fallback
      }
    }

    updatedItem.dokumentasiFoto = updatedPhotos;
    return updatedItem;
  } catch (err) {
    console.error('Error in syncReportPhotosToDrive:', err);
    return item;
  }
}

/**
 * Uploads the single photo in a kunjungan item to Google Drive and updates the URL.
 */
export async function syncKunjunganPhotoToDrive(
  item: any, // KunjunganWargaData
  accessToken: string
): Promise<any> {
  if (!item.fotoDokumentasi || !item.fotoDokumentasi.startsWith('data:')) {
    return item;
  }

  try {
    const { photosId } = await ensureAppFolderStructure(accessToken);
    const fileName = `KUNJUNGAN_${item.namaKepling.replace(/\s+/g, '_')}_${item.namaWarga.replace(/\s+/g, '_')}_${item.id}.jpg`;
    const driveFile = await uploadBase64ImageToDrive(accessToken, photosId, item.fotoDokumentasi, fileName);
    
    return {
      ...item,
      fotoDokumentasi: driveFile.webViewLink,
    };
  } catch (err) {
    console.warn(`Failed to upload visit photo ${item.id} to Drive:`, err);
    return item;
  }
}

/**
 * Uploads the PDF or image file in a surat item to Google Drive and updates the URL.
 */
export async function syncSuratFileToDrive(
  item: any, // SuratKedinasanItem
  accessToken: string
): Promise<any> {
  if (!item.fileUrl || !item.fileUrl.startsWith('data:')) {
    return item;
  }

  try {
    const rootId = await getOrCreateFolder(accessToken, 'SI_MANGGA_DATA_CENTER');
    const suratFolderId = await getOrCreateFolder(accessToken, 'Arsip_Surat_Kedinasan', rootId);
    
    const fileName = item.fileName || `SURAT_${item.jenisSurat}_${item.nomorSurat.replace(/[/\\?%*:|"<>]/g, '_')}_${item.id}.pdf`;
    
    const driveFile = await uploadBase64ImageToDrive(accessToken, suratFolderId, item.fileUrl, fileName);
    
    return {
      ...item,
      fileUrl: driveFile.webViewLink,
      fileStoredOnDrive: true,
    };
  } catch (err) {
    console.warn(`Failed to upload surat file ${item.id} to Drive:`, err);
    return item;
  }
}

/**
 * Uploads the 3 possible photos in an infrastructure monitoring report to Google Drive.
 */
export async function syncMonitoringPhotosToDrive(
  item: any, // LaporanMonitoringInfrastruktur
  accessToken: string
): Promise<any> {
  const updatedItem = { ...item };
  const photoFields = ['fotoAngle1Url', 'fotoAngle2Url', 'fotoAngle3Url'];
  let hasChanges = false;

  try {
    const { photosId } = await ensureAppFolderStructure(accessToken);

    for (const field of photoFields) {
      const base64 = item[field];
      if (base64 && base64.startsWith('data:')) {
        try {
          const angleLabel = field === 'fotoAngle1Url' ? 'Angle_1' : field === 'fotoAngle2Url' ? 'Angle_2' : 'Angle_3';
          const fileName = `INFRA_${item.nomorLaporan.replace(/[/\\?%*:|"<>]/g, '_')}_${angleLabel}_${item.id}.jpg`;
          const driveFile = await uploadBase64ImageToDrive(accessToken, photosId, base64, fileName);
          
          updatedItem[field] = driveFile.webViewLink;
          hasChanges = true;
        } catch (err) {
          console.warn(`Failed to upload infra photo ${field} for report ${item.id}:`, err);
        }
      }
    }

    return hasChanges ? updatedItem : item;
  } catch (err) {
    console.error('Error in syncMonitoringPhotosToDrive:', err);
    return item;
  }
}

/**
 * Uploads all base64 photos in a PKK activity report to Google Drive.
 */
export async function syncPkkPhotosToDrive(
  item: any, // LaporanKegiatanPkk
  accessToken: string
): Promise<any> {
  if (!item.fotoDokumentasi || item.fotoDokumentasi.length === 0) {
    return item;
  }

  try {
    const { photosId } = await ensureAppFolderStructure(accessToken);
    const updatedItem = { ...item };
    const updatedPhotos = [];

    for (const photo of item.fotoDokumentasi) {
      if (photo.url && photo.url.startsWith('data:')) {
        try {
          const fileName = `PKK_${item.pokja}_${item.namaKegiatan.replace(/\s+/g, '_')}_${photo.id}.jpg`;
          const driveFile = await uploadBase64ImageToDrive(accessToken, photosId, photo.url, fileName);
          
          updatedPhotos.push({
            ...photo,
            url: driveFile.webViewLink,
          });
        } catch (err) {
          console.warn(`Failed to upload PKK photo ${photo.id} to Drive:`, err);
          updatedPhotos.push(photo);
        }
      } else {
        updatedPhotos.push(photo);
      }
    }

    updatedItem.fotoDokumentasi = updatedPhotos;
    return updatedItem;
  } catch (err) {
    console.error('Error in syncPkkPhotosToDrive:', err);
    return item;
  }
}

/**
 * Uploads the selfie photo in an attendance item to Google Drive.
 */
export async function syncAttendancePhotoToDrive(
  item: any, // AbsenApelItem
  accessToken: string
): Promise<any> {
  if (!item.fotoSelfieUrl || !item.fotoSelfieUrl.startsWith('data:')) {
    return item;
  }

  try {
    const { photosId } = await ensureAppFolderStructure(accessToken);
    const fileName = `ABSEN_${item.namaKepling.replace(/\s+/g, '_')}_${item.tanggal}_${item.id}.jpg`;
    const driveFile = await uploadBase64ImageToDrive(accessToken, photosId, item.fotoSelfieUrl, fileName);
    
    return {
      ...item,
      fotoSelfieUrl: driveFile.webViewLink,
    };
  } catch (err) {
    console.warn(`Failed to upload attendance photo ${item.id} to Drive:`, err);
    return item;
  }
}
