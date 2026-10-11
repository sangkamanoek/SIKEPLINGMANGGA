import React from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PkkBuku1Anggota } from '../lib/pkkBukuService';

export const generatePkkCardPdf = async (member: PkkBuku1Anggota, pasphotoUrl: string | null) => {
  // Card dimensions for KTP-like aesthetic (CR80: 85.6mm x 54mm at 300 DPI equivalent -> 510 x 322 px)
  const cardWidth = 510;
  const cardHeight = 322;
  
  const cardContainer = document.createElement('div');
  cardContainer.style.width = `${cardWidth}px`;
  cardContainer.style.height = `${cardHeight}px`;
  cardContainer.style.background = 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)';
  cardContainer.style.padding = '16px';
  cardContainer.style.border = '2px solid #047857';
  cardContainer.style.borderRadius = '16px';
  cardContainer.style.position = 'absolute';
  cardContainer.style.left = '-9999px';
  cardContainer.style.boxSizing = 'border-box';
  cardContainer.style.display = 'flex';
  cardContainer.style.flexDirection = 'column';
  cardContainer.style.justifyContent = 'space-between';
  cardContainer.style.fontFamily = 'Arial, sans-serif';
  cardContainer.style.overflow = 'hidden';

  const memberId = member.id ? member.id.slice(-8).toUpperCase() : 'PKK-001';
  const tglLahirFormatted = member.tanggalLahir || '-';

  cardContainer.innerHTML = `
    <!-- Top Header Banner -->
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #047857; padding-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 28px; height: 28px; background: #047857; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 12px;">PKK</div>
        <div>
          <div style="font-size: 9px; font-weight: 800; color: #047857; letter-spacing: 0.5px; text-transform: uppercase;">TIM PENGGERAK PKK KELURAHAN MANGGA</div>
          <div style="font-size: 7px; color: #64748b; font-weight: 600;">KOTA MEDAN • KARTU TANDA ANGGOTA (KTA)</div>
        </div>
      </div>
      <div style="background: #047857; color: white; font-size: 8px; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
        ${member.jabatan || 'Anggota PKK'}
      </div>
    </div>

    <!-- Middle Body Content -->
    <div style="display: flex; gap: 16px; margin-top: 8px; align-items: center;">
      <!-- Pasphoto -->
      <div style="flex: 0 0 110px; display: flex; flex-direction: column; align-items: center;">
        <div style="width: 100px; height: 130px; border: 2px solid #047857; border-radius: 6px; overflow: hidden; background: #e2e8f0; display: flex; align-items: center; justify-content: center;">
          ${pasphotoUrl ? `<img src="${pasphotoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-size: 9px; color: #94a3b8; font-weight: bold; text-align: center; padding: 4px;">3x4 Pasfoto</span>`}
        </div>
        <div style="font-size: 7px; font-weight: 900; color: #0f172a; margin-top: 4px; letter-spacing: 0.5px;">ID: ${memberId}</div>
      </div>

      <!-- Details -->
      <div style="flex: 1; display: flex; flex-direction: column; gap: 3px; font-size: 10px; color: #1e293b;">
        <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding-bottom: 2px;">
          <span style="width: 95px; font-weight: 800; color: #334155;">Nama Lengkap</span>
          <span style="font-weight: 900; color: #0f172a; text-transform: uppercase;">: ${member.nama}</span>
        </div>
        <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding-bottom: 2px;">
          <span style="width: 95px; font-weight: 800; color: #334155;">Tempat/Tgl Lahir</span>
          <span>: ${member.tempatLahir || '-'}, ${tglLahirFormatted}</span>
        </div>
        <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding-bottom: 2px;">
          <span style="width: 95px; font-weight: 800; color: #334155;">Jenis Kelamin</span>
          <span>: ${member.jenisKelamin === 'P' ? 'Perempuan' : 'Laki-laki'} (${member.statusPernikahan || '-'})</span>
        </div>
        <div style="display: flex; border-bottom: 1px dotted #cbd5e1; padding-bottom: 2px;">
          <span style="width: 95px; font-weight: 800; color: #334155;">Pendidikan/Pek.</span>
          <span>: ${member.pendidikan || '-'} / ${member.pekerjaan || '-'}</span>
        </div>
        <div style="display: flex; padding-bottom: 2px;">
          <span style="width: 95px; font-weight: 800; color: #334155;">Alamat Rumah</span>
          <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">: ${member.alamat}</span>
        </div>
      </div>
    </div>

    <!-- Footer Bar -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 4px;">
      <div style="font-size: 7px; color: #64748b; font-weight: 700;">
        Berlaku Selama Menjadi Pengurus/Kader TP-PKK
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <div style="font-size: 7px; font-weight: 900; color: #047857; text-align: right;">
          Ketua TP-PKK Kelurahan<br/>
          <span style="font-size: 6px; font-weight: 600; color: #475569;">Kota Medan, Sumatera Utara</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(cardContainer);
  const canvas = await html2canvas(cardContainer, { scale: 3, useCORS: true });
  document.body.removeChild(cardContainer);

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('l', 'mm', [85.6, 54]);
  pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 54);
  pdf.save(`KTA_PKK_${member.nama.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
};

