# Stok gudang dan material BoQ

Admin dan Project Manager membuka menu **Stok Gudang** untuk mengelola persediaan perusahaan. Viewer tidak memperoleh akses ke saldo gudang atau transaksi gudang. Izin Material milik Viewer tetap hanya berlaku pada material proyek.

1. Tambahkan master material gudang: kode material, deskripsi, satuan, lokasi/rak, dan batas stok minimum. Material baru dimulai dari saldo nol.
2. Catat **Barang masuk** untuk saldo awal maupun penerimaan berikutnya. Isi jumlah, nomor referensi, petugas/penerima, dan catatan.
3. Pada **Pengambilan untuk proyek**, pilih stok, proyek, dan material dari baseline BoQ yang sudah disetujui. Kode dan satuan harus sesuai. Periksa sisa kebutuhan dan jumlah yang diambil, lalu konfirmasi.
4. Saldo gudang langsung berkurang dan material diterima proyek bertambah dalam transaksi yang sama. Pengambilan tidak menandai material sebagai terpasang. Pembuatan/approval BoQ sendiri belum mengurangi stok.
5. Gunakan **Retur ke gudang** pada transaksi pengambilan asal untuk mengembalikan material yang belum terpakai. Saldo gudang bertambah dan material diterima proyek berkurang. Material yang sudah terpasang tidak dapat diretur sebelum data pemasangannya direkonsiliasi.

Pengambilan dibatasi oleh saldo tersedia dan sisa kebutuhan BoQ proyek. Stok tidak dapat menjadi negatif. Retur tidak boleh melebihi pengambilan asal setelah memperhitungkan retur sebelumnya. Pengambilan pada BoQ draft, material nonaktif, serta proyek yang sudah ditutup/dibatalkan atau diarsipkan ditolak.

Retur historis tetap dapat dicatat meskipun proyek sudah ditutup/diarsipkan, material telah dinonaktifkan, atau baseline BoQ telah diganti. Retur tetap merujuk transaksi pengambilan asal dan hanya berlaku untuk material yang belum terpasang.

Setiap penerimaan, pengambilan dan retur memiliki nomor referensi, petugas, waktu, jumlah, saldo sesudah transaksi dan tautan proyek/BoQ. Riwayat transaksi tidak diedit atau dihapus; koreksi fisik dicatat sebagai transaksi baru yang sesuai. Percobaan ulang form yang sama tidak menggandakan pergerakan stok. Permintaan dengan token sama tetapi isi berbeda ditolak.

Transaksi stok menggunakan jumlah presisi empat desimal dan penguncian database agar dua pengambilan bersamaan tidak menghabiskan stok yang sama. Jumlah material diterima proyek tidak dapat diturunkan secara manual melewati jumlah bersih yang sudah dikirim dari gudang; gunakan retur gudang untuk mengembalikannya. Pencatatan biaya tetap dilakukan di Finance sesuai alur yang ada.

Modul ini tidak menambahkan layanan berbayar dan tidak mengisi data stok riil secara otomatis. Saldo awal dimasukkan berdasarkan hasil pengecekan fisik gudang.
