import React from 'react';

export const KopSuratPkk: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`flex items-center justify-between pb-2 border-b-4 border-double border-black mb-4 ${className}`}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '4px double #000000',
      paddingBottom: '10px',
      marginBottom: '15px',
      width: '100%',
      boxSizing: 'border-box',
    }}
  >
    {/* Left Logo */}
    <div style={{ width: '100px', minWidth: '100px', textAlign: 'center', shrink: 0 }}>
      <img
        src="/logo_pkk.jpg"
        alt="Logo PKK"
        style={{
          width: '90px',
          height: '90px',
          objectFit: 'contain',
          display: 'block',
          margin: '0 auto',
        }}
      />
    </div>

    {/* Center Text Header */}
    <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
      <div
        style={{
          fontSize: '11pt',
          fontWeight: 'bold',
          fontFamily: "'Times New Roman', Times, serif, sans-serif",
          color: '#000000',
          lineHeight: '1.2',
        }}
      >
        PEMBERDAYAAN DAN KESEJAHTERAAN KELUARGA
      </div>
      <div
        style={{
          fontSize: '10pt',
          fontWeight: 'bold',
          fontFamily: "'Times New Roman', Times, serif, sans-serif",
          color: '#000000',
          lineHeight: '1.2',
        }}
      >
        (PKK)
      </div>
      <div
        style={{
          fontSize: '14pt',
          fontWeight: '900',
          fontFamily: "'Times New Roman', Times, serif, sans-serif",
          color: '#000000',
          lineHeight: '1.1',
          margin: '3px 0',
          textTransform: 'uppercase',
        }}
      >
        TIM PENGGERAK KELURAHAN MANGGA
      </div>
      <div
        style={{
          fontSize: '12pt',
          fontWeight: '900',
          fontFamily: "'Times New Roman', Times, serif, sans-serif",
          color: '#000000',
          lineHeight: '1.1',
          marginBottom: '3px',
          textTransform: 'uppercase',
        }}
      >
        KECAMATAN MEDAN TUNTUNGAN
      </div>
      <div
        style={{
          fontSize: '8.5pt',
          fontFamily: "'Times New Roman', Times, serif, sans-serif",
          color: '#000000',
          lineHeight: '1.2',
        }}
      >
        Sekretariat : Jl. Tembakau Raya No. 35 A Perumnas Simalingkar, Medan 20141
      </div>
    </div>

    {/* Right Balance Spacer */}
    <div style={{ width: '100px', minWidth: '100px', shrink: 0, visibility: 'hidden' }}>
      <img
        src="/logo_pkk.jpg"
        alt="Spacer"
        style={{ width: '90px', height: '90px', objectFit: 'contain' }}
      />
    </div>
  </div>
);
