# Input manual BoQ

Pada menu BoQ, pilih proyek lalu buka **Input manual BoQ — tanpa Excel**. Tambahkan baris Material, Jasa, atau Lainnya. Isi nomor item unik, kode (wajib Material), deskripsi, satuan, quantity, dan harga satuan.

Subtotal dan total dihitung otomatis. Quantity maksimal 4 desimal, harga 2 desimal; gunakan titik desimal tanpa pemisah ribuan. Server memakai validasi dan perhitungan Decimal yang sama dengan impor Excel, termasuk pembulatan half-up per baris dan penolakan kode material duplikat. Input manual dibatasi 200 baris; impor file tetap tersedia untuk daftar besar.

Centang konfirmasi lalu pilih **Simpan BoQ manual sebagai Draft**. Daftar harus berisi seluruh item revisi, bukan hanya tambahan. Draft sebelumnya menjadi Superseded; approved baseline tidak berubah. Riwayat tetap disimpan. Data identik dengan revisi manual atau impor terdahulu tidak membuat duplikat. Form revisi yang tertinggal ditolak saat versi baru sudah dibuat.

Admin dan PM dapat membuat Draft untuk semua proyek; Viewer hanya membaca sesuai izin. Proyek Closed/Cancelled harus dibuka kembali sebelum input manual. Mode demo hanya baca. Approval melalui tombol **Approve baseline** di riwayat revisi tersedia bagi Admin dan PM; alur sinkronisasi material yang ada tetap dipakai.

Input yang belum disimpan hanya berada di form browser. Memuat ulang atau berpindah proyek mengosongkannya. Fitur ini tidak otomatis menyalin isi baseline lama ke form. Tidak dibuat dokumen file fiktif: sumber revisi ditandai `Input manual web`, tanpa sourceDocumentId, dengan audit `BOQ_MANUAL_CREATED`.

Tidak ada migrasi database atau perubahan RLS. Penyimpanan memakai transaksi dan kunci proyek yang sama dengan impor/approval, sehingga alokasi nomor versi dan penggantian Draft bersifat atomik.

## HPP dan anggaran proyek

Rincian revisi BoQ dapat ditampilkan per proyek dan revisi. HPP per satuan × jumlah menghasilkan total per item, subtotal Material/Jasa/Lainnya, dan total BoQ. Item dengan HPP nol ditandai agar dapat dilengkapi. Jumlah diterima, terpasang, dan diterima dari gudang membantu membandingkan kebutuhan dengan realisasi material.

Approval baseline baru memakai total seluruh item BoQ sebagai budget proyek dalam transaksi yang sama. Konfirmasi approval menjelaskan perubahan ini. Budget proyek dari baseline lama tidak diganti otomatis saat pembaruan aplikasi; Admin/PM dapat memakai pilihan penyesuaian budget dari baseline approved setelah memeriksa nilai lama dan nilai penggantinya. Biaya aktual Finance tidak diubah.

Tautan Material Proyek membuka register kebutuhan dan realisasi lama. Akses rincian HPP mengikuti izin BoQ; izin Material saja tidak membuka harga atau budget.
