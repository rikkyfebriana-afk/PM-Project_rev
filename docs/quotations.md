# Quotation / SPH

Administrator membuka menu Quotation / SPH, membuat penawaran dan mencatat tanggal pengiriman. Aplikasi tidak mengirim email otomatis. Field: nomor unik (uppercase), customer, pekerjaan, nilai sebelum pajak, tanggal SPH/kirim/berlaku/follow-up, PIC, status, dan catatan.

Satu SPH dapat terhubung ke beberapa PO Customer yang sudah tercatat. Sistem PO saat ini menyimpan satu PO per proyek; tautan memakai ID proyek, bukan menduplikasi nominal. Satu PO hanya dapat terhubung ke satu SPH dan nama customer harus cocok. Lepaskan hubungan lama sebelum memindahkan PO. Tidak ada perubahan nilai PO atau finance saat menautkan.

Status Draft, Terkirim, Negosiasi, Ditolak, Kedaluwarsa dipilih pengguna. Sebagian menjadi PO otomatis ketika ada PO diterima/diproses/selesai. Selesai menjadi PO dikonfirmasi Administrator ketika semua lingkup yang disepakati sudah dipesan, bukan otomatis berdasarkan nilai. Kedaluwarsa tidak otomatis; tanggal berlaku tetap ditampilkan untuk pemeriksaan. Ringkasan memakai nilai sebelum pajak; selisih bukan piutang. PO draft/cancelled dan proyek arsip tidak masuk total konversi. Tautan historis tetap terlihat. Membatalkan seluruh PO pada SPH selesai akan memunculkan peringatan rekonsiliasi.

Simpan memakai optimistic version dan kunci baris; nomor SPH unik; semua perubahan dan tautan dicatat di audit. RLS aktif tanpa akses anon/authenticated: hanya server dengan session custom yang dapat membaca/menulis. Halaman dan server actions menolak non-Admin; demo tidak menyimpan.

Tahap ini mencakup register dan hubungan PO, belum upload dokumen SPH atau pengiriman email. Jangan menyalin harga penawaran menjadi pendapatan. Migrasi Prisma harus diterapkan sebelum kode terbaru di-deploy. Pengujian HTTP memakai fixture PGlite terisolasi, tidak membuat SPH percobaan di produksi.
