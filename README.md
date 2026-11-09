# DiengInep — Founding Partner Registration System

## Status per 9 November 2026

- Website pendaftaran publik dan halaman informasi: **sudah masuk repository, siap dihubungkan ke Cloudflare Pages untuk preview**.
- Database awal project Supabase `dienginep`: **migrasi diterapkan dan uji RPC berhasil dalam transaksi rollback**.
- RLS diaktifkan; akses `anon` dan `authenticated` ke tabel sensitif dicabut.
- Cloudflare deployment, secret, domain, Turnstile: **belum dikonfigurasi**.
- Dashboard admin, alur seleksi, reservasi slot, pembayaran manual dan aktivasi: **belum siap produksi**, merupakan fase berikutnya.
- Penerimaan pendaftaran real: **nonaktif sampai launch gate lolos**.

## Business baseline
14 homestay lokal; 2 jeep, 2 oleh-oleh, 1 agrowisata, 1 pemandu lokal. Registrasi gratis → pemeriksaan → verifikasi → persetujuan → perjanjian → homestay transfer manual Rp125.000 → verifikasi pembayaran → aktivasi. Mitra wisata pilot Rp0, komisi 0%.

## Cloudflare Pages (Git)

| Parameter | Nilai |
|---|---|
| Repository | `desainindongmas/dienginep` |
| Branch | `main` |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | / (root repo) |
| Intended custom domain | `mitra.dienginep.my.id` |

Build output hanya memuat berkas dari `site/`. Folder `functions/` otomatis terdeteksi untuk Pages Functions ketika deploy dengan Git integration.

### Environment variables dan secrets

- `SUPABASE_URL=https://ovwjrqcjwrsnsvsogjco.supabase.co` (plaintext)
- `SUPABASE_SECRET_KEY` (**secret**, server only)
- `REGISTRATION_ENABLED=false` (plaintext)
- `LEGAL_DOCS_APPROVED=false` (plaintext)
- `TURNSTILE_SITE_KEY` (public site key)
- `TURNSTILE_SECRET_KEY` (**secret**)

Never commit credentials, payment account numbers, KTP, applicant records or access tokens. Never expose the secret key to browser code. Registration remains closed by design until config and compliance checks pass.

See [public-deployment.md](public-deployment.md) for full DNS, Pages, and go-live instructions.
