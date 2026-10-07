# Input manual BoQ

Pada menu BoQ, pilih proyek lalu buka **Input manual BoQ — tanpa Excel**. Tambahkan baris Material, Jasa, atau Lainnya. Isi nomor item unik, kode (wajib Material), deskripsi, satuan, quantity, dan harga satuan.

Subtotal dan total dihitung otomatis. Quantity maksimal 4 desimal, harga 2 desimal; gunakan titik desimal tanpa pemisah ribuan. Server memakai validasi dan perhitungan Decimal yang sama dengan impor Excel, termasuk pembulatan half-up per baris dan penolakan kode material duplikat. Input manual dibatasi 200 baris; impor file tetap tersedia untuk daftar besar.

Centang konfirmasi lalu pilih **Simpan BoQ manual sebagai Draft**. Daftar harus berisi seluruh item revisi, bukan hanya tambahan. Draft sebelumnya menjadi Superseded; approved baseline tidak berubah. Riwayat tetap disimpan. Data identik dengan revisi manual atau impor terdahulu tidak membuat duplikat. Form revisi yang tertinggal ditolak saat versi baru sudah dibuat.

Admin dan PM penanggung jawab dapat membuat Draft; Viewer hanya membaca. Proyek Closed/Cancelled harus dibuka kembali sebelum input manual. Mode demo hanya baca. Approval tetap melalui tombol **Approve baseline** di riwayat revisi, hanya oleh Admin; alur sinkronisasi material yang ada tetap dipakai.

Input yang belum disimpan hanya berada di form browser. Memuat ulang atau berpindah proyek mengosongkannya. Fitur ini tidak otomatis menyalin isi baseline lama ke form. Tidak dibuat dokumen file fiktif: sumber revisi ditandai `Input manual web`, tanpa sourceDocumentId, dengan audit `BOQ_MANUAL_CREATED`.

Tidak ada migrasi database atau perubahan RLS. Penyimpanan memakai transaksi dan kunci proyek yang sama dengan impor/approval, sehingga alokasi nomor versi dan penggantian Draft bersifat atomik.
