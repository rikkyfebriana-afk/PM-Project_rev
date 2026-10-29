# Pilih semua PO / proyek

Penyimpanan menggunakan penguncian dan operasi database berkelompok, bukan loop per proyek. Timeout, koneksi bermasalah, pengguna nonaktif, serta proyek tidak ditemukan/diarsipkan menampilkan pesan berbeda. Log server hanya mencatat kode error dan jumlah pilihan, tanpa kredensial atau data pengguna. Akun ADMIN dan PROJECT_MANAGER mendapat pesan bahwa akses sudah tersedia; keanggotaannya tidak diubah.

Settings → Akses anggota project sekarang menampilkan checklist proyek, tombol centang **Pilih semua PO / proyek**, jumlah pilihan, pengguna tujuan, dan operasi tambah/cabut. Pilih semua mencentang proyek nonarsip yang sedang ditampilkan, bukan proyek baru di masa depan. Nama PO/proyek dalam kontrol ini merujuk pada proyek terkait PO Customer, bukan pemberian role baru.

Admin dan Project Manager dapat menyimpan. Seluruh pilihan divalidasi server, dikunci dalam urutan tetap, dan disimpan bersama audit log dalam satu transaksi. Jika satu proyek tidak valid atau pengguna tidak aktif, seluruh perubahan dibatalkan. Pengulangan penambahan tidak membuat anggota ganda. Pencabutan lebih dari satu proyek memerlukan checkbox konfirmasi tambahan.

ADMIN dan PROJECT_MANAGER sudah memiliki akses penuh semua proyek tanpa keanggotaan, termasuk proyek baru. Menghapus keanggotaan tidak mencabut akses kedua role. Keanggotaan VIEWER tidak mengubah izin Viewer. Untuk Viewer gunakan panel Pengaturan Izin Viewer / Akses semua proyek sekaligus.
