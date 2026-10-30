import React, { useState } from 'react';
import { X, Printer, Download, CreditCard, Layers, CheckCircle2 } from 'lucide-react';
import { printOfficialDocument } from '../utils/printHelper';
import { generateSinglePkkCardHtml, generateBatchPkkCardHtml } from '../utils/pkkCardGenerator';

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

  if (!isOpen || !member) return null;

  const photoUrl = member.pasphotoUrl || '/logo_pkk.jpg';

  const regNo = `12.71.10.2001.${String(member.id || '0045').replace(/[^0-9]/g, '').slice(-4).padStart(4, '0')}`;
  const namaFormatted = (member.nama || 'NUR AINI, S.Pd.').toUpperCase();
  const jabatanFormatted = (member.jabatan || 'ANGGOTA TP PKK KELURAHAN').toUpperCase();
  const ttlFormatted = `${(member.tempatLahir || 'MEDAN').toUpperCase()}, ${member.tanggalLahir || '16-04-1991'}`;
  const genderFormatted = member.jenisKelamin === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN';
  const alamatFormatted = (member.alamat || 'JL. BUNGA RINTE NO. 12, LINGKUNGAN IV').toUpperCase();
  const kelurahanFormatted = 'MANGGA';
  const kecamatanFormatted = 'MEDAN TUNTUNGAN';
  const kotaFormatted = 'KOTA MEDAN';
  const provinsiFormatted = 'SUMATERA UTARA';

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    `KTA-PKK|${regNo}|${namaFormatted}|${jabatanFormatted}|KELURAHAN_MANGGA`
  )}`;

  const handlePrintSingle = () => {
    setIsPrinting(true);
    const cardHtml = generateSinglePkkCardHtml(member);
    
    const container = document.createElement('div');
    const elementId = `kta-single-print-${Date.now()}`;
    container.id = elementId;
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.innerHTML = cardHtml;
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
    const batchHtml = generateBatchPkkCardHtml(listToPrint);

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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-sky-200 overflow-hidden my-6 flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-sky-800 via-cyan-800 to-teal-900 text-white p-4.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/20 border border-white/30 backdrop-blur-md">
              <CreditCard className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-base text-white">
                Kartu Tanda Anggota (KTA) PKK
              </h3>
              <p className="text-xs text-sky-200">Ukuran Standar ID Card: 85.60 mm × 53.98 mm</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-sky-200 hover:text-white rounded-xl hover:bg-white/10 cursor-pointer transition-colors"
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

        {/* Modal Body - Card Graphic Preview */}
        <div className="p-6 bg-slate-200 flex flex-col items-center justify-center overflow-x-auto min-h-[320px]">
          {/* THE EXACT STANDARDIZED PKK CARD COMPONENT */}
          <div
            className="relative w-[342px] h-[216px] sm:w-[428px] sm:h-[270px] rounded-2xl overflow-hidden shadow-2xl border-2 border-sky-600 font-sans text-slate-900 shrink-0 select-none transition-transform hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 45%, #bae6fd 100%)',
              boxShadow: '0 20px 30px -10px rgba(2, 132, 199, 0.3)',
            }}
          >
            {/* Subtle Batik Watermark Overlay */}
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none bg-repeat"
              style={{
                backgroundImage: 'radial-gradient(#0369a1 1px, transparent 1px)',
                backgroundSize: '8px 8px',
              }}
            />

            {/* TOP HEADER BANNER (Vibrant Gradient Cyan/Blue) */}
            <div
              className="relative px-2.5 py-1.5 sm:px-3 sm:py-2 text-white flex items-center gap-2 sm:gap-2.5 border-b-2 border-amber-400"
              style={{
                background: 'linear-gradient(90deg, #0284c7 0%, #0369a1 100%)',
              }}
            >
              {/* Logo PKK - Zoom in 1.70x untuk membuang margin putih gambar JPEG & memperbesar emblem logo */}
              <div className="w-[36px] h-[36px] sm:w-[48px] sm:h-[48px] rounded-full bg-white shrink-0 flex items-center justify-center shadow-md overflow-hidden border border-white">
                <img
                  src="/logo_pkk.jpg"
                  alt="Logo PKK"
                  className="w-full h-full object-cover scale-[1.70] rounded-full"
                />
              </div>
              <div className="leading-[1.12] flex-1">
                <h1 className="text-[10.5px] sm:text-[14px] font-black tracking-wide text-white drop-shadow-xs uppercase">
                  KARTU TANDA ANGGOTA
                </h1>
                <p className="text-[7px] sm:text-[9.5px] font-bold text-sky-100 tracking-tight uppercase">
                  PEMBERDAYAAN KESEJAHTERAAN KELUARGA (PKK)
                </p>
                <p className="text-[7.5px] sm:text-[10px] font-black text-amber-300 tracking-wider uppercase mt-[0.5px]">
                  KELURAHAN MANGGA
                </p>
              </div>
            </div>

            {/* CARD MAIN BODY */}
            <div className="p-2 sm:p-3 flex gap-2 sm:gap-3 items-start h-[calc(100%-42px)]">
              {/* Left Photo Frame (Pasphoto 3x4 style) */}
              <div className="w-[72px] sm:w-[96px] shrink-0 flex flex-col items-center">
                <div className="w-[70px] h-[92px] sm:w-[92px] sm:h-[122px] rounded-lg border-2 border-sky-600 overflow-hidden bg-sky-100 shadow-md">
                  <img
                    src={photoUrl}
                    alt={namaFormatted}
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/logo_pkk.jpg';
                    }}
                  />
                </div>
              </div>

              {/* Middle & Right Details List */}
              <div className="flex-1 min-w-0 font-extrabold text-[7px] sm:text-[9.2px] leading-[1.3] text-slate-900 space-y-[1.5px] uppercase">
                <div className="grid grid-cols-[82px_6px_1fr] sm:grid-cols-[105px_8px_1fr] items-baseline">
                  <span className="text-slate-700">NO. REGISTRASI</span>
                  <span>:</span>
                  <span className="font-black text-sky-900 tracking-tight">{regNo}</span>
                </div>

                <div className="grid grid-cols-[82px_6px_1fr] sm:grid-cols-[105px_8px_1fr] items-baseline">
                  <span className="text-slate-700">NAMA</span>
                  <span>:</span>
                  <span className="font-black text-slate-950 truncate">{namaFormatted}</span>
                </div>

                <div className="grid grid-cols-[82px_6px_1fr] sm:grid-cols-[105px_8px_1fr] items-baseline">
                  <span className="text-slate-700">JABATAN</span>
                  <span>:</span>
                  <span className="font-extrabold text-sky-800 truncate">{jabatanFormatted}</span>
                </div>

                <div className="grid grid-cols-[82px_6px_1fr] sm:grid-cols-[105px_8px_1fr] items-baseline">
                  <span className="text-slate-700">TEMPAT/TGL LAHIR</span>
                  <span>:</span>
                  <span className="truncate">{ttlFormatted}</span>
                </div>

                <div className="grid grid-cols-[82px_6px_1fr] sm:grid-cols-[105px_8px_1fr] items-baseline">
                  <span className="text-slate-700">JENIS KELAMIN</span>
                  <span>:</span>
                  <span>{genderFormatted}</span>
                </div>

                <div className="grid grid-cols-[82px_6px_1fr] sm:grid-cols-[105px_8px_1fr] items-baseline">
                  <span className="text-slate-700">ALAMAT</span>
                  <span>:</span>
                  <span className="truncate">{alamatFormatted}</span>
                </div>

                <div className="grid grid-cols-[82px_6px_1fr] sm:grid-cols-[105px_8px_1fr] items-baseline">
                  <span className="text-slate-700">DESA/KELURAHAN</span>
                  <span>:</span>
                  <span className="font-bold">{kelurahanFormatted}</span>
                </div>

                <div className="grid grid-cols-[82px_6px_1fr] sm:grid-cols-[105px_8px_1fr] items-baseline">
                  <span className="text-slate-700">KECAMATAN</span>
                  <span>:</span>
                  <span className="font-bold">{kecamatanFormatted}</span>
                </div>

                <div className="grid grid-cols-[82px_6px_1fr] sm:grid-cols-[105px_8px_1fr] items-baseline">
                  <span className="text-slate-700">KABUPATEN/KOTA</span>
                  <span>:</span>
                  <span className="font-bold">{kotaFormatted}</span>
                </div>

                <div className="grid grid-cols-[82px_6px_1fr] sm:grid-cols-[105px_8px_1fr] items-baseline">
                  <span className="text-slate-700">PROVINSI</span>
                  <span>:</span>
                  <span className="font-bold">{provinsiFormatted}</span>
                </div>
              </div>

              {/* POJOK KIRI BAWAH: BADGE MEDAN UNTUK SEMUA */}
              <div className="absolute left-2.5 bottom-2 sm:left-3.5 sm:bottom-2.5 inline-flex items-center rounded overflow-hidden text-[5.5px] sm:text-[7.5px] font-black border border-slate-900 shadow-2xs select-none">
                <span className="bg-red-800 text-white px-1 sm:px-1.5 py-[1px] font-black tracking-tight">MEDAN</span>
                <span className="bg-blue-900 text-white px-1 sm:px-1.5 py-[1px] font-black tracking-tight">UNTUK SEMUA</span>
              </div>

              {/* Bottom Right QR Code */}
              <div className="absolute right-2 bottom-2 sm:right-3 sm:bottom-3 flex flex-col items-center">
                <div className="w-[38px] h-[38px] sm:w-[50px] sm:h-[50px] p-0.5 bg-white rounded border border-slate-300 shadow-xs">
                  <img
                    src={qrUrl}
                    alt="QR Verification"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-[4px] sm:text-[5.5px] font-black text-sky-950 mt-0.5 text-center leading-none tracking-tighter">
                  SCAN UNTUK DATA KARTU
                  <br />
                  SCAN TO VIEW
                </span>
              </div>
            </div>
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
