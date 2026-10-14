# Implementation Plan - Sensitive Data Encryption Utilities

## User Goal
Implement lightweight encryption/decryption functions (Base64 + XOR key obfuscation) for sensitive data fields (such as NIK, passwords, or personal credentials) in `firestoreService.ts` before saving to Firestore, and decrypt them when read in admin dashboards.

---

## Proposed Changes

### 1. Update `src/lib/firestoreService.ts`
- Add helper functions `encryptSensitiveData(text: string): string` and `decryptSensitiveData(encoded: string): string`.
- Apply encryption to sensitive fields during document writes and decryption upon retrieval.

---

## Verification Plan
- Compile app using `compile_applet`.
