# Implementation Plan - Grant Kepling Access to Pembangunan & Rename

## Problem
Previously, the "Pembangunan" (Realisasi Pembangunan) menu was restricted exclusively to Super Admin accounts (`isAdmin`), making it invisible to Kepling accounts. The user wants Kepling to be able to access it and wants the name updated to **"MONITORING & REALISASI PEMBANGUNAN WILAYAH"**.

## Proposed Changes

### 1. Navigation & Access Guard Updates
- **`/src/components/TopNavigationBar.tsx`**:
  - Remove `isAdmin` check for `realisasi_pembangunan` so Kepling can see it.
  - Rename label from `'Pembangunan'` to `'MONITORING & REALISASI PEMBANGUNAN WILAYAH'`.
- **`/src/App.tsx`**:
  - Remove `'realisasi_pembangunan'` from `restrictedForKepling` array so Kepling can navigate to it.
- **`/src/components/SmartHubDashboard.tsx`**:
  - Remove `isAdmin` condition for the Pembangunan card so Kepling sees it on their Hub dashboard with the updated name.
- **`/src/components/RealisasiPembangunanView.tsx`**:
  - Ensure Kepling accounts can view and manage infrastructure reports for their assigned Lingkungan.

### 2. Verification
- Compile and build applet to ensure zero build errors.
