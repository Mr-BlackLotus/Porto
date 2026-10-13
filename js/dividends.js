/*
 * Porto — data dividen resmi per emiten (kunci "PASAR:KODE").
 * Dihimpun dari pemberitaan pengumuman resmi emiten dan bursa, bukan umpan data langsung: periksa tanggal asli
 * di keterbukaan informasi emiten/IDX sebelum bertransaksi. Perbarui file ini bila ada pengumuman baru.
 *   items  : dividen yang sudah diumumkan. cum/ex/pay = YYYY-MM-DD, dps = rupiah per lembar.
 *   planned: rencana pembagian yang nominal/tanggalnya belum ditetapkan ({ periode: 'YYYY-MM', note }).
 */
window.PORTO_DIV = {
  'ID:BBCA': {
    nama: 'Bank Central Asia Tbk',
    asOf: '2026-10-13',
    sumber: [
      { t: 'Ajaib: riwayat dividen BBCA', u: 'https://ajaib.co.id/saham/aset/BBCA/dividen' },
      { t: 'Bisnis.com: dividen interim BCA tahun buku 2025', u: 'https://finansial.bisnis.com/read/20251124/90/1931316/jadwal-pembagian-dividen-interim-bca-tahun-buku-2025-siap-cair-rp55-per-saham' },
      { t: 'Kontan MoneySmart: dividen interim Rp25, cum date 28 Agustus 2026', u: 'https://momsmoney.kontan.co.id/news/catat-bbca-bagikan-dividen-interim-rp-25-per-saham-cum-date-28-agustus-2026' },
      { t: 'Ajaib: rencana dividen interim Desember 2026', u: 'https://ajaib.co.id/belajar/berita/bbca-akan-bagi-dividen-interim-lagi-desember-2026' }
    ],
    items: [
      { cum: '2024-11-20', ex: '2024-11-21', pay: '2024-12-11', dps: 50, jenis: 'Interim' },
      { cum: '2025-03-20', ex: '2025-03-21', pay: '2025-04-11', dps: 250, jenis: 'Final' },
      { cum: '2025-12-02', ex: '2025-12-03', pay: '2025-12-22', dps: 55, jenis: 'Interim' },
      { cum: '2026-03-27', ex: '2026-03-30', pay: '2026-04-08', dps: 281, jenis: 'Final' },
      { cum: '2026-06-15', ex: '2026-06-17', pay: '2026-06-26', dps: 20, jenis: 'Interim' },
      { cum: '2026-08-28', ex: '2026-08-31', pay: '2026-09-16', dps: 25, jenis: 'Interim' }
    ],
    planned: [
      { periode: '2026-12', note: 'Dividen interim berikutnya direncanakan Desember 2026; nominal dan tanggal belum ditetapkan.' }
    ]
  }
};
