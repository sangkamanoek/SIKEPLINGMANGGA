import React, { useState } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Presentation, 
  CheckCircle2, 
  FileSpreadsheet, 
  Smartphone, 
  Lock, 
  FileText, 
  Share2, 
  Printer,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import pptxgen from 'pptxgenjs';

interface PanduanPPTModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PanduanPPTModal: React.FC<PanduanPPTModalProps> = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const slidesData = [
    {
      title: "SI KEPLING MANGGA",
      subtitle: "Sistem Informasi & Pelaporan Kegiatan Harian Kepala Lingkungan",
      category: "Panduan Resmi Penggunaan Aplikasi",
      color: "from-emerald-700 to-teal-900",
      content: (
        <div className="flex flex-col items-center text-center space-y-4 py-6">
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-800 shadow-lg border border-emerald-200">
            <Presentation className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-wide">Kelurahan Mangga</h3>
            <p className="text-emerald-700 font-bold text-sm">Kecamatan Medan Tuntungan • Kota Medan</p>
          </div>
          <p className="text-slate-600 text-sm max-w-lg leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
            Panduan lengkap penggunaan aplikasi pelaporan kinerja harian untuk seluruh Kepala Lingkungan (Kepling) di Kelurahan Mangga.
          </p>
        </div>
      )
    },
    {
      title: "1. Akses & Login Akun",
      subtitle: "Tata cara masuk ke dalam aplikasi SI KEPLING MANGGA",
      category: "Langkah Pertama",
      color: "from-slate-800 to-emerald-900",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-700 text-sm py-2">
          <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">1</span>
              Buka Web Resmi
            </div>
            <p className="text-xs text-slate-600">Buka link aplikasi di browser HP/Laptop (Google Chrome/Safari).</p>
          </div>
          <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">2</span>
              Pilih Akun Lingkungan
            </div>
            <p className="text-xs text-slate-600">Pilih nomor lingkungan Anda pada daftar (Contoh: Lingkungan XXI).</p>
          </div>
          <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs">3</span>
              Masukkan Password Default
            </div>
            <p className="text-xs text-slate-600">Password standar: <code className="bg-amber-200 px-1.5 py-0.5 rounded font-mono font-bold">mangga[no_lingkungan]</code> (Contoh: mangga21).</p>
          </div>
          <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-blue-900">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">4</span>
              Ubah Password Akun
            </div>
            <p className="text-xs text-slate-600">Sangat disarankan langsung mengubah password akun melalui tombol profil demi keamanan.</p>
          </div>
        </div>
      )
    },
    {
      title: "2. Mengisi Laporan Harian",
      subtitle: "Panduan pengisian formulir kegiatan harian Kepling",
      category: "Input Data",
      color: "from-teal-800 to-emerald-950",
      content: (
        <div className="space-y-3 py-1">
          <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800 text-sm">Pilih Tanggal Kegiatan</p>
              <p className="text-xs text-slate-500">Sistem otomatis mengisi tanggal hari ini, namun bisa disesuaikan jika perlu.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800 text-sm">Upload Foto Dokumentasi (Hingga 8 Foto)</p>
              <p className="text-xs text-slate-500">Ambil foto langsung dari kamera HP atau pilih dari galeri.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800 text-sm">Deskripsi Rincian Kegiatan</p>
              <p className="text-xs text-slate-500">Tulis uraian pekerjaan seperti: gotong royong, ronda malam, penertiban sampah, dll.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-amber-50 p-3 rounded-xl border border-amber-200">
            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900 text-sm">Opsi Siskamling / Ronda Malam</p>
              <p className="text-xs text-amber-700">Centang opsi Siskamling jika kegiatan berkaitan dengan pengawasan ronda malam di lingkungan.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "3. Simpan & Kirim WhatsApp",
      subtitle: "Penyimpanan database & integrasi WhatsApp",
      category: "Publikasi Laporan",
      color: "from-emerald-800 to-green-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700 mb-2 font-bold">
                1
              </div>
              <h4 className="font-bold text-slate-800 text-base mb-1">Simpan ke Database</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Klik tombol <strong className="text-emerald-700">Simpan Laporan</strong>. Data otomatis tersimpan di database server resmi kelurahan & monitoring Super Admin.
              </p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-green-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-700 mb-2 font-bold">
                2
              </div>
              <h4 className="font-bold text-slate-800 text-base mb-1">Kirim ke WhatsApp</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Klik <strong className="text-green-700">Salin & Kirim ke WhatsApp</strong>. Format laporan resmi beserta ringkasan langsung tersusun dan siap dikirim ke grup WA pimpinan.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "4. Riwayat & Cetak Dokumen PDF",
      subtitle: "Fitur cetak laporan resmi sesuai standar Pemko Medan",
      category: "Arsip & Cetak",
      color: "from-slate-800 to-indigo-950",
      content: (
        <div className="space-y-3 py-1">
          <div className="flex items-center gap-3 bg-indigo-50 p-3 rounded-xl border border-indigo-200">
            <FileText className="w-6 h-6 text-indigo-700 shrink-0" />
            <div>
              <h4 className="font-bold text-indigo-950 text-sm">Cetak Laporan Format Resmi</h4>
              <p className="text-xs text-indigo-800">Dokumen otomatis diformat lengkap dengan Kop Surat, Foto Dokumentasi 2 kolom, dan Tanda Tangan Lurah & Kepling.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <p className="font-bold text-slate-800 mb-1">📌 Pencarian Riwayat</p>
              <p className="text-slate-500">Cari laporan berdasarkan tanggal atau jenis kegiatan dengan cepat.</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <p className="font-bold text-slate-800 mb-1">✏️ Edit / Perbaiki Data</p>
              <p className="text-slate-500">Ubah atau tambahkan foto jika ada revisi pada laporan harian.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "5. Install Aplikasi di Layar Utama HP",
      subtitle: "Teknologi PWA - Akses mudah seperti aplikasi Play Store",
      category: "Fitur PWA",
      color: "from-emerald-900 to-teal-950",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-2">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              HP Android (Google Chrome)
            </div>
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal pl-4">
              <li>Buka website aplikasi di Chrome.</li>
              <li>Klik ikon titik tiga (⋮) kanan atas.</li>
              <li>Pilih <strong>"Tambahkan ke Layar Utama"</strong>.</li>
            </ol>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-2">
              <Smartphone className="w-4 h-4 text-blue-600" />
              HP iPhone (Safari)
            </div>
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal pl-4">
              <li>Buka website aplikasi di Safari.</li>
              <li>Klik tombol <strong>Share</strong> (kotak panah).</li>
              <li>Pilih <strong>"Tambah ke Layar Utama"</strong>.</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      title: "Terima Kasih",
      subtitle: "Mari wujudkan pelayanan publik yang cepat, transparan, & akuntabel",
      category: "Kelurahan Mangga",
      color: "from-emerald-700 to-slate-900",
      content: (
        <div className="flex flex-col items-center text-center space-y-4 py-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700">
            <Sparkles className="w-8 h-8" />
          </div>
          <p className="text-emerald-800 font-bold text-lg">"Satu Laporan Nyata untuk Pelayanan Masyarakat Kelurahan Mangga"</p>
          <div className="flex gap-4 text-xs font-bold uppercase tracking-wider text-slate-500">
            <span className="bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">#MedanUntukSemua</span>
            <span className="bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">#SemuaUntukMedan</span>
          </div>
        </div>
      )
    }
  ];

  // Function to generate and download PPTX file
  const handleDownloadPPT = async () => {
    try {
      setIsGenerating(true);
      const pptx = new pptxgen();

      pptx.author = "Kelurahan Mangga";
      pptx.company = "Pemerintah Kota Medan";
      pptx.title = "Panduan Penggunaan SI KEPLING MANGGA";

      // Define Master Slide Theme
      pptx.defineLayout({ name: 'A4', width: 10, height: 5.625 });

      // Slide 1: Cover
      const s1 = pptx.addSlide();
      s1.background = { color: '064E3B' }; // Emerald dark
      s1.addText('SI KEPLING MANGGA', { x: 0.8, y: 1.5, w: 8.4, h: 0.8, fontSize: 32, bold: true, color: 'FFFFFF', align: 'center' });
      s1.addText('Sistem Informasi & Pelaporan Kegiatan Harian Kepala Lingkungan', { x: 0.8, y: 2.3, w: 8.4, h: 0.5, fontSize: 16, color: 'A7F3D0', align: 'center' });
      s1.addText('Kelurahan Mangga • Kecamatan Medan Tuntungan • Kota Medan', { x: 0.8, y: 3.5, w: 8.4, h: 0.4, fontSize: 13, color: 'ECFDF5', align: 'center' });
      s1.addText('Panduan Resmi Penggunaan Aplikasi Bagi Kepala Lingkungan', { x: 0.8, y: 4.2, w: 8.4, h: 0.4, fontSize: 11, italic: true, color: 'D1FAE5', align: 'center' });

      // Slide 2: Login
      const s2 = pptx.addSlide();
      s2.addText('1. Akses & Login Akun Kepling', { x: 0.8, y: 0.5, w: 8.4, h: 0.6, fontSize: 22, bold: true, color: '064E3B' });
      s2.addText('Langkah mudah masuk ke sistem aplikasi:', { x: 0.8, y: 1.1, w: 8.4, h: 0.4, fontSize: 12, color: '475569' });
      
      const loginItems = [
        "1. Buka Web Resmi Aplikasi melalui browser Google Chrome atau Safari di HP / Laptop.",
        "2. Pilih Akun Lingkungan Anda (Contoh: Lingkungan XXI - Muhammad Shiddiq).",
        "3. Masukkan Password bawaan default: mangga[no_lingkungan] (Contoh: mangga21).",
        "4. Sangat disarankan segera MENGUBAH PASSWORD di menu profil demi keamanan akun."
      ];
      s2.addText(loginItems.join('\n\n'), { x: 0.8, y: 1.8, w: 8.4, h: 3.2, fontSize: 13, color: '1E293B', lineSpacing: 22 });

      // Slide 3: Input Laporan
      const s3 = pptx.addSlide();
      s3.addText('2. Mengisi Formulir Laporan Harian', { x: 0.8, y: 0.5, w: 8.4, h: 0.6, fontSize: 22, bold: true, color: '064E3B' });
      const inputItems = [
        "• Tanggal Laporan: Otomatis terisi hari ini (dapat disesuaikan bila perlu).",
        "• Foto Dokumentasi: Ambil / Upload foto kegiatan harian hingga maksimal 8 foto.",
        "• Deskripsi Kegiatan: Tuliskan rincian kegiatan seperti gotong royong, kerja bakti, dll.",
        "• Siskamling / Ronda: Centang opsi jika kegiatan berkaitan dengan pengawasan ronda malam."
      ];
      s3.addText(inputItems.join('\n\n'), { x: 0.8, y: 1.5, w: 8.4, h: 3.5, fontSize: 13, color: '1E293B', lineSpacing: 22 });

      // Slide 4: Simpan & Kirim WA
      const s4 = pptx.addSlide();
      s4.addText('3. Simpan & Kirim WhatsApp', { x: 0.8, y: 0.5, w: 8.4, h: 0.6, fontSize: 22, bold: true, color: '064E3B' });
      const pubItems = [
        "1. Klik tombol 'Simpan Laporan' untuk menyimpan permanen ke database resmi kelurahan.",
        "2. Klik 'Salin & Kirim ke WhatsApp' untuk membagikan ringkasan laporan ke grup WA Lurah/Camat.",
        "3. Sinkronisasi Otomatis: Laporan tersimpan di sistem monitoring Super Admin Kelurahan Mangga."
      ];
      s4.addText(pubItems.join('\n\n'), { x: 0.8, y: 1.5, w: 8.4, h: 3.5, fontSize: 13, color: '1E293B', lineSpacing: 22 });

      // Slide 5: Cetak PDF
      const s5 = pptx.addSlide();
      s5.addText('4. Riwayat & Cetak Dokumen PDF', { x: 0.8, y: 0.5, w: 8.4, h: 0.6, fontSize: 22, bold: true, color: '064E3B' });
      const pdfItems = [
        "• Menu Riwayat: Melihat seluruh laporan yang telah dikirim beserta foto dokumentasinya.",
        "• Fitur Cetak PDF: Klik 'Detail Laporan' -> 'Cetak / Preview'. Format otomatis rapi lengkap dengan Kop Surat Pemko Medan, Foto 2 Kolom, dan Tanda Tangan Resmi.",
        "• Edit Data: Kepling dapat mengedit atau memperbarui foto jika ada perbaikan."
      ];
      s5.addText(pdfItems.join('\n\n'), { x: 0.8, y: 1.5, w: 8.4, h: 3.5, fontSize: 13, color: '1E293B', lineSpacing: 22 });

      // Slide 6: PWA
      const s6 = pptx.addSlide();
      s6.addText('5. Pasang Aplikasi di HP (PWA)', { x: 0.8, y: 0.5, w: 8.4, h: 0.6, fontSize: 22, bold: true, color: '064E3B' });
      const pwaItems = [
        "Aplikasi tidak perlu didownload dari Play Store / App Store, cukup pasang Pintasan PWA:",
        "• Android (Chrome): Klik titik tiga (⋮) -> Pilih 'Tambahkan ke Layar Utama'.",
        "• iPhone (Safari): Klik tombol Share (kotak panah) -> Pilih 'Tambah ke Layar Utama'.",
        "• Hasilnya aplikasi akan memiliki ikon tersendiri di layar HP seperti aplikasi biasa!"
      ];
      s6.addText(pwaItems.join('\n\n'), { x: 0.8, y: 1.4, w: 8.4, h: 3.5, fontSize: 13, color: '1E293B', lineSpacing: 20 });

      // Slide 7: Closing
      const s7 = pptx.addSlide();
      s7.background = { color: '064E3B' };
      s7.addText('Terima Kasih', { x: 0.8, y: 1.8, w: 8.4, h: 0.8, fontSize: 32, bold: true, color: 'FFFFFF', align: 'center' });
      s7.addText('"Satu Laporan Nyata untuk Pelayanan Masyarakat Kelurahan Mangga"', { x: 0.8, y: 2.8, w: 8.4, h: 0.6, fontSize: 16, italic: true, color: 'A7F3D0', align: 'center' });
      s7.addText('#MedanUntukSemua  •  #SemuaUntukMedan', { x: 0.8, y: 4.2, w: 8.4, h: 0.4, fontSize: 13, bold: true, color: 'ECFDF5', align: 'center' });

      // Download file
      await pptx.writeFile({ fileName: 'Panduan_Penggunaan_SI_KEPLING_MANGGA.pptx' });
    } catch (err) {
      console.error('Error generating PPTX:', err);
      alert('Gagal mendownload PPTX. Silakan coba kembali.');
    } finally {
      setIsGenerating(false);
    }
  };

  const slide = slidesData[currentSlide];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Presentation className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base tracking-wide">Slide Presentasi (PPT) Kepling</h3>
              <p className="text-[11px] text-slate-400">Panduan Operasional SI KEPLING MANGGA</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPPT}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
              title="Download File PPTX (.pptx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGenerating ? 'Menyiapkan...' : 'Download PPTX'}</span>
            </button>

            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slide Viewer Screen */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100 flex flex-col justify-center">
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col min-h-[340px]">
            
            {/* Top Bar of Slide */}
            <div className={`bg-gradient-to-r ${slide.color} px-6 py-4 text-white flex justify-between items-center`}>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200 bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  {slide.category}
                </span>
                <h2 className="text-xl font-black mt-1 leading-tight">{slide.title}</h2>
                <p className="text-xs text-slate-200 opacity-90">{slide.subtitle}</p>
              </div>
              <span className="text-2xl font-black text-white/30 tracking-tighter">
                0{currentSlide + 1}
              </span>
            </div>

            {/* Slide Main Content */}
            <div className="p-6 flex-1 flex flex-col justify-center">
              {slide.content}
            </div>

          </div>
        </div>

        {/* Footer Slide Controls */}
        <div className="bg-white px-5 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
              disabled={currentSlide === 0}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-slate-600 px-2">
              Slide {currentSlide + 1} dari {slidesData.length}
            </span>
            <button
              onClick={() => setCurrentSlide((prev) => Math.min(slidesData.length - 1, prev + 1))}
              disabled={currentSlide === slidesData.length - 1}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPPT}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Unduh PowerPoint (.pptx)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
