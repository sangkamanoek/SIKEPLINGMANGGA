import React from 'react';

export const KopSuratPkk: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`flex items-center pb-2 border-b-4 border-double border-black mb-4 ${className}`}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      borderBottom: '4px double #000000',
      paddingBottom: '10px',
      marginBottom: '15px',
      width: '100%',
    }}
  >
    <img
      src="/logo_pkk.jpg"
      alt="Logo PKK"
      className="shrink-0"
      style={{
        width: '100px',
        height: '100px',
        minWidth: '100px',
        maxWidth: '100px',
        objectFit: 'contain',
        display: 'block',
      }}
    />
    <div className="text-center flex-1" style={{ flex: 1, textAlign: 'center', paddingRight: '100px' }}>
      <div
        className="text-[12pt] font-sans text-black font-bold tracking-tight"
        style={{ fontSize: '12pt', fontWeight: 'bold', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.2' }}
      >
        PEMBERDAYAAN DAN KESEJAHTERAAN KELUARGA
      </div>
      <div
        className="text-[11pt] font-bold font-sans text-black"
        style={{ fontSize: '11pt', fontWeight: 'bold', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.2' }}
      >
        (PKK)
      </div>
      <div
        className="text-[16pt] font-black uppercase font-sans text-black tracking-wide"
        style={{ fontSize: '16pt', fontWeight: '900', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.1', margin: '2px 0' }}
      >
        TIM PENGGERAK KELURAHAN MANGGA
      </div>
      <div
        className="text-[13pt] font-black uppercase font-sans text-black"
        style={{ fontSize: '13pt', fontWeight: '900', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.1', marginBottom: '2px' }}
      >
        KECAMATAN MEDAN TUNTUNGAN
      </div>
      <div
        className="text-[9pt] font-sans text-black mt-1"
        style={{ fontSize: '9pt', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.2' }}
      >
        Sekretariat : Jl. Tembakau Raya No. 35 A Perumnas Simalingkar, Medan 20141
      </div>
    </div>
  </div>
);
