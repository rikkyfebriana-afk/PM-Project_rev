# Izin Viewer

## Akses sekaligus

Admin atau Project Manager: pilih akun Viewer, lalu **Aktifkan semua proyek + PO + Material + BoQ**. Hanya akun terpilih yang terpengaruh. Berlaku untuk seluruh proyek nonarsip saat ini dan proyek baru, termasuk proyek yang sebelumnya disembunyikan melalui izin per proyek. Empat akses baca ini mengesampingkan pembatasan per proyek selama sakelar aktif. Finance, dokumen, Time Plan, Target Tim, SPH dan operasional lainnya tidak berubah. Nonaktifkan sakelar untuk kembali ke izin per proyek sebelumnya. Sakelar tidak aktif otomatis pada akun lama ataupun baru.

Admin dan PM memiliki akses penuh seluruh proyek dan dapat mengatur izin Viewer dengan wewenang yang sama. Form tambahan **Berikan akses sekaligus** tetap mendukung penambahan empat izin ke proyek yang dipilih dari daftar saat ini; daftar/versi diperiksa ulang agar form usang tidak menimpa perubahan baru. Pengubahan individual tetap tersedia.

Izin MATERIALS terpisah dari OPERATIONS; izin OPERATIONS lama tetap mencakup Material untuk kompatibilitas. Viewer tidak mendapat hak mengubah atau ekspor. Semua aksi dicatat di audit log. Setelah perubahan, refresh akun Viewer.

Settings → Pengaturan Izin Viewer: pilih akun Viewer aktif, buka proyek, centang jenis data, simpan. Admin dan Project Manager mengelola izin untuk semua proyek nonarsip.

Tanpa pengaturan khusus, Viewer melihat seluruh proyek nonarsip dan PO Customer. Izin tambahan default tertutup: Finance, BoQ, dokumen, Time Plan, Target Tim, dan operasional. Simpan dengan semua centang kosong untuk menyembunyikan proyek. Izin modul memerlukan PROJECT; Finance juga memerlukan PO karena perhitungannya memakai nilai PO. Izin dokumen mencakup dokumen komersial: pertimbangkan sebelum mencentang.

Izin bukan filter browser. Query server memakai izin per akun/per proyek pada setiap permintaan. Keanggotaan proyek lama tidak membuka data sensitif. Dashboard Viewer menggunakan proyeksi terpisah tanpa budget, actual, forecast, atau margin. Halaman Finance hanya berisi proyek dengan izin FINANCE. SPH hanya untuk Admin/PM. Viewer tidak dapat mengubah data atau mengekspor laporan; endpoint download dokumen memerlukan DOCUMENTS. Tautan unduhan yang telah diterbitkan sebelumnya tetap dapat berlaku sampai TTL 60 detik berakhir. Data/file yang sudah diterima atau disalin tidak dapat ditarik kembali.

Izin tersimpan dalam ViewerPermission, RLS aktif, tanpa grant anon/authenticated, mengikuti custom-session server yang ada. Perubahan ditransaksikan dengan kunci proyek dan user, versi optimistik, serta audit before/after. Pencabutan berlaku pada permintaan berikutnya; muat ulang tab Viewer untuk membersihkan tampilan lama.

Tidak ada migrasi destructive atau layanan berbayar.
