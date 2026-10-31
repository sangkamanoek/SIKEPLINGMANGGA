import { printOfficialDocument } from './printHelper';
import { PKK_LOGO_BASE64 } from '../assets/logoPkkBase64';

/**
 * Standard ID Card Dimensions (CR80 Specification):
 * Width: 85.60 mm
 * Height: 53.98 mm
 */

export const generateSinglePkkCardHtml = (item: any): string => {
  if (!item) return '';

  const photo = item.pasphotoUrl || item.fotoUrl || PKK_LOGO_BASE64;
  const regNo = `12.71.10.2001.${String(item.id || '0045').replace(/[^0-9]/g, '').slice(-4).padStart(4, '0')}`;
  const namaFormatted = (item.nama || 'NUR AINI, S.Pd.').toUpperCase();
  const jabatanFormatted = (item.jabatan || 'ANGGOTA TP PKK KELURAHAN').toUpperCase();
  const ttlFormatted = `${(item.tempatLahir || 'MEDAN').toUpperCase()}, ${item.tanggalLahir || '16-04-1991'}`;
  const genderFormatted = item.jenisKelamin === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN';
  const alamatFormatted = (item.alamat || 'JL. BUNGA RINTE NO. 12, LINGKUNGAN IV').toUpperCase();
  const kelurahanFormatted = 'MANGGA';
  const kecamatanFormatted = 'MEDAN TUNTUNGAN';
  const kotaFormatted = 'KOTA MEDAN';
  const provinsiFormatted = 'SUMATERA UTARA';

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    `KTA-PKK|${regNo}|${namaFormatted}|${jabatanFormatted}|KELURAHAN_MANGGA`
  )}`;

  return `
    <div style="
      width: 85.6mm;
      height: 53.98mm;
      box-sizing: border-box;
      border-radius: 3.2mm;
      overflow: hidden;
      position: relative;
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 45%, #bae6fd 100%);
      border: 1px solid #0284c7;
      margin: 0 auto;
      page-break-inside: avoid;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    ">
      <!-- HEADER BANNER -->
      <div style="
        background: linear-gradient(90deg, #0284c7 0%, #0369a1 100%);
        padding: 2mm 2.8mm;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 2.5mm;
        border-bottom: 0.8mm solid #f59e0b;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      ">
        <!-- Logo PKK Resmi - Utuh, beresolusi tinggi dengan teks melingkar dan lis emas tampak sempurna -->
        <div style="
          width: 12.5mm;
          height: 12.5mm;
          border-radius: 50%;
          background: #ffffff;
          border: 0.3mm solid #ffffff;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
          overflow: hidden;
          padding: 0.3mm;
          box-sizing: border-box;
        ">
          <img src="${PKK_LOGO_BASE64}" alt="PKK" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
        <div style="line-height: 1.12; flex: 1;">
          <div style="font-size: 8pt; font-weight: 900; letter-spacing: 0.4px; color: #ffffff; text-transform: uppercase;">
            KARTU TANDA ANGGOTA
          </div>
          <div style="font-size: 5.2pt; font-weight: 800; color: #e0f2fe; text-transform: uppercase;">
            PEMBERDAYAAN KESEJAHTERAAN KELUARGA (PKK)
          </div>
          <div style="font-size: 5.8pt; font-weight: 900; color: #fde047; text-transform: uppercase; margin-top: 0.2mm; letter-spacing: 0.3px;">
            KELURAHAN MANGGA
          </div>
        </div>
      </div>

      <!-- MAIN CARD BODY -->
      <div style="padding: 2.2mm 2.8mm; display: flex; gap: 2.5mm; height: calc(53.98mm - 12mm); align-items: flex-start; box-sizing: border-box; position: relative;">
        <!-- PASPHOTO (Aspect ratio 3x4) -->
        <div style="width: 17.5mm; flex-shrink: 0; text-align: center;">
          <div style="
            width: 17.5mm;
            height: 23.5mm;
            border-radius: 1mm;
            border: 1.2px solid #0284c7;
            overflow: hidden;
            background: #e0f2fe;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          ">
            <img src="${photo}" alt="Foto" style="width: 100%; height: 100%; object-fit: cover; object-position: top;" />
          </div>
        </div>

        <!-- DETAILS TABLE -->
        <div style="
          flex: 1;
          font-size: 4.4pt;
          line-height: 1.35;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
        ">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tbody>
              <tr>
                <td style="width: 25mm; color: #334155; padding: 0.2mm 0;">NO. REGISTRASI</td>
                <td style="width: 1.5mm;">:</td>
                <td style="font-weight: 900; color: #0369a1;">${regNo}</td>
              </tr>
              <tr>
                <td style="color: #334155; padding: 0.2mm 0;">NAMA</td>
                <td>:</td>
                <td style="font-weight: 900; color: #0284c7;">${namaFormatted}</td>
              </tr>
              <tr>
                <td style="color: #334155; padding: 0.2mm 0;">JABATAN</td>
                <td>:</td>
                <td style="font-weight: 800; color: #0f766e;">${jabatanFormatted}</td>
              </tr>
              <tr>
                <td style="color: #334155; padding: 0.2mm 0;">TEMPAT/TGL LAHIR</td>
                <td>:</td>
                <td>${ttlFormatted}</td>
              </tr>
              <tr>
                <td style="color: #334155; padding: 0.2mm 0;">JENIS KELAMIN</td>
                <td>:</td>
                <td>${genderFormatted}</td>
              </tr>
              <tr>
                <td style="color: #334155; padding: 0.2mm 0;">ALAMAT</td>
                <td>:</td>
                <td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 32mm;">${alamatFormatted}</td>
              </tr>
              <tr>
                <td style="color: #334155; padding: 0.2mm 0;">DESA/KELURAHAN</td>
                <td>:</td>
                <td style="font-weight: 800;">${kelurahanFormatted}</td>
              </tr>
              <tr>
                <td style="color: #334155; padding: 0.2mm 0;">KECAMATAN</td>
                <td>:</td>
                <td style="font-weight: 800;">${kecamatanFormatted}</td>
              </tr>
              <tr>
                <td style="color: #334155; padding: 0.2mm 0;">KABUPATEN/KOTA</td>
                <td>:</td>
                <td style="font-weight: 800;">${kotaFormatted}</td>
              </tr>
              <tr>
                <td style="color: #334155; padding: 0.2mm 0;">PROVINSI</td>
                <td>:</td>
                <td style="font-weight: 800;">${provinsiFormatted}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- POJOK KIRI BAWAH: BADGE MEDAN UNTUK SEMUA -->
        <div style="
          position: absolute;
          left: 2.8mm;
          bottom: 2mm;
          display: inline-flex;
          align-items: center;
          border-radius: 0.8mm;
          overflow: hidden;
          font-size: 3.8pt;
          font-weight: 900;
          line-height: 1;
          border: 0.3px solid #0f172a;
          box-shadow: 0 1px 2px rgba(0,0,0,0.2);
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        ">
          <span style="background: #991b1b; color: #ffffff; padding: 0.8px 3px; font-weight: 900; letter-spacing: 0.2px;">MEDAN</span>
          <span style="background: #1e3a8a; color: #ffffff; padding: 0.8px 3.5px; font-weight: 900; letter-spacing: 0.2px;">UNTUK SEMUA</span>
        </div>

        <!-- BOTTOM RIGHT QR CODE -->
        <div style="
          position: absolute;
          right: 2.2mm;
          bottom: 1.8mm;
          text-align: center;
        ">
          <div style="
            width: 10mm;
            height: 10mm;
            background: #ffffff;
            padding: 0.4mm;
            border-radius: 0.8mm;
            border: 1px solid #cbd5e1;
            margin: 0 auto;
          ">
            <img src="${qrUrl}" alt="QR" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
          <div style="
            font-size: 3pt;
            font-weight: 900;
            color: #0369a1;
            margin-top: 0.4mm;
            line-height: 1;
            text-align: center;
          ">
            SCAN UNTUK DATA KARTU<br/>SCAN TO VIEW
          </div>
        </div>
      </div>
    </div>
  `;
};

export const generateBatchPkkCardHtml = (items: any[]): string => {
  if (!Array.isArray(items) || items.length === 0) return '';

  const cardsHtml = items
    .map(
      (item) => `
      <div style="
        display: inline-block;
        margin: 3mm;
        padding: 2mm;
        border: 1px dashed #cbd5e1;
        border-radius: 4mm;
        background: #ffffff;
        page-break-inside: avoid;
        break-inside: avoid;
      ">
        ${generateSinglePkkCardHtml(item)}
      </div>
    `
    )
    .join('');

  return `
    <div style="width: 190mm; margin: 0 auto; padding: 6mm 0; font-family: Arial, sans-serif;">
      <div style="text-align: center; margin-bottom: 5mm; border-bottom: 2px solid #0284c7; padding-bottom: 3mm;">
        <h2 style="font-size: 13pt; font-weight: 900; color: #0369a1; margin: 0; text-transform: uppercase;">
          LEMBAR CETAK KARTU TANDA ANGGOTA PKK — KELURAHAN MANGGA
        </h2>
        <p style="font-size: 8.5pt; color: #475569; margin-top: 1mm;">
          Kecamatan Medan Tuntungan • Total ${items.length} Kartu Siap Cetak & Potong (Ukuran Standar ID Card 85.6mm x 53.98mm)
        </p>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 2mm; justify-content: center;">
        ${cardsHtml}
      </div>
    </div>
  `;
};

export const generatePkkCardPdf = async (item: any, photoUrl?: string | null) => {
  if (!item) return;

  const cardId = `kta-card-print-${Date.now()}`;
  const singleCardHtml = generateSinglePkkCardHtml({
    ...item,
    pasphotoUrl: photoUrl || item.pasphotoUrl || item.fotoUrl,
  });

  const pageWrapperHtml = `
    <div style="width: 190mm; margin: 0 auto; padding: 15mm 0; font-family: Arial, sans-serif; text-align: center;">
      <div style="margin-bottom: 6mm; border-bottom: 1.5px solid #0284c7; padding-bottom: 3mm; display: inline-block; width: 100%;">
        <div style="font-size: 11pt; font-weight: 900; color: #0369a1; uppercase;">KARTU TANDA ANGGOTA PKK KELURAHAN MANGGA</div>
        <div style="font-size: 8pt; color: #64748b;">Siap cetak ke kertas PVC ID Card / Photo Paper (85.60 mm x 53.98 mm)</div>
      </div>
      <div style="display: flex; justify-content: center; margin-top: 5mm;">
        <div style="
          padding: 3mm;
          border: 1px dashed #0284c7;
          border-radius: 4.5mm;
          background: #ffffff;
          display: inline-block;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        ">
          ${singleCardHtml}
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.id = cardId;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.innerHTML = pageWrapperHtml;
  document.body.appendChild(container);

  try {
    printOfficialDocument(cardId, `KTA_${(item.nama || 'Anggota').replace(/[^a-zA-Z0-9]/g, '_')}`);
  } finally {
    setTimeout(() => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }, 1500);
  }
};
