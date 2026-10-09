# Porto — buku investasi saham

Aplikasi web untuk mencatat jual beli saham, dividen, dan memantau profit per bulan. Data disimpan di Google Sheets milik Anda sendiri (spreadsheet **Porto**), tampilan di-host gratis di GitHub Pages.

## Fitur

- **Dashboard**: total hasil investasi, nilai portofolio, profit belum terealisasi, profit jual, dividen, perubahan harga hari ini, dan grafik profit 12 bulan terakhir.
- **Transaksi**: catat beli dan jual (lot, harga, fee). Profit tiap penjualan dihitung otomatis dengan metode harga rata-rata. Penjualan yang melebihi kepemilikan ditolak.
- **Dividen**: catat dividen per saham (opsional lot × dividen per lembar, pajak 10% otomatis dihitung), ringkasan per saham dan per tahun.
- **Bulanan**: profit dan rugi tiap bulan (profit jual + dividen), bulan terbaik dan terburuk, kumulatif.
- **Harga harian**: harga saham IDX diperbarui otomatis dari Yahoo Finance lewat Apps Script (cache 5 menit). Bila suatu kode tidak ada, Anda bisa mengisi harga manual.
- Ekspor/impor cadangan (JSON), ekspor CSV, tampilan gelap otomatis, nyaman di ponsel.

## Cara menghitung

- 1 lot = 100 lembar.
- Biaya beli (harga × lembar + fee) masuk ke modal. Harga rata-rata = modal ÷ lembar.
- Profit jual = (harga jual × lembar − fee jual) − (harga rata-rata × lembar terjual).
- Profit bulanan = profit jual yang terjadi di bulan itu + dividen yang diterima di bulan itu. Naik turun harga saham yang belum dijual tampil di Dashboard, bukan di bulanan.
- Total hasil investasi = profit jual + belum terealisasi + dividen. Persentasenya dibagi total dana yang pernah dibelikan.

## Pasang di GitHub Pages

1. Buat repositori baru di GitHub (misalnya `porto`), unggah seluruh isi folder ini.
2. Buka **Settings → Pages**, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu Save.
3. Situs aktif di `https://<username>.github.io/porto/`.

Repositori boleh publik: URL Web App dan token tidak ada di kode, hanya disimpan di browser Anda.

## Sambungkan ke Google Sheets (sekali saja)

1. Buka spreadsheet **Porto** → **Ekstensi → Apps Script**.
2. Hapus isi bawaan, tempel seluruh isi `apps-script/Code.gs`.
3. Ganti `TOKEN` di baris atas dengan kata sandi buatan Anda (panjang dan acak).
4. Pilih fungsi `setup`, klik **Run**, setujui izin. Tab **Transaksi** dan **Dividen** terbentuk.
5. **Deploy → New deployment → Web app**: *Execute as* = **Me**, *Who has access* = **Anyone**. Salin URL Web App.
6. Buka aplikasi → **Pengaturan → Google Sheets**, tempel URL dan token yang sama, klik **Sambungkan**.

Bila mengubah `Code.gs` di kemudian hari, buat versi deployment baru (Deploy → Manage deployments → Edit → New version).

### Keamanan

- Token dicek di server pada setiap permintaan. Siapa pun yang tahu URL tanpa token tidak bisa membaca atau mengubah data.
- Jangan membagikan URL Web App dan token bersama-sama.
- Aplikasi hanya mengakses spreadsheet tempat skrip ditempel.

## Mengisi data lama

- Ketik lewat tombol **Catat transaksi** dan **Catat dividen**, atau
- isi langsung tab **Transaksi** dan **Dividen** di Sheet dengan kolom yang sama (kolom ID boleh diisi teks unik apa saja), lalu klik **Muat ulang dari Sheet** di Pengaturan.

Kolom tab Transaksi: `ID, Tanggal (YYYY-MM-DD), Kode Saham, Jenis (BELI/JUAL), Lot, Harga per Lembar, Fee, Catatan`.
Kolom tab Dividen: `ID, Tanggal, Kode Saham, Lot, Dividen per Lembar, Pajak (%), Total Diterima, Catatan`.

## Mencoba tanpa Sheet

Buka `index.html` (atau situs Pages) lalu pakai **Muat data contoh** di Pengaturan. Dalam mode lokal data hanya ada di browser itu dan harga tidak diperbarui otomatis.

## Pengembangan

Tanpa proses build. `js/calc.js` berisi seluruh logika hitung dan bisa diuji:

```
node tests/calc.test.js
```

## Catatan

Harga dari Yahoo Finance bisa tertunda dan bukan data resmi bursa. Aplikasi ini alat pencatatan pribadi, bukan saran investasi.
