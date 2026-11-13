import React, { useState } from 'react';
import { X, Printer, Download, CreditCard, Layers, CheckCircle2 } from 'lucide-react';
import { printOfficialDocument } from '../utils/printHelper';
import { generateSinglePkkCardHtml, generateBatchPkkCardHtml } from '../utils/pkkCardGenerator';
import { PKK_LOGO_BASE64 } from '../assets/logoPkkBase64';
import { formatDateToIndonesianFull } from '../utils/dateFormatter';

interface PkkCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: any;
  allMembers?: any[];
}

export const PkkCardModal: React.FC<PkkCardModalProps> = ({
  isOpen,
  onClose,
  member,
  allMembers = [],
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [isPrinting, setIsPrinting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [customKelurahan, setCustomKelurahan] = useState(member?.kelurahan || 'MANGGA');
  const [customKecamatan, setCustomKecamatan] = useState(member?.kecamatan || 'MEDAN TUNTUNGAN');
  const [customKota, setCustomKota] = useState(member?.kota || 'KOTA MEDAN');
  const [customProvinsi, setCustomProvinsi] = useState(member?.provinsi || 'SUMATERA UTARA');

  const [showBack, setShowBack] = useState(false);

  if (!isOpen || !member) return null;

  const photoUrl = member.pasphotoUrl || PKK_LOGO_BASE64;

  const regNo = member?.noRegistrasi || '-';
  const namaFormatted = (member.nama || 'NUR AINI, S.Pd.').toUpperCase();
  const jabatanFormatted = (member.jabatan || 'ANGGOTA TP PKK KELURAHAN').toUpperCase();
  const ttlFormatted = `${(member.tempatLahir || 'MEDAN').toUpperCase()}, ${formatDateToIndonesianFull(member.tanggalLahir || '16-04-1991').toUpperCase()}`;
  const genderFormatted = member.jenisKelamin === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN';
  const alamatFormatted = (member.alamat || 'JL. BUNGA RINTE NO. 12, LINGKUNGAN IV').toUpperCase();
  const kelurahanFormatted = customKelurahan.toUpperCase();
  const kecamatanFormatted = customKecamatan.toUpperCase();
  const kotaFormatted = customKota.toUpperCase();
  const provinsiFormatted = customProvinsi.toUpperCase();

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    `KTA-PKK|${namaFormatted}|${jabatanFormatted}|KELURAHAN_${kelurahanFormatted}`
  )}`;

  const handlePrintSingle = () => {
    setIsPrinting(true);
    const cardHtml = generateSinglePkkCardHtml(member, {
      regNo,
      kelurahan: customKelurahan,
      kecamatan: customKecamatan,
      kota: customKota,
      provinsi: customProvinsi,
    });
    
    const singleCardPrintWrapper = `
      <div style="
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20mm 0;
        gap: 10mm;
        box-sizing: border-box;
      ">
        <!-- FRONT SIDE -->
        <div style="
          padding: 3.8mm;
          border: 1px solid #e2e8f0;
          border-radius: 5.5mm;
          background: #ffffff;
          display: inline-block;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
          page-break-inside: avoid;
          break-inside: avoid;
        ">
          ${cardHtml}
        </div>

        <!-- BACK SIDE -->
        <div style="
          padding: 3.8mm;
          border: 1px solid #e2e8f0;
          border-radius: 5.5mm;
          background: #ffffff;
          display: inline-block;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
          page-break-inside: avoid;
          break-inside: avoid;
        ">
          ${generateSinglePkkCardHtml(member, {
            regNo,
            kelurahan: customKelurahan,
            kecamatan: customKecamatan,
            kota: customKota,
            provinsi: customProvinsi,
            side: 'back'
          })}
        </div>
      </div>
    `;

    const container = document.createElement('div');
    const elementId = `kta-single-print-${Date.now()}`;
    container.id = elementId;
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.innerHTML = singleCardPrintWrapper;
    document.body.appendChild(container);

    setTimeout(() => {
      printOfficialDocument(elementId, `KTA_${namaFormatted.replace(/[^a-zA-Z0-9]/g, '_')}`);
      setTimeout(() => {
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
        setIsPrinting(false);
      }, 1000);
    }, 300);
  };

  const handlePrintBatch = () => {
    setIsPrinting(true);
    const listToPrint = allMembers.length > 0 ? allMembers : [member];
    const batchHtml = generateBatchPkkCardHtml(listToPrint, {
      kelurahan: customKelurahan,
      kecamatan: customKecamatan,
      kota: customKota,
      provinsi: customProvinsi,
    });

    const container = document.createElement('div');
    const elementId = `kta-batch-print-${Date.now()}`;
    container.id = elementId;
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.innerHTML = batchHtml;
    document.body.appendChild(container);

    setTimeout(() => {
      printOfficialDocument(elementId, `LEMBAR_A4_KTA_PKK_KELURAHAN_MANGGA`);
      setTimeout(() => {
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
        setIsPrinting(false);
      }, 1000);
    }, 300);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[120] bg-slate-950/85 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-sky-200 overflow-hidden my-4 sm:my-6 flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-sky-800 via-cyan-800 to-teal-900 text-white p-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-white/20 border border-white/30 shrink-0">
              <CreditCard className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-base text-white truncate">
                Kartu Tanda Anggota (KTA) PKK
              </h3>
              <p className="text-xs text-sky-200 truncate">Ukuran Standar ID Card: 85.60 mm × 53.98 mm</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup KTA"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white bg-white/15 hover:bg-rose-600 border border-white/25 rounded-xl shrink-0 cursor-pointer transition-colors touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'single'
                ? 'bg-white text-sky-900 shadow-xs border border-sky-200'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4 text-sky-600" />
            <span>Kartu Anggota Ini (1 Kartu)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'batch'
                ? 'bg-white text-sky-900 shadow-xs border border-sky-200'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 text-sky-600" />
            <span>Cetak Batch Lembar A4 ({allMembers.length > 0 ? allMembers.length : 1} Kartu)</span>
          </button>
        </div>

        {/* Region Customization Bar */}
        <div className="bg-sky-50 px-4 py-2 border-b border-sky-100 flex items-center justify-between text-xs">
          <span className="font-bold text-sky-900 flex items-center gap-1.5">
            <span>Kelurahan Aktif:</span>
            <span className="bg-sky-600 text-white px-2 py-0.5 rounded font-black uppercase">{customKelurahan}</span>
          </span>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="text-sky-700 hover:text-sky-900 font-bold underline cursor-pointer"
          >
            {showSettings ? 'Tutup Pengaturan Wilayah' : 'Ubah / Atur Wilayah KTA'}
          </button>
        </div>

        {showSettings && (
          <div className="bg-sky-900 text-white p-4 space-y-3 text-xs border-b border-sky-800 animate-in fade-in duration-200">
            <p className="font-extrabold text-sky-200">Sesuaikan Atribut Wilayah pada Kartu (KTA):</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-sky-300 mb-1 uppercase">Kelurahan / Desa</label>
                <input
                  type="text"
                  value={customKelurahan}
                  onChange={(e) => setCustomKelurahan(e.target.value)}
                  className="w-full bg-sky-950 border border-sky-700 rounded-xl px-3 py-1.5 text-white font-bold uppercase focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-sky-300 mb-1 uppercase">Kecamatan</label>
                <input
                  type="text"
                  value={customKecamatan}
                  onChange={(e) => setCustomKecamatan(e.target.value)}
                  className="w-full bg-sky-950 border border-sky-700 rounded-xl px-3 py-1.5 text-white font-bold uppercase focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-sky-300 mb-1 uppercase">Kabupaten / Kota</label>
                <input
                  type="text"
                  value={customKota}
                  onChange={(e) => setCustomKota(e.target.value)}
                  className="w-full bg-sky-950 border border-sky-700 rounded-xl px-3 py-1.5 text-white font-bold uppercase focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-sky-300 mb-1 uppercase">Provinsi</label>
                <input
                  type="text"
                  value={customProvinsi}
                  onChange={(e) => setCustomProvinsi(e.target.value)}
                  className="w-full bg-sky-950 border border-sky-700 rounded-xl px-3 py-1.5 text-white font-bold uppercase focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Body - Card Graphic Preview */}
        <div className="p-4 sm:p-10 bg-slate-100 flex flex-col items-center justify-center overflow-x-auto min-h-[400px]">
          {/* Card View Switcher (Front/Back) */}
          <div className="flex items-center gap-1 mb-4 bg-white p-1 rounded-full border border-slate-300 shadow-sm">
            <button
              onClick={() => setShowBack(false)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${!showBack ? 'bg-sky-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
            >
              TAMPAK DEPAN
            </button>
            <button
              onClick={() => setShowBack(true)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${showBack ? 'bg-sky-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
            >
              TAMPAK BELAKANG
            </button>
          </div>

          {/* Card Container */}
          <div className="shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.01]">
            {!showBack ? (
              /* FRONT SIDE */
              <div
                className="relative w-[342px] h-[216px] sm:w-[430px] sm:h-[272px] rounded-xl sm:rounded-2xl overflow-hidden border-2 border-sky-600 font-sans text-black shrink-0 select-none flex flex-col animate-in slide-in-from-right-4 duration-300"
                style={{
                  background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 45%, #bae6fd 100%)',
                  backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(3, 105, 161, 0.12) 1px, transparent 0), linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 45%, #bae6fd 100%)',
                  backgroundSize: '12px 12px, 100% 100%',
                }}
              >
                {/* Subtle Batik Watermark Overlay */}
                <div
                  className="absolute inset-0 opacity-[0.06] pointer-events-none bg-repeat"
                  style={{
                    backgroundImage: 'radial-gradient(#0369a1 1px, transparent 1px)',
                    backgroundSize: '8px 8px',
                  }}
                />

                {/* TOP HEADER BANNER */}
                <div
                  className="relative px-2.5 py-1.5 sm:px-3 sm:py-2 text-white flex items-center border-b-2 border-amber-400 shrink-0"
                  style={{
                    background: 'linear-gradient(90deg, #0284c7 0%, #0369a1 100%)',
                  }}
                >
                  {/* Logo PKK Resmi */}
                  <div className="w-[38px] h-[38px] sm:w-[46px] sm:h-[46px] rounded-full bg-white shrink-0 flex items-center justify-center p-0.5 shadow-md overflow-hidden border border-white">
                    <img
                      src={PKK_LOGO_BASE64}
                      alt="Logo PKK Resmi"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {/* Centered Titles */}
                  <div className="leading-[1.15] flex-1 text-center mr-[38px] sm:mr-[46px]">
                    <h1 className="text-[10px] sm:text-[13px] font-black tracking-wide text-white drop-shadow-xs uppercase">
                      KARTU TANDA ANGGOTA
                    </h1>
                    <p className="text-[6.5px] sm:text-[8.5px] font-bold text-sky-100 tracking-tight uppercase">
                      PEMBERDAYAAN KESEJAHTERAAN KELUARGA (PKK)
                    </p>
                    <p className="text-[7.5px] sm:text-[9.5px] font-black text-amber-300 tracking-wider uppercase mt-[1px]">
                      KELURAHAN {kelurahanFormatted}
                    </p>
                  </div>
                </div>

                {/* CARD MAIN BODY */}
                <div className="p-2 sm:p-2.5 flex gap-2 sm:gap-2.5 items-start flex-1 min-h-0 relative">
                  {/* Left Photo Frame */}
                  <div className="w-[68px] sm:w-[86px] shrink-0 flex flex-col items-center justify-between h-full">
                    <div className="w-[66px] h-[88px] sm:w-[84px] sm:h-[112px] rounded-lg border-2 border-sky-600 overflow-hidden bg-white shadow-xs flex items-center justify-center">
                      <img
                        src={photoUrl}
                        alt={namaFormatted}
                        className={`w-full h-full ${photoUrl === PKK_LOGO_BASE64 ? 'object-contain p-2' : 'object-cover object-top'}`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PKK_LOGO_BASE64;
                        }}
                      />
                    </div>

                    {/* POJOK KIRI BAWAH: BADGE MEDAN UNTUK SEMUA */}
                    <div 
                      className="inline-flex items-stretch rounded-md sm:rounded-lg overflow-hidden border border-slate-900 shadow-[0_2px_6px_rgba(0,0,0,0.35)] select-none mt-auto mb-1 shrink-0 self-start"
                      style={{ marginLeft: '2mm', marginBottom: '2mm' }}
                    >
                      <div className="bg-[#991b1b] text-white px-1.5 sm:px-2 py-0.5 text-[6px] sm:text-[8px] font-black tracking-tight flex items-center justify-center border-r border-slate-900">
                        MEDAN
                      </div>
                      <div className="bg-[#1e3a8a] text-white px-1.5 sm:px-2.5 py-0.5 text-[5.5px] sm:text-[7.5px] font-black tracking-tight flex items-center justify-center leading-none text-center whitespace-nowrap">
                        UNTUK SEMUA
                      </div>
                    </div>
                  </div>

                  {/* Center Details List - TEXT BLACK AS REQUESTED */}
                  <div className="flex-1 min-w-0 pr-[54px] sm:pr-[68px] font-black text-[6.5px] sm:text-[8.5px] leading-[1.25] text-black uppercase">
                    <div className="flex items-baseline mb-[1px]">
                      <div className="w-[74px] sm:w-[94px] shrink-0 text-right text-black pr-1.5 opacity-70">NAMA</div>
                      <div className="w-[6px] shrink-0 text-center font-black text-black opacity-50">:</div>
                      <div className="flex-1 min-w-0 font-black text-black pl-1.5 break-words">{namaFormatted}</div>
                    </div>

                    <div className="flex items-baseline mb-[1px]">
                      <div className="w-[74px] sm:w-[94px] shrink-0 text-right text-black pr-1.5 opacity-70">JABATAN</div>
                      <div className="w-[6px] shrink-0 text-center font-black text-black opacity-50">:</div>
                      <div className="flex-1 min-w-0 font-black text-black pl-1.5 break-words">{jabatanFormatted}</div>
                    </div>

                    <div className="flex items-baseline mb-[1px]">
                      <div className="w-[74px] sm:w-[94px] shrink-0 text-right text-black pr-1.5 opacity-70">TEMPAT/TGL LAHIR</div>
                      <div className="w-[6px] shrink-0 text-center font-black text-black opacity-50">:</div>
                      <div className="flex-1 min-w-0 pl-1.5 break-words">{ttlFormatted}</div>
                    </div>

                    <div className="flex items-baseline mb-[1px]">
                      <div className="w-[74px] sm:w-[94px] shrink-0 text-right text-black pr-1.5 opacity-70">JENIS KELAMIN</div>
                      <div className="w-[6px] shrink-0 text-center font-black text-black opacity-50">:</div>
                      <div className="flex-1 min-w-0 pl-1.5">{genderFormatted}</div>
                    </div>

                    {/* ALAMAT */}
                    <div className="flex items-baseline mb-[4px] sm:mb-[6px]">
                      <div className="w-[74px] sm:w-[94px] shrink-0 text-right text-black pr-1.5 opacity-70">ALAMAT</div>
                      <div className="w-[6px] shrink-0 text-center font-black text-black opacity-50">:</div>
                      <div className="flex-1 min-w-0 pl-1.5 break-words">{alamatFormatted}</div>
                    </div>

                    {/* Region Block */}
                    <div className="flex items-baseline mb-[1px]">
                      <div className="w-[74px] sm:w-[94px] shrink-0 text-right text-black pr-1.5 opacity-70">DESA/KELURAHAN</div>
                      <div className="w-[6px] shrink-0 text-center font-black text-black opacity-50">:</div>
                      <div className="flex-1 min-w-0 pl-1.5 font-black">{kelurahanFormatted}</div>
                    </div>

                    <div className="flex items-baseline mb-[1px]">
                      <div className="w-[74px] sm:w-[94px] shrink-0 text-right text-black pr-1.5 opacity-70">KECAMATAN</div>
                      <div className="w-[6px] shrink-0 text-center font-black text-black opacity-50">:</div>
                      <div className="flex-1 min-w-0 pl-1.5 font-black">{kecamatanFormatted}</div>
                    </div>

                    <div className="flex items-baseline mb-[1px]">
                      <div className="w-[74px] sm:w-[94px] shrink-0 text-right text-black pr-1.5 opacity-70">KABUPATEN/KOTA</div>
                      <div className="w-[6px] shrink-0 text-center font-black text-black opacity-50">:</div>
                      <div className="flex-1 min-w-0 pl-1.5 font-black">{kotaFormatted}</div>
                    </div>

                    <div className="flex items-baseline">
                      <div className="w-[74px] sm:w-[94px] shrink-0 text-right text-black pr-1.5 opacity-70">PROVINSI</div>
                      <div className="w-[6px] shrink-0 text-center font-black text-black opacity-50">:</div>
                      <div className="flex-1 min-w-0 pl-1.5 font-black">{provinsiFormatted}</div>
                    </div>
                  </div>

                  {/* Bottom Right QR Code */}
                  <div className="absolute right-2 bottom-1.5 sm:right-2.5 sm:bottom-2 flex flex-col items-center">
                    <div className="w-[42px] h-[42px] sm:w-[54px] sm:h-[54px] p-0.5 bg-white rounded border border-slate-300 shadow-xs">
                      <img
                        src={qrUrl}
                        alt="QR Verification"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-[4.5px] sm:text-[6px] font-black text-black mt-0.5 text-center leading-none tracking-tight opacity-80">
                      SCAN VERIFIKASI
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* BACK SIDE - Updated with 10 Programs & Signature Area */
              <div
                className="relative w-[342px] h-[216px] sm:w-[430px] sm:h-[272px] rounded-xl sm:rounded-2xl overflow-hidden border-2 border-sky-600 font-sans text-black shrink-0 select-none flex flex-col animate-in slide-in-from-left-4 duration-300"
                style={{
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(3, 105, 161, 0.08) 1px, transparent 0), linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  backgroundSize: '16px 16px, 100% 100%',
                }}
              >
                {/* 10 Program Pokok PKK Header */}
                <div className="bg-sky-700 py-1.5 text-center border-b border-sky-600">
                  <h2 className="text-[8px] sm:text-[10px] font-black text-white uppercase tracking-wider">
                    10 Program Pokok PKK
                  </h2>
                </div>

                {/* Programs List - 2 Columns */}
                <div className="p-3 sm:p-4 grid grid-cols-2 gap-x-4 gap-y-1.5 flex-1 items-start content-start">
                  {[
                    'Penghayatan dan Pengamalan Pancasila',
                    'Gotong Royong',
                    'Pangan',
                    'Sandang',
                    'Perumahan dan Tata Laksana Rumah Tangga',
                    'Pendidikan dan Keterampilan',
                    'Kesehatan',
                    'Pengembangan Kehidupan Berkoperasi',
                    'Kelestarian Lingkungan Hidup',
                    'Perencanaan Sehat'
                  ].map((prog, idx) => (
                    <div key={idx} className="flex gap-1.5 items-start">
                      <span className="text-[7px] sm:text-[8px] font-black text-sky-700">{idx + 1}.</span>
                      <p className="text-[6px] sm:text-[7.5px] font-black text-black leading-tight uppercase">
                        {prog}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Signature Area (Missing in user image) */}
                <div className="px-4 pb-3 flex justify-end">
                  <div className="text-center w-[120px] sm:w-[150px]">
                    <p className="text-[5.5px] sm:text-[7px] font-bold text-black uppercase">
                      Medan, {formatDateToIndonesianFull(new Date().toISOString())}
                    </p>
                    <p className="text-[6px] sm:text-[7.5px] font-black text-black uppercase mt-0.5">
                      Ketua TP PKK Kelurahan {kelurahanFormatted}
                    </p>
                    <div className="h-8 sm:h-10 my-1 flex items-center justify-center italic text-slate-300 text-[10px]">
                      ( Tanda Tangan & Stempel )
                    </div>
                    <p className="text-[6.5px] sm:text-[8px] font-black text-black uppercase border-t border-black pt-0.5">
                      Ny. Fransiska F.A. Tarigan
                    </p>
                  </div>
                </div>
              </div>

            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Format Resmi Sesuai Dimensi Fisik ID Card Standar (85.6mm × 53.98mm)</span>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'single' ? (
              <button
                type="button"
                onClick={handlePrintSingle}
                disabled={isPrinting}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrinting ? 'Menyiapkan CETAK...' : 'Cetak 1 Kartu Anggota'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePrintBatch}
                disabled={isPrinting}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {isPrinting
                    ? 'Menyiapkan Lembar A4...'
                    : `Cetak Sheet A4 (${allMembers.length > 0 ? allMembers.length : 1} Kartu)`}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
