# Porto — buku investasi saham dan crypto

Aplikasi web untuk mencatat jual beli, dividen, dan memantau profit per bulan. Tiga pasar dipisah: **Saham Indonesia**, **Saham US**, dan **Crypto**, plus tampilan **Semua** yang menggabungkannya dalam Rupiah. Data disimpan di Google Sheets milik Anda sendiri (satu tab per pasar), tampilan di-host gratis di GitHub Pages.

## Fitur

- **Dashboard**: total hasil investasi, nilai portofolio, profit belum terealisasi, profit jual, dividen/reward, perubahan harga hari ini, grafik profit 12 bulan terakhir, alokasi.
- **Rincian emiten**: klik kode saham/koin (misalnya BBCA) untuk melihat riwayat jual beli, riwayat dividen, total profit, profil Trading/Investing, dan info otomatis: selisih harga sekarang dengan harga jual terakhir dan harga rata-rata, serta pola bulan pembagian dividen dari catatan Anda (peringatan bila perkiraan jatuh dalam 90 hari). Untuk emiten yang ada di `js/dividends.js` (saat ini BBCA), info dividen memakai data resmi: dividen terakhir (jenis, cum date, tanggal bayar), total 12 bulan dan imbal dividennya terhadap harga sekarang dan harga rata-rata Anda, jadwal atau rencana berikutnya, jendela beli 3 bulan sebelum cum date, serta penilaian ringkas (Layak dipertimbangkan / Netral / Tunggu koreksi) dari jendela beli, posisi di rentang 52 minggu, dan harga jual terakhir. Info ini berbasis aturan sederhana, bukan AI dan bukan saran investasi.
- **Trading & Investing**: halaman tersendiri dengan tab Semua / Trading / Investing / Belum diatur. Pilih tiap emiten masuk Trading atau Investing, lengkap dengan detail alokasi porsi (persen dari portofolio, modal, naik/turun vs modal, porsi per pasar, emiten terbesar). Profil tersimpan di browser.
- **Pasar terpisah**: pilih Semua, Saham Indonesia, Saham US, atau Crypto di bagian atas. Satuan menyesuaikan: lot (1 lot = 100 lembar) untuk saham Indonesia, lembar pecahan untuk saham US, koin pecahan untuk crypto. Saham US dalam dolar, crypto dalam Rupiah atau dolar (pilihan Anda).
- **Transaksi**: catat beli dan jual. Profit tiap penjualan dihitung otomatis dengan metode harga rata-rata. Penjualan yang melebihi kepemilikan ditolak.
- **Dividen / reward**: per aset, dengan pajak. Ringkasan per aset dan per tahun.
- **Bulanan**: profit dan rugi tiap bulan (profit jual + dividen), bulan terbaik dan terburuk, kumulatif.
- **Harga harian**: saham Indonesia, saham US, dan crypto diperbarui otomatis: crypto dari Binance, saham dari GOOGLEFINANCE (login Google), atau Yahoo Finance bila memakai Apps Script. Termasuk kurs USD ke Rupiah. Bila suatu kode tidak ada, isi harga manual.
- **Catat lewat chat**: tulis ke Claude “beli BBCA 10 lot harga 9000”, catatan langsung masuk ke tab yang tepat di Sheet.
- Ekspor/impor cadangan (JSON), ekspor CSV, tampilan gelap otomatis, nyaman di ponsel.

## Info dan analisa otomatis

Tombol **Analisa** di tabel posisi membuka halaman emiten. Semua yang ada di sana tampil otomatis, tanpa tombol dan tanpa AI luar:

