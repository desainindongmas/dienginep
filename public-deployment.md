# Deploy FPRS ke Cloudflare Pages

## GitHub
Repository: https://github.com/desainindongmas/dienginep
Branch: main

## Cloudflare Pages
1. Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git.
2. Pilih repository `desainindongmas/dienginep`.
3. Framework preset: None; Build command: `npm run build`; Build output directory: `dist`; Root directory kosong.
4. Tunggu deploy dan cek URL `*.pages.dev` terlebih dahulu.
5. Settings → Variables and Secrets (production): tambahkan `SUPABASE_URL=https://ovwjrqcjwrsnsvsogjco.supabase.co` (plaintext), `SUPABASE_SECRET_KEY` (secret), `REGISTRATION_ENABLED=false`, `LEGAL_DOCS_APPROVED=false`, `TURNSTILE_SITE_KEY` (public site key), `TURNSTILE_SECRET_KEY` (secret). **Jangan masukkan key rahasia di variabel VITE_ atau repository.**
6. Tambahkan custom domain `mitra.dienginep.my.id` pada proyek Pages.

## DNS
- Bila `dienginep.my.id` sudah menggunakan nameserver Cloudflare, Pages biasanya menawarkan pembuatan record `mitra` otomatis.
- Jika DNS dikelola di provider lain, tambahkan **CNAME** `mitra` → subdomain `<nama-proyek>.pages.dev` yang benar dari dashboard Cloudflare. Jangan menebak target ini.
- Pastikan nama domain di Pages statusnya Active dan HTTPS aktif.

## Go-live gate
Pendaftaran tidak dibuka sebelum:
- Halaman ketentuan dan privasi final untuk menerima data nyata (termasuk alamat lengkap, prosedur penghapusan, dasar pemrosesan dan pemeriksaan hukum);
- Turnstile lulus tes server, endpoint terhubung, dan migrasi/RLS diperiksa;
- Kontak resmi diuji;
- Simulasi kirim formulir → kode terbit → tersimpan di database, termasuk tes kegagalan dan idempotency;
- Penanganan operator, kontrol admin, dan SOP privasi siap.

Jangan aktifkan `REGISTRATION_ENABLED=true` maupun `LEGAL_DOCS_APPROVED=true` sampai seluruh gate lulus.
