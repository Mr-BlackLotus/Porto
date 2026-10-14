/*
 * Porto — analisis per emiten, disusun Claude dari sumber publik pada tanggal tertentu.
 * Bukan umpan data langsung dan bukan saran investasi. Untuk memperbarui: tekan "Perbarui analisis"
 * di halaman emiten, tempel perintah yang tersalin ke chat Claude, lalu berkas ini diperbarui.
 */
window.PORTO_ANALISA = {
  'ID:BBCA': {
    tanggal: '2026-10-13',
    hargaRujukan: { nilai: 6225, tanggal: '2026-09-28', sumber: 'Penutupan 28 Sep 2026 (Romisaputra)' },
    keyakinan: 'Sedang',
    pertumbuhan: { periode: '8 bulan 2026 dibanding 2025', laba: 2.85, ket: 'Laba bersih Rp40,17 T; semester I hanya +1,7% dan Agustus +13,1%. Pendapatan bunga bersih hampir datar.' },
    ringkasan: 'Bank berkualitas tinggi (ROE sekitar 24%, NPL 1,9%, dana murah) yang harganya sudah turun jauh dari awal tahun, sementara laba hanya tumbuh 2–3% karena margin bunga tertekan. Margin mulai pulih sejak Juli, ada buyback dan dividen interim triwulanan. Dari sisi nilai dan dividen menarik untuk dikumpulkan bertahap; dari sisi pergerakan harga tren masih turun dan aliran asing belum konsisten.',
    rekomendasi: {
      keseluruhan: { label: 'Akumulasi bertahap', tone: 'good', catatan: 'Bagi pembelian dalam 3 tahap, bukan sekaligus. Nilai dan dividen mendukung, momentum harga belum.' },
      value: { label: 'Beli bertahap', tone: 'good', alasan: [
        'PER ke depan sekitar 12–13x pada estimasi laba 2026 Rp489 per lembar, di bawah kelipatan yang tersirat dari target analis (16,7x sampai 20,8x).',
        'ROE 24,1% dan NPL turun ke 1,9% menunjukkan kualitas usaha yang masih kuat.',
        'Konsensus analis 35 Buy, 2 Hold, 0 Sell. Target UOB Kay Hian Rp8.150 dan Verdhana Rp10.100; target BRI Danareksa Rp10.900 (April) kemungkinan sudah usang karena harga turun.',
        'Pertumbuhan laba lambat (1S 2026 +1,7%), jadi margin pengaman diperlukan dan jangan masuk sekaligus.'
      ] },
      dividen: { label: 'Menarik', tone: 'good', alasan: [
        'Dividen kini dibayar triwulanan (Rp20 Juni, Rp25 September; Desember direncanakan). Bagian terbesar tetap dividen final sekitar Maret (Rp281 pada 2026).',
        'Jendela 3 bulan sebelum dividen final berikutnya sekitar Desember sampai Maret, jadi masih ada waktu mengumpulkan sebelum cum date.',
        'Imbal dividen 12 bulan terakhir tampil di panel dividen dengan harga sekarang.'
      ] },
      trader: { label: 'Tunggu konfirmasi', tone: 'warn', alasan: [
        'Tren turun sejak awal 2026; harga sempat di bawah Rp7.000 untuk pertama kali sejak 2021. Level dukungan yang dilaporkan 28 September: Rp6.208 dan Rp6.192.',
        'Aliran asing berubah: net buy Rp128 miliar pada 24–28 September, tetapi BBCA termasuk saham yang banyak dilepas asing pada 12 Oktober.',
        'Buyback hingga Rp5 triliun memberi bantalan. Sinyal masuk bagi trader: harga bertahan di atas dukungan dan net buy asing beruntun; pasang batas rugi di bawah dukungan.'
      ] }
    },
    input: { eps: 489, kelipatan: [
      { label: 'Konservatif', per: 14, ket: 'Asumsi Claude, di bawah kelipatan target analis' },
      { label: 'Setara target UOB Kay Hian', per: 16.7, ket: 'Rp8.150 dibagi EPS 489' },
      { label: 'Setara target Verdhana', per: 20.8, ket: 'Rp10.100, PER 2026 yang disebut Verdhana' }
    ] },
    metrik: [
      { k: 'Laba bersih 1S 2026', v: 'Rp29,5 T, +1,7% y/y' },
      { k: 'Laba bersih 8 bulan 2026', v: 'Rp40,17 T, +2,85% y/y (Agustus Rp4,92 T, +13,1%)' },
      { k: 'NIM', v: '5,3% (1S), turun dari 5,8%; Juli 5,5% naik dari 5,2% di Juni' },
      { k: 'NPL', v: '1,9% (1S), turun dari 2,2%' },
      { k: 'ROE', v: '24,1% (1S), turun dari 25,2%' },
      { k: 'Biaya kredit', v: '0,3% pada Juli, dari 0,5% pada Juni' },
      { k: 'Kredit', v: 'Sekitar Rp1.000 T, +8% y/y (Juli)' },
      { k: 'CASA', v: '84,7% (Q1 2026)' },
      { k: 'Estimasi laba per lembar 2026', v: 'Rp489 (konsensus Bloomberg)' }
    ],
    katalis: [
      'Margin bunga (NIM) mulai pulih: 5,5% pada Juli dari 5,2% pada Juni.',
      'Biaya kredit turun ke 0,3% sehingga beban pencadangan mengecil.',
      'Buyback hingga Rp5 triliun (periode 12 Maret 2026 sampai 11 Maret 2027).',
      'Direksi dan komisaris membeli saham pada Maret 2026 di kisaran Rp6.750–6.982.',
      'Dividen interim triwulanan dan dividen final yang besar sekitar Maret.'
    ],
    risiko: [
      'Laba hanya tumbuh 2–3% dan pendapatan bunga bersih hampir datar.',
      'NIM masih di bawah tahun lalu; pemulihan perlu dibuktikan beberapa bulan lagi.',
      'Aliran asing mudah berbalik bila sentimen global memburuk; rupiah ikut berpengaruh.',
      'Kredit konsumer menyusut pada Q1 2026 dan sebagian segmen ritel masih tertekan.',
      'Harga sudah turun lebih dari seperempat dari puncaknya, tren belum terkonfirmasi berbalik.'
    ],
    aksi: [
      'Buyback saham hingga Rp5 triliun (disetujui RUPS tahun buku 2025), dilanjutkan sejak 11 Juni 2026.',
      'Dividen final tahun buku 2025 Rp281 (cum 27 Maret 2026); interim 2026 Rp20 (cum 15 Juni) dan Rp25 (cum 28 Agustus).',
      'Dividen interim berikutnya direncanakan Desember 2026; nominal dan tanggal belum ditetapkan.'
    ],
    berita: [
      { t: 'IHSG anjlok, asing jual Rp166,22 miliar, saham BUMI dan BBCA banyak dilepas (judul)', u: 'https://money.kompas.com/read/2026/10/12/132454526/ihsg-anjlok-asing-jual-rp-16622-miliar-saham-bumi-dan-bbca-banyak-dilepas', tgl: '2026-10-12' },
      { t: 'Saham BCA tetap diminati, investor cermati peluang penguatan (asing net buy 24–28 Sep, target UOB dan Verdhana)', u: 'https://www.romisaputra.com/2026/10/saham-bca-bbca-tetap-diminati-investor-cermati-peluang-penguatan.html', tgl: '2026-09-28' },
      { t: 'Laba BCA Juli 2026 tumbuh 5%, NIM mulai pulih', u: 'https://pasardana.id/news/2026/8/19/laba-bca-juli-2026-tumbuh-5-nim-mulai-pulih', tgl: '2026-08-19' },
      { t: 'Kinerja BBCA 1H: laba tumbuh tipis di tengah kompresi NIM', u: 'https://www.rikopedia.com/2026/07/kinerja-bbca-1h-laba-tumbuh-tipis-di.html', tgl: '2026-07-29' },
      { t: 'BCA lanjutkan aksi korporasi buyback saham Rp5 triliun', u: 'https://www.idxchannel.com/market-news/bca-bbca-lanjutkan-aksi-korporasi-buyback-saham-rp5-triliun', tgl: '2026-06-11' },
      { t: 'BBCA jebol di cum date, direksi borong di bawah Rp7.000', u: 'https://www.kabarbursa.com/market-hari-ini/bbca-jebol-di-cum-date-direksi-borong-di-bawah-rp7000', tgl: '2026-03-28' },
      { t: 'Target harga saham BBCA direvisi menjadi Rp10.900 (BRI Danareksa)', u: 'https://www.suara.com/bisnis/2026/04/27/071412/target-harga-saham-bca-berubah-jadi-segini', tgl: '2026-04-27' }
    ],
    catatanData: 'Angka diambil dari pemberitaan; beberapa artikel tidak lengkap atau tidak konsisten (misalnya tanggal laporan BRI Danareksa). Data broker summary (AK, BK, dan lainnya) tidak termasuk.'
  }
};