- **Informasi dividen**: dividen terakhir (jumlah dan % dari harga sekarang), potensi bila dibagikan sama, total 12 bulan, frekuensi (sekali, dua kali, triwulanan) dan bulan pembagian. Sumbernya data resmi di `js/dividends.js` bila ada, kalau tidak dari dividen yang Anda catat.
- **Valuasi**: murah, wajar, atau mahal dari PER (Google Finance), posisi di rentang 52 minggu, imbal dividen, dan nilai wajar dari analisa bila ada.
- **Pertumbuhan setahun**: perubahan harga 12 bulan (Google Finance untuk saham, Binance untuk kripto) dan pertumbuhan laba bila tersedia di analisa.
- **Analisa otomatis**: rekomendasi dari sudut pandang value investing, dividen, dan trader. Ini aturan dari angka di atas, bukan AI dan bukan saran investasi.

Bagian **Analisa mendalam** (laporan keuangan, aksi korporasi, berita, nilai wajar) disusun Claude dari sumber publik dan disimpan di `js/analisa.js`; saat ini baru BBCA. Aplikasi tidak bisa memanggil Claude sendiri, jadi untuk emiten lain atau pembaruan, minta Claude di chat ("analisa ulang KODE") dan berkasnya diperbarui. Banner "Analisis mungkin usang" muncul bila umurnya lebih dari 14 hari atau harga bergerak 10% atau lebih.

Batas: PER dan EPS dari Google Finance sering kosong untuk saham Indonesia, dan pertumbuhan laba hanya ada untuk emiten yang sudah dianalisis; selebihnya yang tampil adalah pertumbuhan harga. Broker summary (AK, BK, dan sejenisnya) tidak ada sumber gratis.

## Data dividen resmi

`js/dividends.js` berisi jadwal dan nominal dividen per emiten yang dihimpun dari pemberitaan pengumuman resmi (bukan umpan data langsung). Tambah emiten dengan mengikuti format BBCA, atau minta Claude menambahkannya. Cek tanggal asli di keterbukaan informasi emiten/IDX sebelum bertransaksi. Emiten tanpa data resmi memakai pola dari dividen yang Anda catat sendiri.

Valuasi ringkas (tertinggi/terendah 52 minggu, P/E, EPS) diambil dari `GOOGLEFINANCE` di tab Harga dan bisa kosong untuk sebagian emiten Indonesia. Aliran broker (smart money), berita, dan target analis tidak tersedia otomatis.

## Login tidak mudah keluar

Token Google berlaku sekitar satu jam dan tidak bisa diperpanjang tanpa server. Aplikasi menyimpan token di browser sehingga muat ulang tidak meminta login lagi, memperpanjangnya otomatis menjelang habis, dan memperpanjang saat klik berikutnya bila perpanjangan otomatis diblokir browser. Bila browser memblokir pop-up Google, izinkan pop-up untuk situs ini.

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

## Masuk dengan Google

Pengguna cukup klik **Masuk dengan Google**. Tidak ada yang perlu diisi: spreadsheet "Porto" dicari di Google Drive akun yang login, dan dibuat otomatis (lengkap dengan tab dan judul kolom) bila belum ada. Data tiap akun terpisah, dan aplikasi hanya bisa mengakses file yang dibuatnya sendiri (izin `drive.file`), bukan seluruh Drive.

Pemilik aplikasi menyiapkan sekali di Google Cloud:

