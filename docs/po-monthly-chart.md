# Grafik bulanan PO Customer

Dashboard menampilkan 12 bulan pada tahun pilihan, dengan seri PO Masuk dan PO Selesai. Pilihan ukuran: jumlah PO atau nilai sebelum PPN; tabel menyediakan angka lengkap. Hanya proyek yang dapat diakses pengguna yang dihitung.

- PO Masuk berdasarkan `customerPoDate` (tanggal dokumen customer), untuk PO bernomor berstatus RECEIVED, IN_PROGRESS, atau COMPLETED.
- PO Selesai berdasarkan `customerPoCompletedDate`, hanya status COMPLETED.
- Draft, Cancelled, dan nomor PO kosong dikecualikan. Satu proyek mewakili satu PO seperti register yang ada.
- PO masuk tahun lalu dan selesai tahun ini muncul pada seri/tahun masing-masing. Dua seri bukan angka yang boleh dijumlahkan sebagai total PO unik.
- Nilai menggunakan nilai PO terbaru, bukan snapshot akuntansi. Koreksi tanggal/nilai, pembatalan, dan pembukaan kembali status akan mengubah grafik. Grafik bukan pembayaran atau pengakuan pendapatan.
- Migrasi hanya menambah kolom DATE nullable; PO lama tidak diberi tanggal perkiraan. Jumlah data belum lengkap ditampilkan untuk semua tahun.
- Admin harus mengisi tanggal selesai ketika menyimpan status Selesai. Tanggal tidak boleh sebelum tanggal PO atau di masa depan. Ubah ke status lain mengosongkan tanggal selesai; perubahan tetap tercatat pada audit.

Migrasi Prisma harus diterapkan sebelum deployment. Tidak ada perubahan hak akses atau kebijakan RLS.
