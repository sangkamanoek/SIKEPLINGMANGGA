
export const KopSuratResmi = () => (
  <div
    className="flex items-center gap-3.5 pb-2 border-b-[3px] border-black mb-2.5"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      borderBottom: '3px solid #000000',
      paddingTop: '2px',
      paddingBottom: '8px',
      marginBottom: '10px',
    }}
  >
    <img
      src="/logo_pemko_medan.png"
      alt="Logo Pemko Medan"
      crossOrigin="anonymous"
      className="shrink-0"
      style={{
        width: '74px',
        height: '89px',
        minWidth: '74px',
        maxWidth: '74px',
        objectFit: 'contain',
        display: 'block',
      }}
    />
    <div className="text-center flex-1" style={{ flex: 1, textAlign: 'center', paddingRight: '74px' }}>
      <div
        className="text-[12.5pt] uppercase font-sans text-black font-bold tracking-[0.04em]"
        style={{ fontSize: '12.5pt', fontWeight: 'bold', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.25', marginBottom: '2px' }}
      >
        PEMERINTAH KOTA MEDAN
      </div>
      <div
        className="text-[12.5pt] uppercase font-sans text-black font-bold tracking-[0.04em]"
        style={{ fontSize: '12.5pt', fontWeight: 'bold', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.25', marginBottom: '3px' }}
      >
        KECAMATAN MEDAN TUNTUNGAN
      </div>
      <div
        className="text-[16.5pt] font-black uppercase font-sans text-black tracking-[0.05em]"
        style={{ fontSize: '16.5pt', fontWeight: '900', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1', marginBottom: '3px' }}
      >
        KELURAHAN MANGGA
      </div>
      <div
        className="text-[8pt] font-sans text-black"
        style={{ fontSize: '8pt', fontFamily: 'sans-serif', color: '#000000', lineHeight: '1.2' }}
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
