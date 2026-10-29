# Ringkasan dashboard

Dashboard merangkum PO Customer per status (jumlah catatan proyek/PO dan nilai penuh), Target Tim hari ini dan backlog sebelum hari ini, BoQ, Time Plan, produksi, FAT, delivery, site work/BAST, Action Center, dokumen, dan quotation/SPH. Grafik bulanan, keuangan portfolio aktif, peta, material shortage, milestone mendatang, serta tabel portfolio tetap tersedia.

Semua query proyek mengikuti `accessibleProjectWhere`; Admin/PM mengakses semua proyek dan kegiatan umum tanpa proyek. Quotation di-query dan dikirim ke browser Admin/PM, dengan klasifikasi parsial/selesai memakai fungsi yang sama dengan modul SPH. Nilai SPH tidak ditambahkan ke PO. Ringkasan PO memakai perhitungan yang sama dengan Finance, mencakup semua proyek non-arsip yang dapat diakses. Closed PO bukan konfirmasi pembayaran.

Operasional: BoQ menghitung revisi approved/draft pada seluruh proyek yang dapat diakses. Time Plan menghitung pekerjaan nonarsip pada proyek aktif, melewati tanggal selesai dan progres <100%. Produksi menghitung proyek aktif di fase produksi. FAT/Delivery/Site menghitung milestone belum selesai pada proyek aktif dan juga menampilkan jumlah proyek dalam fase tersebut. Dokumen menghitung READY nonhapus. Action Center menghitung unresolved pada proyek aktif.

Target Tim hari ini memakai tanggal operasional aplikasi. Pencapaian adalah rata-rata rasio aktivitas, bukan penjumlahan satuan. Daftar tindak lanjut maksimal lima aktivitas belum selesai dengan tanggal target <= hari ini, tanggal terlama dahulu. Aktivitas dibatalkan tidak dihitung. Kartu membuka modul terkait; item aktivitas membuka minggu tanggal targetnya. Pencarian dashboard tetap hanya memfilter tabel portfolio, bukan seluruh ringkasan. Data diperbarui saat halaman dimuat, bukan realtime/polling. Mode demo mempertahankan dashboard contoh sebelumnya tanpa mengklaim data ringkasan live.

Tidak ada migrasi database atau integrasi berbayar baru.
