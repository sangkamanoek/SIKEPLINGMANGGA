import React from 'react';

export const KopSuratResmi: React.FC<{ className?: string; compact?: boolean }> = ({
  className = '',
  compact = false,
}) => (
  <div
    className={`flex items-center border-b-black ${compact ? 'border-b-[2.5px] pb-1 mb-1.5' : 'border-b-[3px] pb-2 mb-2.5'} ${className}`}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: compact ? '8px' : '10px',
      borderBottom: compact ? '2.5px solid #000000' : '3px solid #000000',
      paddingTop: compact ? '0px' : '2px',
      paddingBottom: compact ? '4px' : '8px',
      marginBottom: compact ? '6px' : '10px',
      width: '100%',
    }}
  >
    <img
      src="/logo_pemko_medan.png"
      alt="Logo Pemko Medan"
      crossOrigin="anonymous"
      className="shrink-0"
      style={{
        width: compact ? '70px' : '110px',
        height: compact ? '88px' : '135px',
        minWidth: compact ? '70px' : '110px',
        maxWidth: compact ? '70px' : '110px',
        objectFit: 'contain',
        display: 'block',
        marginLeft: compact ? '4px' : '10px',
      }}
      onError={(e) => {
        (e.target as HTMLImageElement).src =
          'https://upload.wikimedia.org/wikipedia/commons/e/eb/Lambang_Kota_Medan.png';
      }}
    />
    <div
      className="text-center flex-1"
      style={{
        flex: 1,
        textAlign: 'center',
        paddingRight: compact ? '78px' : '120px',
      }}
    >
      <div
        className="uppercase font-sans text-black font-bold tracking-[0.05em]"
        style={{
          fontSize: compact ? '11.5pt' : '14pt',
          fontWeight: 'bold',
          fontFamily: 'sans-serif',
          color: '#000000',
          lineHeight: '1.2',
          marginBottom: '1px',
        }}
      >
        PEMERINTAH KOTA MEDAN
      </div>
      <div
        className="uppercase font-sans text-black font-bold tracking-[0.05em]"
        style={{
          fontSize: compact ? '11.5pt' : '14pt',
          fontWeight: 'bold',
          fontFamily: 'sans-serif',
          color: '#000000',
          lineHeight: '1.2',
          marginBottom: '1px',
        }}
      >
        KECAMATAN MEDAN TUNTUNGAN
      </div>
      <div
        className="font-black uppercase font-sans text-black tracking-[0.06em]"
        style={{
          fontSize: compact ? '15pt' : '18pt',
          fontWeight: '900',
          fontFamily: 'sans-serif',
          color: '#000000',
          lineHeight: '1.1',
          marginBottom: compact ? '2px' : '3px',
        }}
      >
        KELURAHAN MANGGA
      </div>
      <div
        className="font-sans text-black italic"
        style={{
          fontSize: compact ? '8pt' : '9pt',
          fontFamily: 'sans-serif',
          color: '#000000',
          lineHeight: '1.2',
        }}
      >
        Jalan Tembakau Raya No.35 A Perumnas Simalingkar, Medan 20141
      </div>
      <div
        className="font-sans text-black"
        style={{
          fontSize: compact ? '7.5pt' : '8.5pt',
          fontFamily: 'sans-serif',
          color: '#000000',
          lineHeight: '1.2',
        }}
      >
        Surat Elektronik: kel.mangga@pemkomedan.go.id
      </div>
    </div>
  </div>
);
