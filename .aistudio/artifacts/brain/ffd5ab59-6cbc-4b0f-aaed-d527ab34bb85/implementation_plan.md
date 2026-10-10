# Implementation Plan: Data Access Restrictions and Custom Photo Download

## 1. Restrict Data Access for All Reports
I will update the data fetching logic across the application to ensure that Kepling accounts only see data (kunjungan, absensi, reports) belonging to their specific `lingkunganNomor`.

- **Scope**: All report-based components and services (Kunjungan, Absensi, Laporan Harian, etc.).
- **Mechanism**:
    - Update `src/lib/kunjunganService.ts`, `src/lib/attendanceService.ts` (if exists, or relevant files), and general report fetching functions to filter by `lingkunganNomor` when `activeAccount` role is `kepling`.
    - Modify `src/hooks/useFeatureNotifications.ts` to ensure notifications/alerts respect this restriction.
    - Audit existing API calls (if any) to enforce server-side-like filtering client-side based on the current user role.

## 2. Implement Custom Photo Download Naming
I will update the download logic to rename photo files using the requested format: `Lingkungan_NamaWarga_Tanggal.jpg/png`.

- **Scope**: Kunjungan Warga and other reports with documentation photos.
- **Mechanism**:
    - Modify the photo download function (likely in a service file like `src/lib/driveSync.ts` or a new utility in `src/utils/download.ts`).
    - Construct the filename dynamically using the metadata: `Lingkungan${data.lingkunganNomor}_${data.namaWarga}_${data.tanggal}`.
    - Implement a mechanism to trigger individual file downloads with the custom filename.

## 3. Verification
- Validate that Super Admin can still see all data.
- Validate that a Kepling can ONLY see their own data.
- Verify that downloaded files have the correct, formatted names.
