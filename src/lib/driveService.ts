/**
 * Service to handle Google Drive file operations
 */

export async function uploadMakalahToGoogleDrive(accessToken: string): Promise<{ fileId: string; webViewLink: string }> {
  // Fetch the generated .docx file from public folder
  const docxRes = await fetch('/Makalah_Ilmiah_Sistem_Laporan_Kepling.docx');
  if (!docxRes.ok) {
    throw new Error('File Makalah (.docx) tidak ditemukan di server.');
  }
  const fileBlob = await docxRes.blob();

  const metadata = {
    name: 'Makalah Ilmiah - Sistem Informasi Laporan Kepling Kelurahan Mangga.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', fileBlob);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal mengunggah ke Google Drive: ${errText}`);
  }

  const data = await response.json();
  return {
    fileId: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
  };
}

export async function uploadBackupToGoogleDrive(
  accessToken: string,
  backupData: any,
  fileName: string = `CADANGAN_SISTEM_SI_MANGGA_3_OKTOBER_2026_2300WIB.json`
): Promise<{ fileId: string; webViewLink: string }> {
  const fileBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', fileBlob);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal mengunggah cadangan ke Google Drive: ${errText}`);
  }

  const data = await response.json();
  return {
    fileId: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
  };
}

