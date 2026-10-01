# Time Plan berbobot

Satu proyek memiliki pekerjaan rinci yang dikelompokkan menurut tahapan Planning, Engineering, Procurement, Production, FAT, Delivery, Installation, dan BAST. Tidak ada pekerjaan otomatis dibuat pada data produksi.

## Cara menggunakan

1. Pilih proyek di Time Plan, lalu Tambah rincian pekerjaan.
2. Isi nama, tahapan, PIC, bobot terhadap seluruh proyek, jadwal rencana, progres, tanggal aktual, dan catatan.
3. Pilih satu pendahulu bila diperlukan (finish-to-start tanpa lag; boleh mulai pada hari pendahulu selesai). Kosong berarti pekerjaan dapat berjalan paralel. Siklus dan pendahulu lintas proyek ditolak.
4. Alokasikan bobot seluruh pekerjaan hingga tepat 100%. Draft boleh di bawah 100%, tetapi tidak boleh di atas 100%. Gunakan maksimal dua desimal.
5. Administrator memeriksa perubahan progres yang ditampilkan, mencentang persetujuan, lalu mengaktifkan rencana. Progres proyek/dashboard/laporan kemudian mengikuti rincian pekerjaan.

Contoh: pekerjaan A berbobot 20% dengan progres 50% menyumbang 10% proyek. Pekerjaan B berbobot 80% dengan progres 25% menyumbang 20%. Progres proyek menjadi 30%.

Progres tahapan adalah rata-rata tertimbang pekerjaan dalam tahapan itu. Bobot tahapan adalah jumlah bobot pekerjaan tersebut terhadap seluruh proyek. Perhitungan dilakukan dengan bilangan bulat berskala, bukan penjumlahan floating point. Progres proyek tidak dibulatkan ke 100% selama masih ada pekerjaan belum selesai.

## Aturan perubahan

- Admin dan PM penanggung jawab proyek dapat mengubah pekerjaan; anggota PM lain dan Viewer hanya membaca sesuai akses proyek.
- Hanya Admin dapat mengaktifkan/nonaktifkan sumber progres.
- Untuk membagi ulang bobot atau mengarsipkan pekerjaan, nonaktifkan dahulu. Progres proyek terakhir dipertahankan hingga aktivasi berikutnya; saat Draft, progres manual proyek tetap tersedia.
- Saat aktif, total bobot harus selalu 100%, progres manual pada Projects ditolak, dan update pekerjaan mengubah progres proyek dalam satu transaksi.
- Proyek Closed/Cancelled harus dibuka kembali sebelum pekerjaan diubah. Aktivasi tidak otomatis menutup proyek, mengubah status, milestone FAT/BAST, atau target selesai proyek.
- Progres di atas 0 memerlukan mulai aktual. Progres 100 memerlukan selesai aktual. Tanggal aktual tidak boleh di masa depan; pekerjaan penerus tidak dapat berjalan sebelum pendahulunya selesai.
- Jadwal rencana penerus tidak boleh mendahului selesai rencana pendahulu. Perubahan jadwal/progres pendahulu yang melanggar penerus juga ditolak. Ubah penerus terlebih dahulu bila merevisi jadwal.
- Arsip adalah soft-delete, dengan audit snapshot tetap disimpan; pekerjaan yang masih menjadi pendahulu tidak bisa diarsipkan. Antarmuka pemulihan arsip belum disediakan.
- Form usang ditolak menggunakan versi proyek dan penguncian transaksi. Audit menyimpan perubahan pekerjaan dan aktivasi rencana.

Gantt menampilkan durasi rencana dan persentase pekerjaan, bukan durasi aktual/critical path. Tanggal aktual ada di tabel. Satu pendahulu per pekerjaan; belum ada kalender hari libur, multi-predecessor, atau penjadwalan ulang otomatis. Maksimal 500 pekerjaan aktif per proyek.

## Deployment

Migrasi `20261001074036_weighted_time_plan` menambah flag Project dan tabel PlanTask. RLS dinyalakan tanpa akses publik; data hanya melalui server terautentikasi. Jalankan migrasi Prisma sebelum deployment aplikasi. Nilai/progres proyek lama tidak diubah otomatis.

Tes model memeriksa bobot, pembulatan, tanggal, dan grafik ketergantungan. Tes migrasi memeriksa constraint dan akses publik. Tes HTTP menggunakan database in-memory untuk aktivasi, sinkronisasi laporan, konflik versi, dan hak akses.
