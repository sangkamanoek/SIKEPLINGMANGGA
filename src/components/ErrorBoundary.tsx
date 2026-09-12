import React, { useState, useEffect, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

export function ErrorBoundary({ children, fallbackTitle }: Props) {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      console.error('Captured window error:', event.error);
      setHasError(true);
      setErrorMessage(event.error?.message || event.message || 'Terjadi kesalahan sistem.');
    };

    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl max-w-lg mx-auto my-8 text-center shadow-lg space-y-4">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-red-900">
            {fallbackTitle || 'Gagal Memuat Tampilan'}
          </h3>
          <p className="text-xs text-red-700 mt-1">
            {errorMessage || 'Terjadi kesalahan saat merender data laporan.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHasError(false)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Coba Muat Ulang Tampilan</span>
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
