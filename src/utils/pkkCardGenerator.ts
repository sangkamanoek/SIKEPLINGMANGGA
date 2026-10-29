import { printOfficialDocument } from './printHelper';

export const generatePkkCardPdf = async (item: any, photoUrl?: string | null) => {
  if (!item) return;

  const photo = photoUrl || item.pasphotoUrl || '/logo_pkk.jpg';
  const cardId = `kta-card-print-${Date.now()}`;

  const cardHtml = `
    <div id="${cardId}" style="width: 100%; max-width: 180mm; margin: 0 auto; padding: 15px; font-family: 'Times New Roman', serif; background: #ffffff; color: #000000; box-sizing: border-box;">
      <!-- Header Kop PKK -->
      <div style="display: flex; items-center; justify-content: space-between; border-bottom: 3px double #134e4a; padding-bottom: 10px; margin-bottom: 15px;">
        <div style="width: 70px; text-align: center;">
          <img src="/logo_pkk.jpg" alt="Logo PKK" style="width: 65px; height: 65px; object-fit: contain;" />
        </div>
        <div style="flex: 1; text-align: center; padding: 0 10px;">
          <div style="font-size: 11pt; font-weight: bold; letter-spacing: 1px; color: #134e4a;">TIM PENGGERAK PKK KELURAHAN MANGGA</div>
          <div style="font-size: 10pt; font-weight: bold; color: #0f172a;">KECAMATAN MEDAN TUNTUNGAN - KOTA MEDAN</div>
          <div style="font-size: 8pt; font-style: italic; color: #475569; margin-top: 2px;">Jl. Bunga Rinte No. 12, Kelurahan Mangga, Medan Tuntungan, Kode Pos 20141</div>
        </div>
        <div style="width: 70px; text-align: center;">
          <img src="/logo_pkk.jpg" alt="Logo PKK" style="width: 65px; height: 65px; object-fit: contain; visibility: hidden;" />
        </div>
      </div>

      <!-- Title -->
      <div style="text-align: center; margin-bottom: 18px;">
        <h2 style="font-size: 13pt; font-weight: bold; text-decoration: underline; margin: 0; text-transform: uppercase; color: #134e4a;">KARTU TANDA ANGGOTA (KTA) PKK</h2>
        <div style="font-size: 9pt; font-weight: bold; margin-top: 3px; color: #334155;">NOMOR ANGGOTA: KTA-PKK/KM/${(item.id || '001').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase()}</div>
      </div>

      <!-- Member Content -->
      <div style="display: flex; gap: 20px; align-items: flex-start; margin-bottom: 20px;">
        <!-- Pasphoto Box -->
        <div style="width: 130px; text-align: center; shrink: 0;">
          <div style="width: 120px; height: 160px; border: 2px solid #134e4a; border-radius: 6px; overflow: hidden; background: #f8fafc; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
            <img src="${photo}" alt="Pasphoto" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div style="font-size: 7.5pt; font-weight: bold; color: #475569; margin-top: 6px;">PASPHOTO 3x4</div>
        </div>

        <!-- Details Table -->
        <div style="flex: 1;">
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; line-height: 1.6;">
            <tbody>
              <tr>
                <td style="width: 32%; font-weight: bold; padding: 3px 0;">Nama Lengkap</td>
                <td style="width: 3%; font-weight: bold;">:</td>
                <td style="width: 65%; font-weight: bold; text-transform: uppercase; color: #0f172a;">${item.nama || '-'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 3px 0;">Jabatan di TP-PKK</td>
                <td style="font-weight: bold;">:</td>
                <td style="font-weight: bold; color: #0f766e;">${item.jabatan || 'Anggota PKK'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 3px 0;">Jenis Kelamin</td>
                <td style="font-weight: bold;">:</td>
                <td>${item.jenisKelamin === 'P' ? 'Perempuan' : 'Laki-Laki'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 3px 0;">Tempat, Tgl Lahir</td>
                <td style="font-weight: bold;">:</td>
                <td>${item.tempatLahir || '-'}, ${item.tanggalLahir || '-'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 3px 0;">Status Pernikahan</td>
                <td style="font-weight: bold;">:</td>
                <td>${item.statusPernikahan || '-'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 3px 0;">Pendidikan / Pekerjaan</td>
                <td style="font-weight: bold;">:</td>
                <td>${item.pendidikan || '-'} / ${item.pekerjaan || '-'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 3px 0; vertical-align: top;">Alamat Domisili</td>
                <td style="font-weight: bold; vertical-align: top;">:</td>
                <td style="vertical-align: top;">${item.alamat || 'Kelurahan Mangga, Medan Tuntungan'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Signatures Row -->
      <div style="margin-top: 25px; border-top: 1px solid #cbd5e1; padding-top: 15px;">
        <table style="width: 100%; border: none; font-size: 9pt;">
          <tbody>
            <tr>
              <td style="width: 50%; text-align: center; vertical-align: top;">
                <div style="font-weight: bold; color: #334155;">Sekretaris TP-PKK Kelurahan Mangga</div>
                <div style="height: 50px;"></div>
                <div style="font-weight: bold; text-decoration: underline;">NUR AISYAH DEWI, A.MD</div>
                <div style="font-size: 8pt; color: #64748b;">Sekretaris TP PKK</div>
              </td>
              <td style="width: 50%; text-align: center; vertical-align: top;">
                <div>Medan, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div style="font-weight: bold; color: #334155;">Ketua TP-PKK Kelurahan Mangga</div>
                <div style="height: 50px;"></div>
                <div style="font-weight: bold; text-decoration: underline;">NY. FRANSISKA FERY ARAPENTA TARIGAN</div>
                <div style="font-size: 8pt; color: #64748b;">Ketua TP PKK</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer Note -->
      <div style="margin-top: 15px; text-align: center; font-size: 7.5pt; color: #64748b; font-style: italic; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
        SI-MANGGA • Kartu Tanda Anggota Resmi TP PKK Kelurahan Mangga • Dicetak otomatis pada: ${new Date().toLocaleString('id-ID')}
      </div>
    </div>
  `;

  // Create temporary container, execute print helper, then remove
  const container = document.createElement('div');
  container.id = `container-${cardId}`;
  container.style.display = 'none';
  container.innerHTML = cardHtml;
  document.body.appendChild(container);

  try {
    printOfficialDocument(cardId, `KTA_PKK_${(item.nama || 'Anggota').replace(/[^a-zA-Z0-9]/g, '_')}`);
  } finally {
    setTimeout(() => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }, 1500);
  }
};
