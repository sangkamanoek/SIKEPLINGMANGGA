/**
 * Service to handle Google Drive file operations
 */

export async function getOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  const q = parentId
    ? `name = '${folderName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    : `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`;
  
  try {
    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }
  } catch (err) {
    console.warn(`Error searching for folder ${folderName}:`, err);
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Gagal membuat folder ${folderName}: ${errText}`);
  }

  const createdData = await createRes.json();
  return createdData.id;
}

export async function ensureAppFolderStructure(accessToken: string): Promise<{ rootId: string; photosId: string }> {
  const rootId = await getOrCreateFolder(accessToken, 'SI_MANGGA_DATA_CENTER');
  const photosId = await getOrCreateFolder(accessToken, 'Foto_Laporan_Kinerja', rootId);
  return { rootId, photosId };
}

export async function uploadBase64ImageToDrive(
  accessToken: string,
  folderId: string,
  base64Data: string,
  fileName: string
): Promise<{ fileId: string; webViewLink: string }> {
  // Convert base64 to blob
  let mimeType = 'image/jpeg';
  let dataPart = base64Data;
  
  if (base64Data.startsWith('data:')) {
    const parts = base64Data.split(',');
    mimeType = parts[0].split(':')[1].split(';')[0];
    dataPart = parts[1];
  }
  
  const byteCharacters = atob(dataPart);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const fileBlob = new Blob([byteArray], { type: mimeType });

  const metadata = {
    name: fileName,
    mimeType: mimeType,
    parents: [folderId],
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', fileBlob);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink',
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
    throw new Error(`Gagal mengunggah foto ke Google Drive: ${errText}`);
  }

  const data = await response.json();
  return {
    fileId: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
  };
}

export async function uploadMakalahToGoogleDrive(accessToken: string): Promise<{ fileId: string; webViewLink: string }> {
  // Fetch the generated .docx file from public folder
  const docxRes = await fetch('/Makalah_Ilmiah_Sistem_Laporan_Kepling.docx');
  if (!docxRes.ok) {
    throw new Error('File Makalah (.docx) tidak ditemukan di server.');
  }
  const fileBlob = await docxRes.blob();

  const metadata = {
    name: 'Makalah Ilmiah - SI-MANGGA (Sistem Informasi & Administrasi Kelurahan Mangga).docx',
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

