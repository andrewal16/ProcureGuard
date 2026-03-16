# AGENTS.md

## Product and delivery rules
- Semua implementasi harus mengikuti PRD di `docs/prd-phase1.md`.
- Scope saat ini hanya Phase 1. Jangan kerjakan Phase 2/3 kecuali diminta eksplisit.
- Jangan mengubah arsitektur besar kalau tidak diperlukan untuk memenuhi Phase 1.

## Engineering rules
- Reuse komponen dan pola yang sudah ada di codebase.
- Jangan tambah dependency baru kecuali benar-benar perlu.
- Setelah perubahan, jalankan lint dan test yang relevan.
- Kalau ada requirement yang ambigu, pilih solusi paling kecil yang memenuhi acceptance criteria.

## Output rules
- Fokus ke implementasi end-to-end untuk requirement yang aktif.
- Tambahkan/ubah test untuk flow utama.
- Jelaskan file apa saja yang diubah dan kenapa.
