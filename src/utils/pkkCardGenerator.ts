import React from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PkkBuku1Anggota } from '../lib/pkkBukuService';

export const generatePkkCardPdf = async (member: PkkBuku1Anggota, pasphotoUrl: string | null) => {
  // Card dimensions for KTP-like aesthetic (approx 8.56cm x 5.4cm)
  const cardWidth = 338; // approx 85.6mm at 100 DPI
  const cardHeight = 213; // approx 54mm at 100 DPI
  
  // Container for html2canvas
  const cardContainer = document.createElement('div');
  cardContainer.style.width = `${cardWidth}px`;
  cardContainer.style.height = `${cardHeight}px`;
  cardContainer.style.background = '#ffffff';
  cardContainer.style.padding = '10px';
  cardContainer.style.border = '2px solid #000';
  cardContainer.style.borderRadius = '10px';
  cardContainer.style.position = 'absolute';
  cardContainer.style.left = '-9999px';
  cardContainer.style.display = 'flex';
  cardContainer.style.flexDirection = 'row';
  cardContainer.style.gap = '10px';
  cardContainer.style.fontFamily = 'Arial, sans-serif';

  cardContainer.innerHTML = `
    <div style="flex: 0 0 80px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      ${pasphotoUrl ? `<img src="${pasphotoUrl}" style="width: 70px; height: 90px; object-fit: cover; border: 1px solid #ddd;" />` : `<div style="width: 70px; height: 90px; background: #eee; border: 1px solid #ddd;"></div>`}
      <span style="font-size: 8px; font-weight: bold; margin-top: 5px;">ID: ${member.id.slice(-6)}</span>
    </div>
    <div style="flex: 1;">
      <h2 style="margin: 0; font-size: 14px; text-transform: uppercase; color: #064e3b;">Kartu Tanda Anggota PKK</h2>
      <div style="font-size: 10px; margin-top: 5px;">
        <p style="margin: 2px 0;"><strong>Nama:</strong> ${member.nama}</p>
        <p style="margin: 2px 0;"><strong>Jabatan:</strong> ${member.jabatan}</p>
        <p style="margin: 2px 0;"><strong>Alamat:</strong> ${member.alamat}</p>
      </div>
    </div>
  `;

  document.body.appendChild(cardContainer);
  const canvas = await html2canvas(cardContainer, { scale: 2 });
  document.body.removeChild(cardContainer);

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('l', 'mm', [85.6, 54]);
  pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 54);
  pdf.save(`Kartu_PKK_${member.nama.replace(/ /g, '_')}.pdf`);
};
