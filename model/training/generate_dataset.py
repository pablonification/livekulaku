"""Generate the frozen synthetic intent dataset used for IndoBERT fine-tuning.

The sentence templates were produced with an LLM-assisted synthetic generation
pass and are deterministic. Rows marked review_required form a stratified 10
percent sample for human review.
"""
from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "data" / "demo_comments.jsonl"

TEMPLATES = {
    "harga": [
        "kak harga produknya berapa",
        "spill harga dong min",
        "ini harganya berapaan",
        "boleh info harga satuannya",
        "berapa duit buat satu barang",
        "banderolnya berapa ya",
        "kalau beli satu kena berapa",
        "budget yang perlu disiapkan berapa",
        "seratus ribu dapat berapa pcs",
        "nominal di keranjang sudah benar belum",
        "harga live hari ini berapa",
        "ada harga khusus pas live tidak",
        "minta rincian harga produknya",
        "berapa yang harus dibayar untuk item ini",
        "uang segitu dapat satu atau dua",
        "di layar belum kelihatan harganya",
        "berapa kak aku mau hitung budget",
        "nilai barang ini berapa ya",
        "cek harga varian hitam dong",
        "harga setelah promo jadi berapa",
    ],
    "bandingkan_harga": [
        "kok lebih mahal dari toko sebelah",
        "di lapak lain harganya lebih rendah",
        "punya tetangga cuma tujuh puluh ribu",
        "kenapa selisihnya jauh sama marketplace lain",
        "produk serupa di sana lebih murah",
        "bisa samakan harga dengan kompetitor",
        "toko lain kasih harga lebih hemat",
        "aku lihat penjual sebelah diskonnya lebih besar",
        "bedanya apa dengan yang separuh harga",
        "kalau dibanding merek sebelah ini kemahalan",
        "di tiktok shop lain dapat harga lebih kecil",
        "shopee sebelah jual di bawah ini",
        "kenapa harus pilih ini kalau yang lain lebih hemat",
        "boleh price match dengan lapak satunya",
        "selisih harga sama toko lain berapa",
        "yang serupa ada dengan nominal lebih rendah",
        "lapak sebelah kasih bonus di harga yang sama",
        "kompetitor jual paket dua dengan nominal segini",
        "aku sedang membandingkan dengan produk lain",
        "lebih untung beli ini atau produk sebelah",
    ],
    "ongkir": [
        "ongkir ke medan berapa kak",
        "biaya kirim menuju bandung berapa",
        "ada gratis ongkos pengiriman tidak",
        "kirim ke luar jawa tambah berapa",
        "berapa biaya antar ke rumah saya",
        "tujuan makassar kena biaya kirim berapa",
        "free ongkirnya berlaku ke daerah mana",
        "pengiriman ke pontianak mahal tidak",
        "cek tarif kirim ke surabaya dong",
        "kalau alamatnya pelosok ada tambahan kirim",
        "voucher bebas ongkos kirim bisa dipakai",
        "ongkos ekspedisinya ditanggung pembeli ya",
        "kirim ke solo habis berapa",
        "biaya pengantaran belum masuk harga ya",
        "ada subsidi pengiriman saat live",
        "alamat luar kota dapat gratis kirim juga",
        "tolong hitung tarif ekspedisi ke bali",
        "pengiriman antarpulau ada biaya tambahan",
        "berapa ongkos sampai ke alamat pembeli",
        "promo kirim gratis minimal belanja berapa",
    ],
    "cod": [
        "bisa cod tidak kak",
        "boleh bayar saat barang datang",
        "ada pembayaran di tempat tidak",
        "aku mau lunasi ketika paket sampai",
        "kurir bisa terima uang tunai",
        "opsi bayar di rumah tersedia ya",
        "kalau tidak punya m banking bisa bayar ke kurir",
        "metode cod berlaku untuk daerahku",
        "pesan sekarang bayarnya nanti saat diterima bisa",
        "aku pilih pembayaran waktu paket tiba",
        "bisa cash on delivery ke bandung",
        "cara aktifkan bayar di tempat bagaimana",
        "kenapa pilihan cod tidak muncul",
        "cod ada biaya penanganan tambahan tidak",
        "semua varian mendukung bayar di lokasi",
        "mau transaksi tunai lewat kurir",
        "paketnya boleh dibayar setelah sampai",
        "pembayaran langsung ke pengantar tersedia",
        "wilayah luar jawa bisa cod juga",
        "kalau cod boleh cek barang dulu tidak",
    ],
    "garansi": [
        "garansinya berapa lama kak",
        "kalau barang rusak bisa retur",
        "ada jaminan produk asli tidak",
        "produk cacat dapat ditukar ya",
        "bagaimana klaim kalau tidak berfungsi",
        "ada perlindungan setelah pembelian",
        "kalau ukuran salah boleh tukar",
        "jaminan uang kembali berlaku tidak",
        "masa perlindungan produknya sampai kapan",
        "barang pecah saat dikirim tanggung jawab siapa",
        "proses pengembalian produk bagaimana",
        "kalau warna keliru bisa diganti",
        "ada kartu garansi dalam paket",
        "kerusakan pabrik ditanggung toko tidak",
        "berapa hari batas pengajuan retur",
        "produk ini dijamin original ya",
        "kalau tidak cocok bisa kembalikan",
        "syarat tukar barang apa saja",
        "jaminan servisnya berlaku di mana",
        "apakah ada garansi resmi merek",
    ],
    "stok": [
        "stoknya masih ada kak",
        "warna hitam ready tidak",
        "barang ini tersedia sekarang",
        "ukuran besar masih kebagian tidak",
        "kapan varian biru tersedia lagi",
        "persediaannya tinggal berapa",
        "semua ukuran masih lengkap",
        "yang motif polos sudah habis ya",
        "restock lagi tanggal berapa",
        "masih bisa pesan varian merah",
        "item di etalase masih tersedia",
        "jumlah barangnya masih banyak tidak",
        "aku takut kehabisan produknya",
        "size xl masih dapat tidak",
        "persediaan warna putih aman kak",
        "yang dipakai host masih ada barangnya",
        "varian ini kosong atau tersedia",
        "kapan kiriman stok berikutnya datang",
        "masih tersisa untuk pembeli sekarang",
        "boleh cek ketersediaan ukuran medium",
    ],
    "checkout": [
        "aku mau checkout satu kak",
        "langsung co sekarang ya",
        "mau beli varian hitam",
        "tolong sisihkan dua untuk aku",
        "aku ambil satu ukuran medium",
        "cara pesan barang yang dipakai host",
        "sudah masuk keranjang tinggal bayar",
        "aku jadi order produknya",
        "bantu arahkan untuk menyelesaikan pembelian",
        "fix beli satu warna putih",
        "aku pesan dua paket sekarang",
        "langsung amankan satu buat saya",
        "klik yang mana untuk membeli",
        "mau lanjut ke pembayaran sekarang",
        "tolong buatkan pesanan satu item",
        "aku sudah yakin mau ambil produk ini",
        "siap transaksi untuk varian merah",
        "masukkan satu ke pesanan saya",
        "aku jadi borong tiga buah",
        "boleh bantu checkout dari keranjang",
    ],
    "browse": [
        "halo kak baru gabung live",
        "produknya lucu banget",
        "aku lihat lihat dulu ya",
        "hostnya semangat banget",
        "warna yang dipakai cantik",
        "baru lewat di beranda",
        "suaranya jelas kak",
        "boleh tunjukkan bagian belakang",
        "bahannya terlihat lembut",
        "aku sedang nonton dari jakarta",
        "modelnya cocok untuk acara santai",
        "live malam ini ramai sekali",
        "coba dekatkan produknya ke kamera",
        "motifnya menarik kak",
        "aku tag teman dulu",
        "host coba pakai warna biru",
        "kemasannya kelihatan rapi",
        "aku baru kenal merek ini",
        "semoga livenya lancar",
        "jelaskan bahannya dong kak",
    ],
}

SUFFIXES = ("", " ya", " dong", " min", " kak")


def build_rows() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    sequence = 0
    for label, templates in TEMPLATES.items():
        if len(templates) != 20:
            raise ValueError(f"{label} must have exactly 20 templates")
        for template_index, template in enumerate(templates):
            split = "train" if template_index < 16 else "validation" if template_index < 18 else "test"
            for suffix in SUFFIXES:
                sequence += 1
                rows.append(
                    {
                        "user": f"demo_{sequence:03d}",
                        "text": f"{template}{suffix}",
                        "platform": "tiktok" if sequence % 2 else "shopee",
                        "delay_ms": 280 + (sequence % 6) * 40,
                        "label": label,
                        "split": split,
                        "review_required": sequence % 10 == 0,
                        "review_status": "pending" if sequence % 10 == 0 else "not_sampled",
                    }
                )
    return rows


def main() -> None:
    rows = build_rows()
    if len(rows) != 800:
        raise ValueError(f"expected 800 rows, got {len(rows)}")
    with OUTPUT.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {len(rows)} rows to {OUTPUT}")


if __name__ == "__main__":
    main()
