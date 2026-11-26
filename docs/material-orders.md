# Material Status Order

Alur persediaan dibagi menjadi tiga bagian:

1. **BoQ** mencatat kebutuhan material/jasa proyek, jumlah, HPP per satuan, dan total anggarannya. BoQ draft belum mengubah anggaran atau persediaan. Approval baseline memakai total BoQ sebagai budget proyek.
2. **Stok Gudang** mencatat saldo fisik. Pengambilan untuk material pada BoQ approved mengurangi gudang dan menambah jumlah diterima proyek. Pemasangan dicatat terpisah pada Material Proyek.
3. **Material Status Order** menampilkan barang gudang yang saldonya mencapai atau berada di bawah batas minimum. Daftar ini otomatis mengikuti saldo dan batas minimum terbaru; tidak otomatis membuat atau mengirim pesanan kepada supplier.

Admin dan Project Manager memilih **Buat draft order** dari daftar restock. Jumlah pesanan ditentukan petugas, karena batas minimum merupakan ambang peringatan, bukan target pembelian. Isi supplier, referensi pesanan dan perkiraan kedatangan. Satu barang hanya boleh memiliki satu order aktif agar kebutuhan yang sama tidak dipesan ganda. Pesanan aktif tetap terlihat walaupun stok sudah kembali di atas minimum.

Gunakan **Tandai sudah dipesan** setelah pemesanan kepada supplier dilakukan. Status bergerak dari Draft → Dipesan → Diterima sebagian → Diterima lengkap. Penerimaan dapat dicicil, wajib memiliki bukti referensi dan nama penerima, dan tidak boleh melebihi sisa pesanan. Setiap penerimaan menambah saldo gudang sekaligus menulis riwayat barang masuk dalam satu transaksi. Percobaan ulang kiriman formulir yang sama tidak menggandakan stok.

Pembatalan memerlukan alasan. Jumlah yang sudah diterima tetap menjadi stok; pembatalan hanya menghentikan sisa pesanan. Order aktif mengunci satuan barang. Perubahan kode atau nama master tidak mengubah snapshot pada riwayat order.

Menu **Material Proyek** dipindahkan ke tautan di BoQ. Data kebutuhan, pesanan langsung proyek, penerimaan, pemasangan dan riwayat material lama tetap dipertahankan. Viewer hanya memperoleh material proyek sesuai izin, tanpa saldo gudang atau order perusahaan. Admin/PM melihat ringkasan restock dan order terbuka pada dashboard; indikator shortage proyek tetap berdiri sendiri.

Penerimaan order tidak otomatis menjadi biaya aktual proyek. Biaya aktual tetap dicatat melalui Finance sesuai bukti dan alokasi biaya. Modul ini memakai database yang sudah ada dan tidak menambahkan layanan berbayar.
