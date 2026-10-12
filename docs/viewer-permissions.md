# Izin Viewer

Settings → Pengaturan Izin Viewer: pilih akun Viewer aktif, buka proyek, centang jenis data, simpan. Admin mengelola semua proyek nonarsip. Project Manager hanya proyek yang dikelolanya, bukan proyek yang hanya diikutinya sebagai anggota. Tidak ada perubahan wewenang pengelola lain dalam rilis ini.

Tanpa pengaturan khusus, Viewer melihat seluruh proyek nonarsip dan PO Customer. Izin tambahan default tertutup: Finance, BoQ, dokumen, Time Plan, Target Tim, dan operasional. Simpan dengan semua centang kosong untuk menyembunyikan proyek. Izin modul memerlukan PROJECT; Finance juga memerlukan PO karena perhitungannya memakai nilai PO. Izin dokumen mencakup dokumen komersial: pertimbangkan sebelum mencentang.

Izin bukan filter browser. Query server memakai izin per akun/per proyek pada setiap permintaan. Keanggotaan proyek lama tidak membuka data sensitif. Dashboard Viewer menggunakan proyeksi terpisah tanpa budget, actual, forecast, atau margin. Halaman Finance hanya berisi proyek dengan izin FINANCE. SPH tetap Admin-only. Viewer tidak dapat mengubah data atau mengekspor laporan; endpoint download dokumen memerlukan DOCUMENTS. Tautan unduhan yang telah diterbitkan sebelumnya tetap dapat berlaku sampai TTL 60 detik berakhir. Data/file yang sudah diterima atau disalin tidak dapat ditarik kembali.

Izin tersimpan dalam ViewerPermission, RLS aktif, tanpa grant anon/authenticated, mengikuti custom-session server yang ada. Perubahan ditransaksikan dengan kunci proyek dan user, versi optimistik, serta audit before/after. Pencabutan berlaku pada permintaan berikutnya; muat ulang tab Viewer untuk membersihkan tampilan lama.

Tidak ada migrasi destructive atau layanan berbayar.
