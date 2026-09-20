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
   Gunakan `APP_TIME_ZONE="Asia/Jakarta"` agar overdue dan milestone mengikuti hari kerja WIB.
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

Mode demo bersifat read-only. Tombol dan form dapat dipreview, tetapi server menolak seluruh mutation agar user demo palsu tidak pernah dipakai sebagai foreign key database.

## Project register

Halaman `/projects` sudah memakai query PostgreSQL nyata dengan fallback demo lokal. Fitur yang tersedia:

- pencarian dan filter health, status, serta phase;
- tampilan table desktop dan card mobile;
- export CSV yang dilindungi dari formula injection;
- create dan edit melalui Server Actions tervalidasi Zod;
- nilai uang berbasis `Decimal(18,2)`, validasi jadwal, koordinat berpasangan, dan closed-state invariant;
- optimistic locking menggunakan `updatedAt` untuk mencegah lost update;
- soft archive dan audit log dalam transaksi yang sama;
- Dashboard membaca portfolio, finance, milestone, alert, material readiness, dan marker map dari scope project yang sama.

## BoQ import dan approval baseline

Halaman `/boq` menyediakan [template Excel](public/templates/boq-import-template.xlsx), preview validasi, riwayat revisi per project, dan approval baseline. Alurnya:

1. Pilih project, lalu unggah file `.xlsx` atau `.csv` (maksimum 5 MB dan 1.000 item). File dibaca di browser untuk memilih sheet, memetakan kolom, dan menampilkan error per baris sebelum dikirim.
2. Saat import dikonfirmasi, file asli diunggah langsung ke bucket private Supabase melalui signed URL. Server mengunduh dokumen berstatus `READY`, membaca sheet terpilih, lalu memvalidasi ulang data sebelum menyimpan revisi `DRAFT`. Data preview dari browser tidak dipercaya sebagai sumber akhir.
3. Import identik pada project yang sama dideteksi dari hash isi BoQ dan tidak membuat revisi duplikat. Revisi Draft sebelumnya menjadi `SUPERSEDED`; baseline `APPROVED` yang sedang berlaku tidak berubah sampai ada approval baru.
4. Hanya `ADMIN` yang dapat menyetujui Draft. Approval menjadikan revisi tersebut baseline `APPROVED`, menggantikan baseline lama, dan menyinkronkan item bertipe `MATERIAL` ke Material Register dalam satu transaksi.

Kolom wajib: `Item No`, `Item Type`, `Description`, `Unit`, `Quantity`, dan `Unit Price`. `Item Code` wajib dan unik untuk item `MATERIAL`; `Item Type` harus `MATERIAL`, `SERVICE`, atau `OTHER`. `Quantity` harus positif (maksimum empat desimal), sedangkan `Unit Price` non-negatif (maksimum dua desimal). Header boleh berada dalam 30 baris pertama. Formula pada kolom input, baris/kolom tersembunyi, dan merged cell pada area data ditolak. `Line Total` dihitung ulang oleh server dari kuantitas dan harga satuan, bukan dipercaya dari file.

`ADMIN` dapat mengimpor ke seluruh project; `PROJECT_MANAGER` hanya ke project yang resmi dikelolanya; `VIEWER` hanya dapat membaca. Mode demo mengizinkan preview tetapi tidak menyimpan file, revisi, atau approval. File sumber BoQ mengikuti otorisasi dokumen project dan tidak dibuka sebagai URL publik.

## Material Register

Halaman `/materials` menampilkan kebutuhan material dari baseline BoQ yang telah disetujui, kuantitas ordered/received/installed, supplier, nomor PO, tanggal kebutuhan/ETA, status, dan indikator shortage/late ETA. Admin dan Project Manager resmi dapat memperbarui progress material pada project yang berhak mereka edit; Viewer hanya membaca. Perubahan memakai validasi server, optimistic locking, dan audit log.

