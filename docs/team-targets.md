# Target Tim

Berbagi WhatsApp menggunakan pratinjau dan tombol salin, tanpa layanan berbayar atau pengiriman otomatis. Jadwal manual yang disepakati Senin–Jumat 09.00 WIB. Pilih tanggal dalam minggu aktif; ringkasan mengikuti filter PIC/proyek dan hak akses, mengecualikan aktivitas dibatalkan. Pengguna menempelkan pesan ke grup tim, memeriksa penerima, lalu mengirim sendiri. Jika clipboard tidak tersedia, teks pratinjau dapat disalin manual.

Papan Senin–Minggu pada `/team-targets`, dapat berganti minggu atau melompat ke tanggal. PIC berupa nama teks, tidak harus memiliki akun dan tidak memberi akses login.

Admin dan PM mengelola seluruh aktivitas di semua proyek, termasuk aktivitas umum tanpa proyek. Viewer membaca sesuai izin Target Tim pada proyek. Target pada proyek Closed/Cancelled hanya baca sampai proyek dibuka kembali. Aktivitas proyek arsip tidak ditampilkan.

Isi proyek, pekerjaan, PIC, tanggal, target, realisasi, satuan, prioritas, status, catatan. Pekerjaan tanpa quantity menggunakan target 1 aktivitas. Status Belum mulai mensyaratkan realisasi 0; Selesai mensyaratkan realisasi >= target. Tombol Tandai selesai memerlukan konfirmasi dan mengisi realisasi minimal sebesar target. Terhambat/Dibatalkan wajib catatan.

Pencapaian adalah rata-rata realisasi/target per aktivitas (maksimum 100% tiap aktivitas), bukan menjumlahkan quantity berbeda satuan. Aktivitas dibatalkan dikeluarkan dari ringkasan. Ringkasan mengikuti filter PIC/proyek. Selesai hari ini berarti aktivitas yang ditargetkan hari ini dan sudah selesai, bukan semua aktivitas yang kebetulan diselesaikan hari ini. Tidak ada perubahan otomatis pada Project.progressPct, Time Plan, Finance, atau material.

Aktivitas belum selesai sebelum minggu pilihan ada dalam backlog dan tidak dipindahkan otomatis. Jadwal baru wajib alasan; originalDate tetap; audit menyimpan before/after serta alasan. Riwayat tampilan dibatasi 200 audit terbaru untuk aktivitas yang dimuat. Riwayat database tidak dihapus. Pembatalan menggantikan penghapusan data.

Penyimpanan memakai transaksi, kunci proyek/baris, versi optimistik, dan requestId unik untuk mencegah duplikasi submit. RLS aktif dan grant anon/authenticated dicabut karena akses melalui custom session server. Migrasi mengikuti Prisma existing; Supabase CLI tidak tersedia. Jalankan migrasi produksi hanya setelah tes fixture terisolasi berhasil.

Belum ada push notification, absensi, atau penilaian kinerja otomatis. Nama PIC adalah teks bebas; ejaan konsisten disarankan. Form belum disimpan akan hilang saat reload/navigasi.
