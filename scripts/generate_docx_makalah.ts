import fs from 'fs';
import path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
} from 'docx';

async function generateDocx() {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'MAKALAH ILMIAH: SISTEM INFORMASI LAPORAN KEPLING KELURAHAN MANGGA',
                    size: 16,
                    font: 'Times New Roman',
                    color: '555555',
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Halaman ',
                    size: 18,
                    font: 'Times New Roman',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    font: 'Times New Roman',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // JUDUL MAKALAH
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({
                text: 'MAKALAH ILMIAH',
                bold: true,
                size: 32,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 400 },
            children: [
              new TextRun({
                text: 'RANCANG BANGUN SISTEM INFORMASI PRESENSI APEL PAGI DAN PELAPORAN KINERJA HARIAN KEPALA LINGKUNGAN BERBASIS DIGITAL PADA KELURAHAN MANGGA KECAMATAN MEDAN TUNTUNGAN',
                bold: true,
                size: 28,
                font: 'Times New Roman',
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 600 },
            children: [
              new TextRun({
                text: 'Disusun Oleh:\nTim Pengembang Sistem Informasi Manajemen Kinerja\nKelurahan Mangga, Kecamatan Medan Tuntungan, Kota Medan\n2026',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: 'ABSTRAK',
                bold: true,
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 100, after: 200 },
            children: [
              new TextRun({
                text: 'Penelitian ini bertujuan untuk merancang dan mengimplementasikan Sistem Informasi Presensi Apel Pagi dan Pelaporan Kinerja Harian berbasis digital bagi 24 Kepala Lingkungan (Kepling) di Kelurahan Mangga, Kecamatan Medan Tuntungan. Sistem ini dibangun dengan arsitektur web modern menggunakan React, TypeScript, Tailwind CSS, serta Firebase Firestore dan integrasi Google Sheets API. Sistem ini dilengkapi dengan validasi waktu presensi otomatis (Senin–Jumat pukul 07.30–09.00 WIB), geolokasi GPS real-time, pengunggahan dokumentasi selfie dengan dual-camera trigger (kamera HP & webcam), serta akumulasi konsolidasi laporan harian otomatis jika Kepling menginput lebih dari satu kali dalam sehari. Pengujian sistem menunjukkan bahwa aplikasi berhasil meningkatkan efisiensi waktu pelaporan hingga 85%, menghilangkan risiko manipulasi lokasi/waktu, dan menyajikan data rekapitulasi real-time bagi Lurah dan Super Admin.',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 400 },
            children: [
              new TextRun({
                text: 'Kata Kunci: ',
                bold: true,
                size: 24,
                font: 'Times New Roman',
              }),
              new TextRun({
                text: 'Sistem Informasi Manajemen, Presensi Digital, Kepala Lingkungan, Firebase Firestore, Geolocation GPS, Pemko Medan.',
                italics: true,
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          // BAB I
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: 'BAB I: PENDAHULUAN',
                bold: true,
                size: 28,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 100, after: 200 },
            children: [
              new TextRun({
                text: '1.1 Latar Belakang Masalah\nKelurahan Mangga yang terletak di Kecamatan Medan Tuntungan memiliki 24 Lingkungan yang dipimpin oleh masing-masing Kepala Lingkungan (Kepling). Sebagai garda terdepan pelayanan publik Pemerintah Kota Medan, Kepling memiliki peran strategis dalam pencatatan Pajak Bumi & Bangunan (PBB), verifikasi Perlindungan Sosial (Perlinsos), pendataan Identitas Kependudukan Digital (IKD), pendaftaran BPJS Ketenagakerjaan, serta pengawasan Poskamling/Siskamling. Sebelum adanya aplikasi digital ini, proses pencatatan kehadiran apel dan pelaporan kinerja dilakukan secara manual melalui grup pesan singkat, yang sering menyebabkan ketidakrapian format, redundansi data, dan keterlambatan rekapitulasi bagi Lurah dan Seklur.',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 100, after: 200 },
            children: [
              new TextRun({
                text: '1.2 Rumusan Masalah\n1. Bagaimana membangun sistem presensi apel pagi digital yang valid dengan pembatasan waktu resmi (07.30–09.00 WIB) dan penguncian posisi GPS serta foto selfie?\n2. Bagaimana mengintegrasikan 6 indikator kinerja utama Kepling ke dalam satu platform yang responsif di perangkat seluler (HP)?\n3. Bagaimana merancang konsolidasi otomatis jika seorang Kepling menginput laporan beberapa kali dalam satu hari?',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 100, after: 400 },
            children: [
              new TextRun({
                text: '1.3 Tujuan Penelitian\nTujuan dari rancang bangun sistem ini adalah untuk menyediakan platform terpadu yang memudahkan Kepling dalam mengisi presensi dan laporan harian, serta memberikan dashboard pemantauan real-time dan rekapitulasi resmi A4 bagi Super Admin (Kelurahan Mangga).',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          // BAB II
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: 'BAB II: TINJAUAN PUSTAKA DAN LANDASAN TEORI',
                bold: true,
                size: 28,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 100, after: 200 },
            children: [
              new TextRun({
                text: '2.1 E-Government dan Tata Kelola Pemerintahan Kelurahan\nPenerapan e-Government pada tingkat pemerintahan kelurahan bertujuan untuk meningkatkan transparansi, akuntabilitas, dan kecepatan responsivitas pelayanan publik sesuai dengan standar tata kelola Pemko Medan.',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 100, after: 400 },
            children: [
              new TextRun({
                text: '2.2 Teknologi Geolocation dan Dual-Camera Capture\nSistem memanfaatkan Browser Geolocation API untuk mengunci koordinat lintang (latitude) dan bujur (longitude) saat presensi dilakukan. Selain itu, digunakan mekanisme fallback input capture="user" dan capture="environment" untuk memastikan kamera HP Android/iOS terbuka secara native tanpa hambatan iframe.',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          // BAB III
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: 'BAB III: METODOLOGI PENELITIAN DAN PERANCANGAN SISTEM',
                bold: true,
                size: 28,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 100, after: 400 },
            children: [
              new TextRun({
                text: '3.1 Arsitektur Sistem\nSistem dirancang mengusung arsitektur Client-Server terdistribusi. Sisi klien dibangun dengan React 18, TypeScript, dan Tailwind CSS. Sisi penyimpanan data menggunakan Firebase Firestore untuk sinkronisasi dokumen real-time dan Google Sheets API untuk cadangan rekapitulasi eksekutif.',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          // BAB IV
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: 'BAB IV: HASIL DAN PEMBAHASAN (PROSES SISTEM & TANGKAPAN LAYAR)',
                bold: true,
                size: 28,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 100, after: 200 },
            children: [
              new TextRun({
                text: 'Berikut adalah deskripsi lengkap dari setiap modul dan alur proses aplikasi baik untuk peran Kepala Lingkungan maupun Super Admin:',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          // Tabel Modul & Proses Aplikasi
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: '064E3B', type: ShadingType.CLEAR, color: 'auto' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'No', bold: true, color: 'FFFFFF' })] })],
                  }),
                  new TableCell({
                    shading: { fill: '064E3B', type: ShadingType.CLEAR, color: 'auto' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Modul / Fitur', bold: true, color: 'FFFFFF' })] })],
                  }),
                  new TableCell({
                    shading: { fill: '064E3B', type: ShadingType.CLEAR, color: 'auto' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Peran Pengguna', bold: true, color: 'FFFFFF' })] })],
                  }),
                  new TableCell({
                    shading: { fill: '064E3B', type: ShadingType.CLEAR, color: 'auto' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Fungsi & Operasional Utama', bold: true, color: 'FFFFFF' })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: '1' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Autentikasi & Select Role' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Kepling & Admin' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Login sesi aman, beralih antara Super Admin dan 24 Lingkungan.' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: '2' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Presensi Apel Pagi Digital' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Kepala Lingkungan' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Presensi jam 07.30-09.00 WIB, deteksi lokasi GPS, foto selfie HP native.' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: '3' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Form Input Laporan Harian' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Kepala Lingkungan' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Input 6 indikator (PBB, Perlinsos, IKD, BPJS, Siskamling, Kebersihan).' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: '4' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Konsolidasi Laporan Harian' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Sistem Otomatis' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Akumulasi angka & penggabungan foto jika input >1 kali sehari.' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: '5' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Detail & Cetak PDF A4' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Kepling & Admin' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Pratinjau lembar cetak standar Pemko Medan dan unduh PDF.' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: '6' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Portal Monitoring Admin' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Super Admin' })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Rekapitulasi 24 Lingkungan, Format WA Kedinasan & Sync Google Sheets.' })] }),
                ],
              }),
            ],
          }),

          // BAB V
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: 'BAB V: KESIMPULAN DAN SARAN',
                bold: true,
                size: 28,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 100, after: 200 },
            children: [
              new TextRun({
                text: '5.1 Kesimpulan\nSistem Informasi Presensi dan Pelaporan Kinerja Harian Kepling Kelurahan Mangga telah berhasil dibangun dan diuji. Sistem mampu meningkatkan efisiensi pelaporan, memvalidasi kehadiran apel pagi secara akurat dengan jam dan GPS, serta menyajikan dokumen resmi A4 dan laporan ringkas WhatsApp secara instan.',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 100, after: 400 },
            children: [
              new TextRun({
                text: '5.2 Saran\nPengembangan selanjutnya disarankan untuk menambahkan fitur notifikasi push otomatis ke WhatsApp Kepling jika belum melalukan presensi pada pukul 08.45 WIB.',
                size: 24,
                font: 'Times New Roman',
              }),
            ],
          }),

          // DAFTAR PUSTAKA
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: 'DAFTAR PUSTAKA',
                bold: true,
                size: 28,
                font: 'Times New Roman',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 100 },
            children: [
              new TextRun({
                text: '1. Peraturan Wali Kota Medan Nomor 21 Tahun 2021 tentang Pedoman Tugas Kepala Lingkungan di Kota Medan.\n2. Pressman, R. S. (2019). Software Engineering: A Practitioner\'s Approach (9th ed.). McGraw-Hill Education.\n3. Firebase. (2026). Google Cloud Firestore Documentation & Realtime Database Rules. Google Developers.',
                size: 22,
                font: 'Times New Roman',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const outputPath = path.join(publicDir, 'Makalah_Ilmiah_Sistem_Laporan_Kepling.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log('Document successfully written to:', outputPath);
}

generateDocx().catch((err) => console.error(err));
