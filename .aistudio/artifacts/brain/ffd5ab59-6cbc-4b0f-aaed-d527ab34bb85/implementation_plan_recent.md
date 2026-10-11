# Implementation Plan: PKK Save Fix, Kepling Push Notifications, PKK Update Info, and High-Res Exports

## 1. Fix PKK Save Bug
- Update `savePkkKegiatan` in `src/lib/pkkKegiatanService.ts` to include a payload size fallback (slicing base64 photos if Firestore payload is too large) and proper error propagation/toasts so users aren't left with silent failures.

## 2. Browser Push Notifications for Kepling (07:30 WIB)
- Implement a notification scheduler/checker hook (`useKeplingNotificationScheduler.ts`) that runs when a Kepling account is active.
- Every minute, check if the current time in WIB is `07:30`.
- If so, check if a notification has already been sent today (via localStorage).
- Request notification permission if needed and trigger `showSafeNotification("Pengingat Laporan Harian", { body: "Halo Kepling, silakan isi laporan kinerja harian Anda hari ini.", icon: "/logo.png" })`.

## 3. PKK Update Info
- Add a dedicated PKK Update banner or section in `PkkHubDashboard.tsx` or `PkkBukuAdministrasiView.tsx` informing users about the latest PKK system updates.

## 4. High-Res Photos for All Downloads / Excel Exports
- Ensure all photo export and download functions (e.g., `downloadImage`, Excel exports with images, ZIP packages) call `getHighResImageUrl` to guarantee high resolution.
