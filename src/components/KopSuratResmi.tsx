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
        width: '85px',
        height: '105px',
        minWidth: '85px',
        maxWidth: '85px',
        objectFit: 'contain',
        display: 'block',
        marginLeft: '15px',
      }}
      onError={(e) => {
        (e.target as HTMLImageElement).src = 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Lambang_Kota_Medan.png';
      }}
    />
    <div className="text-center flex-1" style={{ flex: 1, textAlign: 'center', paddingRight: '100px' }}>
      <div
        className="text-[14pt] uppercase font-sans text-black font-bold tracking-[0.05em]"
        style={{ fontSize: '14pt', fontWeight: 'bold', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.2', marginBottom: '1px' }}
      >
        PEMERINTAH KOTA MEDAN
      </div>
      <div
        className="text-[14pt] uppercase font-sans text-black font-bold tracking-[0.05em]"
        style={{ fontSize: '14pt', fontWeight: 'bold', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.2', marginBottom: '2px' }}
      >
        KECAMATAN MEDAN TUNTUNGAN
      </div>
      <div
        className="text-[18pt] font-black uppercase font-sans text-black tracking-[0.06em]"
        style={{ fontSize: '18pt', fontWeight: '900', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.1', marginBottom: '3px' }}
      >
        KELURAHAN MANGGA
      </div>
      <div
        className="text-[9pt] font-sans text-black italic"
        style={{ fontSize: '9pt', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.2' }}
      >
        Jalan Tembakau Raya No.35 A Perumnas Simalingkar, Medan 20141
      </div>
      <div
        className="text-[8.5pt] font-sans text-black"
        style={{ fontSize: '8.5pt', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.2' }}
      >
        Surat Elektronik: kel.mangga@pemkomedan.go.id
      </div>
    </div>
  </div>
);
