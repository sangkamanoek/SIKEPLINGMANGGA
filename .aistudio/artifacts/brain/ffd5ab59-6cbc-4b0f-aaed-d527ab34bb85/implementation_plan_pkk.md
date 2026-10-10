# Implementation Plan: PKK Membership Card Generator

## 1. Data Model Update
- Add `pasphotoUrl` field to `PkkBuku1Anggota` interface in `src/lib/pkkBukuService.ts`.

## 2. Membership Management UI Update
- Update `PkkBukuAdministrasiView.tsx` (Buku 1 Form) to:
    - Include a file upload field for pasphoto.
    - Implement pasphoto upload to Firestore/Cloud Storage.
    - Add a "Cetak Kartu" button for each member.

## 3. Card Generator Implementation
- Create a new component or utility: `src/utils/pkkCardGenerator.ts` (using `jsPDF` for PDF generation, or a custom component rendered to canvas for image generation).
- Design the card layout with a KTP-like aesthetic (ID number, Name, Lingkungan, Pasphoto, etc.).

## 4. Workflow
1. User enters data and uploads photo.
2. System saves data and photo URL to Firestore.
3. System triggers card generation (PDF or high-res image download) when the "Cetak Kartu" button is clicked.