Saat baseline baru disetujui, material dicocokkan berdasarkan kode yang dinormalisasi. Kebutuhan, deskripsi, satuan, dan tautan BoQ diperbarui; data operasional seperti supplier, PO, dan pergerakan kuantitas yang sudah tercatat dipertahankan. Item yang hilang dari baseline baru dinonaktifkan, bukan dihapus. Approval ditolak bila satuan material yang sudah bergerak berubah atau kebutuhan baru lebih kecil daripada kuantitas yang sudah diterima/terpasang; rekonsiliasi harus dilakukan terlebih dahulu.

Jika revisi baseline menaikkan kebutuhan, status `RECEIVED`/`INSTALLED` otomatis kembali ke `PARTIAL` bila kuantitas sebelumnya tidak lagi memenuhi kebutuhan. Pengguna juga dapat menandai `SHORTAGE` secara eksplisit ketika received quantity masih di bawah kebutuhan.

## Database dan akses

Schema berada di `prisma/schema.prisma`. Fondasi akses menyediakan tiga role:

- `ADMIN`: seluruh project dan pengaturan sistem.
- `PROJECT_MANAGER`: dapat membaca project yang dikelola atau diikuti, tetapi hanya dapat mengubah operational control pada project yang resmi dikelolanya.
- `VIEWER`: hanya project tempat ia menjadi anggota.

Hanya `ADMIN` yang dapat membuat project, mengubah master/finance/assignment, dan mengarsipkan project. Upload dokumen hanya tersedia untuk Admin atau Project Manager resmi; Viewer tetap read-only.

Assignment `projectManagerId` dan `ProjectMember` sengaja dipisahkan. Mengganti manager langsung mencabut akses yang berasal dari assignment lama; akses tim yang eksplisit tetap dikelola melalui membership tersendiri.

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

Migrasi `20260914000100_boq_import_metadata` menambahkan metadata sumber/approval BoQ, tipe item, serta constraint dan index Material Register. Jalankan `pnpm db:deploy` terhadap database target **sebelum** merilis kode yang menggunakan skema baru. Untuk upload BoQ, pastikan `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, dan `MAX_UPLOAD_BYTES` terisi. Jalankan `pnpm storage:configure` terhadap project Supabase target; bucket harus tetap private. Batas bucket boleh lebih besar untuk dokumen umum, tetapi import BoQ tetap dibatasi 5 MB oleh aplikasi.

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
- Server memvalidasi ulang file BoQ private yang telah terunggah; preview browser saja tidak dapat membuat baseline atau mengubah material.
- Production sebaiknya mengaktifkan branch protection, Vercel deployment protection untuk preview sensitif, backup database, dan key rotation berkala.

## Batasan tahap ini

- Import BoQ menerima `.xlsx` dan `.csv`; format Excel lama `.xls`, macro-enabled `.xlsm`, dan workbook berpassword belum didukung.
- Preview menampilkan maksimum 100 item sekaligus, tetapi seluruh item dalam batas 1.000 baris tetap divalidasi.
- Riwayat BoQ pada halaman menampilkan seluruh baseline aktif serta 100 revisi `SUPERSEDED` terbaru di portofolio; penghitung total revisi tetap mencakup seluruh data.
- Rekonsiliasi material yang berkonflik masih harus ditangani melalui data sumber/operasional sebelum baseline baru dapat disetujui; belum ada workflow otomatis untuk menyatukan kode material yang berubah.
- Modul production, FAT, delivery, site work, finance report, serta PDF/Excel report lanjutan belum menjadi bagian dari alur BoQ ini.

## Perintah utama

```bash
pnpm dev          # development server
pnpm lint         # ESLint
pnpm test         # project validation tests
pnpm build        # Prisma generate + production build
pnpm db:generate  # regenerate Prisma client
pnpm db:migrate   # create/apply a new development migration after schema changes
pnpm db:deploy    # apply committed migrations in target environment
pnpm db:seed      # create/update the initial admin
pnpm storage:configure # create/update the private Supabase bucket policy
```
