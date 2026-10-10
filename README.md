# Porto — buku investasi saham dan crypto

Aplikasi web untuk mencatat jual beli, dividen, dan memantau profit per bulan. Tiga pasar dipisah: **Saham Indonesia**, **Saham US**, dan **Crypto**, plus tampilan **Semua** yang menggabungkannya dalam Rupiah. Data disimpan di Google Sheets milik Anda sendiri (satu tab per pasar), tampilan di-host gratis di GitHub Pages.

## Fitur

- **Dashboard**: total hasil investasi, nilai portofolio, profit belum terealisasi, profit jual, dividen/reward, perubahan harga hari ini, grafik profit 12 bulan terakhir, alokasi.
- **Pasar terpisah**: pilih Semua, Saham Indonesia, Saham US, atau Crypto di bagian atas. Satuan menyesuaikan: lot (1 lot = 100 lembar) untuk saham Indonesia, lembar pecahan untuk saham US, koin pecahan untuk crypto. Saham US dalam dolar, crypto dalam Rupiah atau dolar (pilihan Anda).
- **Transaksi**: catat beli dan jual. Profit tiap penjualan dihitung otomatis dengan metode harga rata-rata. Penjualan yang melebihi kepemilikan ditolak.
- **Dividen / reward**: per aset, dengan pajak. Ringkasan per aset dan per tahun.
- **Bulanan**: profit dan rugi tiap bulan (profit jual + dividen), bulan terbaik dan terburuk, kumulatif.
- **Harga harian**: saham Indonesia, saham US, dan crypto diperbarui otomatis dari Yahoo Finance lewat Apps Script (cache 5 menit), termasuk kurs USD ke Rupiah. Bila suatu kode tidak ada, isi harga manual.
- **Catat lewat chat**: tulis ke Claude “beli BBCA 10 lot harga 9000”, catatan langsung masuk ke tab yang tepat di Sheet.
- Ekspor/impor cadangan (JSON), ekspor CSV, tampilan gelap otomatis, nyaman di ponsel.

## Cara menghitung

- Biaya beli (harga × jumlah + fee) masuk ke modal. Harga rata-rata = modal ÷ jumlah.
- Profit jual = (harga jual × jumlah − fee jual) − (harga rata-rata × jumlah terjual).
- Profit bulanan = profit jual di bulan itu + dividen/reward yang diterima di bulan itu. Naik turun harga aset yang belum dijual tampil di Dashboard, bukan di bulanan.
- Total hasil investasi = profit jual + belum terealisasi + dividen. Persentasenya dibagi total dana yang pernah dibelikan.
- Tampilan Semua mengalikan pasar berdolar dengan kurs saat ini. Profit bulan lalu dalam dolar ikut dikonversi pada kurs hari ini, jadi total gabungan bukan kurs historis.

## Pasang di GitHub Pages

1. Unggah seluruh isi folder ini ke repositori GitHub.
2. Buka **Settings → Pages**, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu Save.
3. Situs aktif di `https://<username>.github.io/<nama-repo>/`.

Repositori boleh publik: URL Web App dan token tidak ada di kode, hanya disimpan di browser Anda.

## Sambungkan ke Google Sheets (sekali saja)

1. Buka spreadsheet **Porto** → **Ekstensi → Apps Script**.
2. Hapus isi bawaan, tempel seluruh isi `apps-script/Code.gs`.
3. Ganti dua baris di atas dengan kata sandi buatan Anda, **keduanya harus berbeda**:
   - `TOKEN`: akses penuh, dipakai aplikasi web. Jangan dibagikan.
   - `CHAT_TOKEN`: akses terbatas untuk mencatat lewat chat (lihat di bawah).
