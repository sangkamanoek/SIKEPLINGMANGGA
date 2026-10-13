# Implementation Plan - Dynamic PBB Progress Bar Colors

## User Goal
Update the PBB progress bar and indicator colors in `RekapPbbView.tsx` (and related dashboard cards) based on achievement thresholds:
- **< 50%**: Merah (Red) — Kategori rendah / perlu perhatian khusus
- **51% - 74%**: Kuning (Yellow) — Kategori sedang / dalam proses
- **>= 75%**: Hijau (Green) — Kategori baik / hampir atau sudah mencapai target

---

## Proposed Changes

### 1. Update `RekapPbbView.tsx` & Dashboard Cards
- Add a helper function `getPbbProgressColor(pct: number)`:
  - `if (pct < 50) return 'bg-rose-500 text-rose-600';`
  - `if (pct < 75) return 'bg-amber-500 text-amber-600';`
  - `return 'bg-emerald-500 text-emerald-600';`
- Apply this dynamic color to the progress bar and status indicator dot.

---

## Verification Plan
- Compile app using `compile_applet`.
