# PO Customer

PO masuk dari customer ke PT. Arsko Sukses Bersama. Satu proyek menyimpan satu PO langsung pada baris `Project`, sehingga tidak ada PO tambahan atau perhitungan ganda.

## Penggunaan

1. Buat proyek di Projects bila belum ada.
2. Buka PO Customer, cari proyek, lalu pilih Lengkapi / update PO.
3. Isi nomor PO, customer, tanggal, pekerjaan, nilai sebelum PPN, nominal PPN sesuai dokumen, target delivery, status, dan catatan.
4. Simpan PO Customer. Unggah PDF atau foto PO melalui Dokumen PO.
5. Riwayat update menampilkan 10 perubahan terakhir beserta nilai sebelum/sesudah. Riwayat lengkap tetap disimpan di AuditLog.

Hanya ADMIN dapat mengubah data dan mengunggah dokumen PO. Pengguna lain hanya dapat membaca PO dari proyek yang dapat mereka akses. Dokumen tetap privat dan diunduh melalui endpoint terautentikasi.

## Nilai dan status

- `Project.poValue` tetap satu-satunya sumber nilai PO dashboard, Finance, dan laporan. Update mengganti nilai, bukan menjumlahkannya.
- Nilai sebelum PPN digunakan untuk margin; PPN terpisah dan total termasuk PPN hanya ditampilkan di menu PO.
- Nilai historis tidak diubah otomatis. Admin perlu memastikan nilai awal belum termasuk PPN saat melengkapi PO lama.
- Setelah nomor PO tercatat, Projects dan Finance menolak perubahan nilai PO di luar menu PO Customer. Nama customer juga dikelola di menu PO.
- Target delivery PO terpisah dari target selesai proyek.
- Status PO tidak otomatis mengubah status proyek. Pembatalan PO tidak otomatis menghapus nilai kontrak; lakukan koreksi nilai secara eksplisit dengan catatan dan kelola status proyek sesuai kondisi sebenarnya.
- Ringkasan nilai/PPN menghitung proyek ACTIVE, sama dengan cakupan nilai portfolio aktif; jumlah PO tercatat/belum lengkap mencakup semua proyek yang terlihat.

## Deployment dan pengujian

Terapkan migrasi `20260930144403_customer_po` dengan workflow Prisma sebelum menerbitkan versi aplikasi baru. Migrasi hanya menambah kolom dan constraint pada Project; tidak menyalin, menghapus, atau mengubah nilai lama, serta tidak mengubah RLS maupun izin database.

`node --test tests/*.test.ts` memeriksa validasi dan migrasi. `node scripts/smoke-http.ts` setelah production build menguji create/update PO, penolakan versi lama, nilai laporan tanpa double counting/PPN, riwayat, hak akses, dan perlindungan baseline Finance menggunakan database lokal in-memory, tanpa menulis data production.
