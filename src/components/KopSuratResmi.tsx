import React from 'react';

export const KopSuratResmi: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`flex items-center pb-2 border-b-[3px] border-black mb-2.5 ${className}`}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      borderBottom: '3px solid #000000',
      paddingTop: '2px',
      paddingBottom: '8px',
      marginBottom: '10px',
      width: '100%',
    }}
  >
    <img
      src="/logo_pemko_medan.png"
      alt="Logo Pemko Medan"
      crossOrigin="anonymous"
      className="shrink-0"
      style={{
        width: '96px',
        height: '115px',
        minWidth: '96px',
        maxWidth: '96px',
        objectFit: 'contain',
        display: 'block',
        marginLeft: '18px',
      }}
      onError={(e) => {
        (e.target as HTMLImageElement).src = 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Lambang_Kota_Medan.png';
      }}
    />
    <div className="text-center flex-1" style={{ flex: 1, textAlign: 'center', paddingRight: '114px' }}>
      <div
        className="text-[13pt] uppercase font-sans text-black font-bold tracking-[0.04em]"
        style={{ fontSize: '13pt', fontWeight: 'bold', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.2', marginBottom: '1px' }}
      >
        PEMERINTAH KOTA MEDAN
      </div>
      <div
        className="text-[13pt] uppercase font-sans text-black font-bold tracking-[0.04em]"
        style={{ fontSize: '13pt', fontWeight: 'bold', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.2', marginBottom: '2px' }}
      >
        KECAMATAN MEDAN TUNTUNGAN
      </div>
      <div
        className="text-[17pt] font-black uppercase font-sans text-black tracking-[0.05em]"
        style={{ fontSize: '17pt', fontWeight: '900', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1', marginBottom: '2px' }}
      >
        KELURAHAN MANGGA
      </div>
      <div
        className="text-[8.5pt] font-sans text-black"
        style={{ fontSize: '8.5pt', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.2' }}
      >
        Jalan Tembakau Raya No.35 A Medan Tuntungan, Medan, Sumatera Utara 20141
      </div>
      <div
        className="text-[8pt] font-sans text-black"
        style={{ fontSize: '8pt', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.2' }}
      >
        Laman kel.mangga@pemkomedan.go.id
      </div>
    </div>
  </div>
);
