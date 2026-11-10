import React from 'react';

interface ComponentLoaderProps {
  label?: string;
  minHeight?: string;
}

export const ComponentLoader: React.FC<ComponentLoaderProps> = ({
  label = 'Memuat modul...',
  minHeight = 'min-h-[320px]',
}) => {
  return (
    <div
      className={`w-full ${minHeight} flex flex-col items-center justify-center p-6 text-center animate-fade-in`}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex items-center justify-center">
        {/* Outer glowing pulse ring */}
        <div className="absolute w-12 h-12 rounded-full bg-emerald-500/20 animate-ping" />
        {/* Spinning indicator */}
        <div className="w-10 h-10 border-3 border-emerald-200 border-t-emerald-700 rounded-full animate-spin" />
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-600 tracking-wide">
        {label}
      </p>
      <span className="mt-1 text-[10px] text-slate-400">
        Menyiapkan tampilan &amp; data lokal
      </span>
    </div>
  );
};