1. Buka [console.cloud.google.com](https://console.cloud.google.com), buat project.
2. **APIs & Services → Library**: aktifkan **Google Sheets API** dan **Google Drive API**.
3. **OAuth consent screen**: tipe External, status Testing, tambahkan semua akun Gmail yang boleh masuk sebagai **Test users**.
4. **Credentials → OAuth client ID → Web application**. Di **Authorized JavaScript origins** isi `https://<username>.github.io` (tanpa garis miring).
5. Salin Client ID ke `clientId` di `js/config.js` lalu commit. Client ID bukan rahasia.

Google menampilkan peringatan "aplikasi belum diverifikasi" untuk aplikasi pribadi; pilih Lanjutkan. Login berlaku sekitar satu jam; setelah itu klik masuk lagi. Tab memakai nama yang sama dengan versi Apps Script.

### Harga terbaru

- **Crypto real-time**: WebSocket publik Binance (`data-stream.binance.vision`), harga bergerak langsung di Dashboard dan tidak butuh login. Bila terputus, menyambung ulang otomatis. Untuk pembaruan berkala dipakai API publik Binance (`data-api.binance.vision`, tanpa API key). Harga terakhir dan perubahan 24 jam terhadap pasangan USDT. Bila Binance tidak terjangkau dari jaringan Anda, otomatis memakai GOOGLEFINANCE.
- **Saham Indonesia dan US, serta kurs USD ke Rupiah**: diperbarui tiap sekitar 1 menit saat halaman terbuka dan sudah login, lewat rumus `GOOGLEFINANCE` di tab **Harga** pada spreadsheet Anda (dibuat dan diisi otomatis). Google menyebut data bursa Indonesia tertunda sekitar 10 menit.
- **Stockbit**: tidak dipakai karena tidak ada API publik resmi untuk pengembang.

## Apps Script (opsional, untuk catat lewat chat)

Mode Apps Script tetap tersedia dan dibutuhkan bila ingin mencatat lewat chat dengan Claude. Keduanya memakai tab yang sama.

1. Buka spreadsheet **Porto** → **Ekstensi → Apps Script**.
2. Hapus isi bawaan, tempel seluruh isi `apps-script/Code.gs`.
3. Ganti dua baris di atas dengan kata sandi buatan Anda, **keduanya harus berbeda**:
   - `TOKEN`: akses penuh, dipakai aplikasi web. Jangan dibagikan.
   - `CHAT_TOKEN`: akses terbatas untuk mencatat lewat chat (lihat di bawah).
4. Pilih fungsi `setup`, klik **Run**, setujui izin. Terbentuk enam tab: `ID Transaksi`, `ID Dividen`, `US Transaksi`, `US Dividen`, `Crypto Transaksi`, `Crypto Reward`. Tab lama `Transaksi` dan `Dividen` otomatis dijadikan tab pasar Indonesia.
5. **Deploy → New deployment → Web app**: *Execute as* = **Me**, *Who has access* = **Anyone**. Salin URL Web App.
6. Bila ingin aplikasi memakai Apps Script (bukan login Google): **Pengaturan → Apps Script**, tempel URL dan `TOKEN`, klik **Sambungkan**.
7. Di **Pengaturan**, pilih mata uang crypto (Rupiah atau dolar) dan samakan `CRYPTO_CCY` di Code.gs.

Bila mengubah `Code.gs`, buat versi deployment baru (Deploy → Manage deployments → Edit → New version).

### Keamanan

- Setiap permintaan dicek tokennya di server. Siapa pun yang tahu URL tanpa token tidak bisa membaca atau mengubah data.
- Dengan login Google maupun Apps Script, pengaturan berbagi spreadsheet tidak perlu terbuka untuk umum; cukup bagikan ke akun yang dipercaya. Apps Script berjalan atas nama akun Anda, jadi sheet cukup **Restricted**. Membuka sheet untuk “siapa saja bisa edit” justru membuat siapa pun yang memegang tautannya bisa mengubah data keuangan Anda tanpa token.
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

Setiap kali menerbitkan perubahan, naikkan nomor versi pada URL aset di `index.html` (`?v=`), konstanta `BUILD` di `index.html`, dan `version.json`. Browser yang masih memegang salinan lama akan memuat ulang sendiri sekali.


Tanpa proses build. Logika hitung ada di `js/calc.js`, backend di `apps-script/Code.gs`. Keduanya punya tes:

```
node tests/calc.test.js
node tests/appsscript.test.js
node tests/gsheets.test.js
node tests/live.test.js
node tests/locate.test.js
node tests/insight.test.js
node tests/auth.test.js
```

## Catatan

Harga dari Yahoo Finance bisa tertunda dan bukan data resmi bursa. Aplikasi ini alat pencatatan pribadi, bukan saran investasi.
