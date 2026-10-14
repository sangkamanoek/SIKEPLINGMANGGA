# Implementation Plan - Sever Perlinsos Synthesis from Kunjungan Warga

## User Goal
The user requested to completely remove the consolidation function (`consolidateKunjunganWithReports`) so that "Kunjungan Warga" (Citizen Visits) and "Pendataan Perlinsos" (Social Protection Data in Daily Reports) are completely separated and independent.

---

## Proposed Changes

### 1. Update `src/lib/kunjunganService.ts`
- Remove or disable `consolidateKunjunganWithReports` (return raw kunjungan list without merging daily reports).

### 2. Update `src/components/KunjunganHarianView.tsx`
- Ensure `KunjunganHarianView` only reads independent `kunjungan_warga` records from `subscribeKunjunganWarga` without calling `consolidateKunjunganWithReports`.

### 3. Update `src/components/RangkumanLaporanKelurahan.tsx`
- Ensure `RangkumanLaporanKelurahan` does not call `consolidateKunjunganWithReports`.

---

## Verification Plan
- Compile applet using `compile_applet`.
- Verify that Kunjungan Warga table only displays entries created directly in the Kunjungan Warga form, and Perlinsos reports no longer appear as synthesized kunjungan entries.
