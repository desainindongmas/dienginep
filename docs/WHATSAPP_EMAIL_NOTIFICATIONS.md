# FPRS — WhatsApp dan Notifikasi Email Pendaftaran

## Alur setelah kirim
1. Form diterima oleh Cloudflare Pages Function `POST /api/public/applications`.
2. Data pendaftar tersimpan di Supabase. Kode `DI-FP-...` dihasilkan server.
3. Trigger database mencatat notifikasi ke `application_email_outbox` dalam transaksi yang sama.
4. Jika layanan email sudah dikonfigurasi, Cloudflare Function mengirim ringkasan lengkap ke `admin3@desainindongmas.my.id` melalui Resend dan memperbarui status outbox.
5. Browser otomatis diarahkan ke `wa.me/6285952839393` dengan pesan konfirmasi yang sudah memuat kode, identitas, dan informasi detail sesuai kategori. **Pengguna tetap perlu menekan Send di WhatsApp**; browser tidak dapat mengirim pesan WhatsApp atas nama pengguna tanpa tindakan mereka.
6. Jika WhatsApp gagal terbuka, halaman menampilkan tautan untuk membuka secara manual. Jika email gagal, pendaftaran tetap berhasil dan entri outbox berstatus `failed` untuk penanganan ulang oleh admin. Tidak ada pengiriman massal tanpa kontrol.

## Persiapan email (wajib sebelum mengharapkan email otomatis)
1. Buat akun [Resend](https://resend.com), lalu verifikasi domain pengirim yang dikelola (contoh `dienginep.my.id`). Ikuti record DNS SPF/DKIM yang disediakan Resend dan tunggu status **Verified**.
2. Di Resend → API Keys buat API key dengan hak kirim email.
3. Cloudflare → Workers & Pages → proyek website → Settings → Variables and Secrets → Production:
   - `RESEND_API_KEY` : **Secret**, jangan di repository/frontend.
   - `EMAIL_FROM` : alamat pengirim dengan domain **sudah terverifikasi**, contoh `DiengInep <notifikasi@dienginep.my.id>` jika alamat/domain tersebut telah diverifikasi.
   - `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` dan launch gates tetap seperti sebelumnya.
4. Redeploy production.
5. Kirim satu pendaftaran dummy, cek inbox/spam `admin3@desainindongmas.my.id`, cek `application_email_outbox` di Supabase. Jika status failed, periksa Resend dashboard (domain verification, API key, quota, sender).
6. Jangan klaim email berfungsi sampai tes pengiriman ke inbox nyata berhasil.

## Peringatan
- Email berisi data calon mitra; jangan CC alamat yang tidak berwenang, jangan menyimpan API key atau data pendaftar di GitHub.
- WhatsApp adalah pesan yang sudah terisi otomatis, tetapi pengiriman pesan tetap dikonfirmasi calon mitra.
- Kontribusi homestay tetap hanya diminta setelah verifikasi dan persetujuan; pendaftaran awal gratis.
