# Pilih semua PO / proyek

Penyimpanan menggunakan penguncian dan operasi database berkelompok, bukan loop per proyek. Timeout, koneksi bermasalah, pengguna nonaktif, serta proyek tidak ditemukan/diarsipkan menampilkan pesan berbeda. Log server hanya mencatat kode error dan jumlah pilihan, tanpa kredensial atau data pengguna. Akun ADMIN mendapat pesan bahwa akses sudah tersedia; keanggotaannya tidak diubah.

Settings → Akses anggota project sekarang menampilkan checklist proyek, tombol centang **Pilih semua PO / proyek**, jumlah pilihan, pengguna tujuan, dan operasi tambah/cabut. Pilih semua mencentang proyek nonarsip yang sedang ditampilkan, bukan proyek baru di masa depan. Nama PO/proyek dalam kontrol ini merujuk pada proyek terkait PO Customer, bukan pemberian role baru.

Hanya Admin dapat menyimpan. Seluruh pilihan divalidasi server, dikunci dalam urutan tetap, dan disimpan bersama audit log dalam satu transaksi. Jika satu proyek tidak valid atau pengguna tidak aktif, seluruh perubahan dibatalkan. Pengulangan penambahan tidak membuat anggota ganda. Pencabutan lebih dari satu proyek memerlukan checkbox konfirmasi tambahan.

ADMIN sudah memiliki akses semua proyek tanpa keanggotaan. Menghapus keanggotaan tidak mencabut hak ADMIN atau kepemilikan PROJECT_MANAGER. Keanggotaan PM memberi akses sesuai perilaku sebelumnya; tidak menambah hak edit proyek milik PM lain. Keanggotaan VIEWER tidak mengubah izin Viewer. Untuk Viewer gunakan panel Pengaturan Izin Viewer / Akses semua proyek sekaligus.
