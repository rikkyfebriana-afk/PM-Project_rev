# Ringkasan Finance berdasarkan PO Customer

Ringkasan memakai nilai `poValue` (belum termasuk PPN) dan status PO Customer, bukan status proyek, persentase progres, invoice, atau pembayaran.

| Kategori Finance | Status PO Customer |
| --- | --- |
| Open | Diterima / RECEIVED |
| In Progress | Diproses / IN_PROGRESS |
| Closed | Selesai / COMPLETED |
| Draft | DRAFT |
| Cancelled | Dibatalkan / CANCELLED |
| Belum tercatat | Tidak ada nomor PO atau status tidak dikenali |

Setiap proyek masuk tepat satu kategori. Closed tidak berarti lunas. Jumlah pada kartu adalah jumlah proyek (saat ini satu register PO per proyek), bukan jumlah dokumen yang diunggah. Proyek lama tanpa nomor PO tetap memiliki nilai baseline di kategori Belum tercatat sehingga tidak hilang dari rekonsiliasi total.

Kartu ringkasan mengikuti filter proyek. Klik kartu untuk menyaring daftar proyek dan riwayat biaya; Semua status menghapus filter status saja. Total PO/Budget/Actual/Forecast paling atas tetap total portofolio yang boleh diakses pengguna dan diberi penjelasan eksplisit.

Perhitungan nilai kategori menggunakan integer sen (BigInt) dan dikembalikan sebagai string, sehingga tidak kehilangan presisi untuk angka besar. Tidak ada migrasi atau perubahan nilai/status tersimpan. Perubahan status dilakukan melalui PO Customer seperti sebelumnya.
