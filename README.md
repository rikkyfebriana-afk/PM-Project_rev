# Project Control Center

Dashboard operasional untuk memonitor portfolio project, BoQ, material, production, FAT, delivery, site work, finance, milestone, action item, dan dokumen proyek.

## Arsitektur

- Next.js 16 App Router + TypeScript
- Tailwind CSS 4 dan komponen UI internal
- PostgreSQL (direkomendasikan Supabase)
- Prisma ORM dengan PostgreSQL driver adapter
- Username/password login, bcrypt hash, server-side session, secure HTTP-only cookie
- Supabase Storage private bucket dengan signed direct-upload untuk BoQ, PDF, foto progress, FAT, DO, dan BAST
- Leaflet + OpenStreetMap untuk peta lokasi proyek
- Vercel untuk preview dan production deployment

## Menjalankan secara lokal

Persyaratan: Node.js 22 dan pnpm.

1. Salin `.env.example` menjadi `.env`.
2. Isi `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, dan konfigurasi Supabase.
3. Buat atau kunci bucket private sesuai batas MIME/ukuran dari `.env`:

   ```bash
   pnpm storage:configure
   ```
4. Instal dependency dan siapkan database:

   ```bash
   pnpm install
   pnpm db:generate
   pnpm db:deploy
   pnpm db:seed
   ```

5. Jalankan aplikasi:

   ```bash
   pnpm dev
   ```

Untuk melihat UI tanpa database pada mesin development, set `DEMO_MODE="true"`. Flag ini sengaja diabaikan saat `NODE_ENV=production`.

## Database dan akses

Schema berada di `prisma/schema.prisma`. Fondasi akses menyediakan tiga role:

- `ADMIN`: seluruh project dan pengaturan sistem.
- `PROJECT_MANAGER`: project yang dikelola atau project tempat ia menjadi anggota.
- `VIEWER`: hanya project tempat ia menjadi anggota.

Nilai uang dan kuantitas menggunakan tipe `Decimal`, bukan floating point. Dokumen tersimpan sebagai object private; database hanya menyimpan metadata dan object key. Endpoint download menghasilkan signed URL berumur 60 detik setelah otorisasi project diperiksa.

Upload memakai alur dua fase agar file besar tidak melewati batas body Vercel Function:

1. Client mengirim metadata kecil ke `POST /api/documents/upload` dan menerima signed upload URL.
2. Client mengunggah file langsung ke Supabase Storage menggunakan URL/token tersebut.
3. Client memanggil `POST /api/documents/{id}/complete`.
4. Server memverifikasi ukuran dan MIME object sebelum mengubah status dokumen menjadi `READY`.

## Deployment GitHub → Vercel

1. Push repository ini ke repository GitHub private.
2. Import repository tersebut di Vercel sebagai project Next.js.
3. Tambahkan seluruh variable dari `.env.example` pada Vercel Environment Variables. Jangan tambahkan `DEMO_MODE=true` ke production.
4. Gunakan pooled connection string Supabase dengan `sslmode=require` untuk `DATABASE_URL` dan direct connection string ber-SSL untuk `DIRECT_URL`.
5. Jalankan migrasi database secara terkontrol sebelum production release:

   ```bash
   pnpm db:deploy
   ```

6. Deploy. Build command default sudah menjalankan `prisma generate` lalu `next build`.

Branch yang disarankan:

- `main`: production dan protected branch.
- `development`: integration/preview.
- `codex/*`: perubahan terisolasi sebelum pull request.

## Security checklist

- `.env` dan service role key tidak pernah masuk Git; hanya `.env.example` yang disimpan.
- Password di-hash dengan bcrypt cost 12 dan tidak pernah disimpan dalam bentuk plaintext.
- Session token dibuat secara acak, hanya hash token yang disimpan di database.
- Cookie production menggunakan `HttpOnly`, `Secure`, `SameSite=Lax`, dan prefix `__Host-`.
- Akun dikunci sementara setelah lima kegagalan login beruntun.
- Route workspace memverifikasi session di server; proxy hanya menjadi pemeriksaan awal.
- Bucket dokumen wajib private dan service role key hanya boleh digunakan di server.
- Upload tidak melewati Function Vercel, dibatasi tipe dan ukuran, diberi nama object acak, diverifikasi setelah tersimpan, dicatat dalam audit log, serta diperiksa berdasarkan akses project.
- Production sebaiknya mengaktifkan branch protection, Vercel deployment protection untuk preview sensitif, backup database, dan key rotation berkala.

## Perintah utama

```bash
pnpm dev          # development server
pnpm lint         # ESLint
pnpm build        # Prisma generate + production build
pnpm db:generate  # regenerate Prisma client
pnpm db:migrate   # create/apply a new development migration after schema changes
pnpm db:deploy    # apply committed migrations in target environment
pnpm db:seed      # create/update the initial admin
pnpm storage:configure # create/update the private Supabase bucket policy
```
