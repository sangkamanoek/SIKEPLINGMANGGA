# Panduan Menghubungkan Repositori ke Vercel

## Mengapa Belum Terdeploy Otomatis ke Vercel?
Lingkungan saat ini berjalan di dalam **AI Studio Preview Container (Google Cloud Run)**. Vercel adalah platform pihak ketiga yang terpisah, sehingga Vercel tidak dapat mendeteksi perubahan kode atau melakukan *build* secara otomatis kecuali **repositori GitHub Anda telah dihubungkan langsung ke dasbor Vercel**.

## Langkah-Langkah Menghubungkan ke Vercel:
1. **Buka Vercel Dashboard** (https://vercel.com) dan masuk dengan akun Anda.
2. Klik tombol **"Add New..."** -> **"Project"**.
3. Pilih repositori GitHub Anda yang berisi kode aplikasi ini.
4. Pada pengaturan *Build & Development Settings*:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Klik **Deploy**. Vercel akan otomatis melakukan build dan menyediakan URL publik untuk aplikasi Anda.