4. Pilih fungsi `setup`, klik **Run**, setujui izin. Terbentuk enam tab: `ID Transaksi`, `ID Dividen`, `US Transaksi`, `US Dividen`, `Crypto Transaksi`, `Crypto Reward`. Bila sebelumnya ada tab `Transaksi` dan `Dividen` dari versi lama, keduanya otomatis dijadikan tab pasar Indonesia.
5. **Deploy → New deployment → Web app**: *Execute as* = **Me**, *Who has access* = **Anyone**. Salin URL Web App.
6. Buka aplikasi → **Pengaturan → Google Sheets**, tempel URL dan `TOKEN`, klik **Sambungkan**.
7. Di **Pengaturan**, pilih mata uang crypto (Rupiah atau dolar) dan samakan `CRYPTO_CCY` di Code.gs.

Bila mengubah `Code.gs` di kemudian hari, buat versi deployment baru (Deploy → Manage deployments → Edit → New version).

### Keamanan

- Setiap permintaan dicek tokennya di server. Siapa pun yang tahu URL tanpa token tidak bisa membaca atau mengubah data.
- Pengaturan berbagi spreadsheet tidak perlu terbuka untuk umum. Apps Script berjalan atas nama akun Anda, jadi sheet cukup **Restricted**. Membuka sheet untuk “siapa saja bisa edit” justru membuat siapa pun yang memegang tautannya bisa mengubah data keuangan Anda tanpa token.
- Jangan membagikan URL Web App dan token bersama-sama.

## Catat lewat chat

Tulis ke Claude, misalnya:

- `beli BBCA 10 lot harga 9000`
- `jual AAPL 0,5 lembar harga 230 tanggal 2026-10-09`
- `beli BTC 0,0025 harga 1500000000`
- `dividen TLKM 360000`

Claude memanggil Web App Anda dengan `CHAT_TOKEN`. Token ini hanya bisa **menambah** transaksi/dividen dan **membaca** posisi, tidak bisa mengubah atau menghapus data. Validasi dijalankan di server: jual melebihi kepemilikan ditolak, kode dicek per pasar, dan tiap catatan punya ID sehingga pengiriman ulang tidak menggandakan baris. Setelah mencatat, klik **Muat ulang dari Sheet** di Pengaturan aplikasi.

Yang perlu diperhatikan:

- Anda perlu memberi Claude **URL Web App** dan **CHAT_TOKEN** di chat. Keduanya tersimpan dalam riwayat percakapan itu. Karena token ini terbatas, risikonya kecil, tapi bila bocor ganti `CHAT_TOKEN` di Code.gs lalu deploy versi baru. `TOKEN` penuh jangan pernah ditempel di chat.
- Fee diisi otomatis dari persentase `FEE` di Code.gs bila tidak disebutkan. Sesuaikan dengan broker Anda.

## Mengisi data lama

- Ketik lewat **Catat transaksi** dan **Catat dividen**, atau
- isi langsung tab di Sheet (kolom ID boleh dikosongkan, akan dibuat otomatis saat aplikasi memuat), lalu klik **Muat ulang dari Sheet**.

Kolom tab transaksi: `ID, Tanggal (YYYY-MM-DD), Kode, Jenis (BELI/JUAL), Jumlah, Harga, Fee, Catatan`.
Kolom tab dividen/reward: `ID, Tanggal, Kode, Jumlah (opsional), Per Lembar/Koin (opsional), Pajak (%), Total Diterima, Catatan`.
Saham Indonesia: jumlah dalam lot. Saham US dan crypto: jumlah dalam lembar atau koin, boleh pecahan.

## Mencoba tanpa Sheet

Buka `index.html` (atau situs Pages) lalu pakai **Muat data contoh** di Pengaturan. Dalam mode lokal data hanya ada di browser itu, harga tidak diperbarui otomatis, dan kurs perlu diisi manual di Pengaturan agar tampilan Semua bisa menggabungkan pasar berdolar.

## Pengembangan

Tanpa proses build. Logika hitung ada di `js/calc.js`, backend di `apps-script/Code.gs`. Keduanya punya tes:

```
node tests/calc.test.js
node tests/appsscript.test.js
```

## Catatan

Harga dari Yahoo Finance bisa tertunda dan bukan data resmi bursa. Aplikasi ini alat pencatatan pribadi, bukan saran investasi.
