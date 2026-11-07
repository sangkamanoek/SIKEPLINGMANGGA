import React from 'react';

interface SignatureBlockProps {
  leftName: string;
  leftRole: string;
  rightName: string;
  rightRole: string;
  dateStr?: string;
}

export const SignatureBlock: React.FC<SignatureBlockProps> = ({
  leftName,
  leftRole,
  rightName,
  rightRole,
  dateStr,
}) => (
  <div style={{ marginTop: '24px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
    <table style={{ width: '100%', border: 'none', fontSize: '9pt', fontFamily: "'Times New Roman', Times, serif" }}>
      <tbody>
        <tr>
          <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top', border: 'none', padding: '0 10px' }}>
            <div>Mengetahui,</div>
            <div style={{ fontWeight: 'bold' }}>Ketua Tim Penggerak PKK Kelurahan Mangga</div>
            <div style={{ height: '60px' }} />
            <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{leftName}</div>
            <div style={{ fontSize: '8pt', color: '#475569' }}>{leftRole}</div>
          </td>
          <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top', border: 'none', padding: '0 10px' }}>
            <div>{dateStr || `Medan, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`}</div>
            <div style={{ fontWeight: 'bold' }}>Sekretaris Tim Penggerak PKK Kelurahan Mangga</div>
            <div style={{ height: '60px' }} />
            <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{rightName}</div>
            <div style={{ fontSize: '8pt', color: '#475569' }}>{rightRole}</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);
