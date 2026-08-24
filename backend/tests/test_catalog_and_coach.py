"""Offline unit tests for Seller Catalog parsing and coach grounding.

No network. Live link tests are gated behind RUN_LIVE_PARSE=1 so judges stay offline.
Run: pytest backend/tests/test_catalog_and_coach.py
"""
import asyncio
import os

import pytest

from backend.app.catalog_parse import (
    clean_name,
    extract_first_price,
    normalize_price,
    parse_share_text,
    promo_from_description,
)
from backend.app.coach import MockCoach, pick_product


# ---------------------------------------------------------------- price helpers
def test_normalize_price_trims_punctuation():
    assert normalize_price("Rp1.000.000,") == "Rp1.000.000"
    assert normalize_price("  Rp99.000. ") == "Rp99.000"


def test_extract_first_price():
    assert extract_first_price("Beli sekarang Rp99.000 sisa 3!") == "Rp99.000"
    assert extract_first_price("harga 150k aja kak") is None


def test_promo_keywords_from_description():
    desc = "Ada Gratis Ongkir, Promo COD, & Cashback. Cek Review Produk."
    promo = promo_from_description(desc)
    assert promo
    assert "gratis ongkir" in promo
    assert "cod" in promo
    assert promo_from_description("Cek Review Produk Terlengkap.") is None


def test_clean_name_strips_jual_prefix():
    assert clean_name("Jual FRAME KACAMATA MOSCOTT").startswith("FRAME")
    assert clean_name("Kaos Oversize Hitam") == "Kaos Oversize Hitam"
    assert clean_name("  Jual   Hoodie   Cream ") == "Hoodie Cream"


# ---------------------------------------------------------------- share-text parse (offline, deterministic)
def test_parse_share_text_full_blob():
    blob = "Kaos Oversize Hitam Rp99.000 https://vt.tokopedia.com/t/ZS9BRhoHp6Vgc-mhs03/"
    out = parse_share_text(blob)
    assert out["name"] == "Kaos Oversize Hitam"
    assert out["price"] == "Rp99.000"
    assert out["url"].startswith("https://vt.tokopedia.com/")


def test_parse_share_text_no_url():
    out = parse_share_text("Hoodie Cream - Rp149.000")
    assert out["name"] == "Hoodie Cream"
    assert out["price"] == "Rp149.000"
    assert "url" not in out


def test_parse_share_text_empty():
    assert parse_share_text("") == {}
    assert parse_share_text(None) == {}


# ---------------------------------------------------------------- coach grounding (deterministic)
def test_mock_coach_grounds_on_seller_products():
    coach = MockCoach()
    inputs = {
        "total": 10,
        "window_seconds": 10,
        "clusters": [{"label": "harga", "count": 6, "share": 0.6}],
        "top": {
            "label": "harga",
            "label_id": "Harga",
            "count": 6,
            "share": 0.6,
            "urgency_weight": 0.8,
            "sample_comments": ["kak harga berapa?"],
        },
        "flood_pressure": 0.2,
        "urgency": 70,
    }
    products = [{"name": "Kaos Oversize Hitam", "price": "99k", "promo": "free ongkir Jawa"}]
    card = asyncio.run(coach.generate(inputs, products=products))
    assert card["engine"] == "template"
    assert "Kaos Oversize Hitam" in card["suggested_reply"]
    assert "99k" in card["suggested_reply"]
    assert "free ongkir Jawa" in card["suggested_reply"]


def test_mock_coach_without_products_uses_frozen_catalog():
    coach = MockCoach()
    inputs = {
        "total": 4,
        "window_seconds": 10,
        "clusters": [{"label": "stok", "count": 2, "share": 0.5}],
        "top": {
            "label": "stok",
            "label_id": "Stok",
            "count": 2,
            "share": 0.5,
            "urgency_weight": 0.9,
            "sample_comments": ["stok ada kak?"],
        },
        "flood_pressure": 0.1,
        "urgency": 55,
    }
    card = asyncio.run(coach.generate(inputs, products=None))
    # frozen demo catalog first product is Kaos Oversize Hitam; template engine still speaks
    assert card["engine"] == "template"
    assert card["suggested_reply"]
    assert "Stok" in card["why_now"] or "stok" in card["why_now"]


def test_pick_product_prefers_price_for_harga_and_stock_for_stok():
    products = [
        {"name": "Hoodie Cream", "price": None, "stock": None},
        {"name": "Celana Cargo", "price": "129k", "stock": 7},
    ]
    assert pick_product(products, "harga")["name"] == "Celana Cargo"
    assert pick_product(products, "stok")["name"] == "Celana Cargo"
    assert pick_product(products, "ongkir")["name"] == "Hoodie Cream"  # fallback: first product
    assert pick_product([], "harga") is None


# ---------------------------------------------------------------- live link parse (opt-in only, never on judge machines)
@pytest.mark.skipif(
    os.environ.get("RUN_LIVE_PARSE", "0") != "1",
    reason="live network test; set RUN_LIVE_PARSE=1 to run against real share links",
)
def test_live_shopee_link_parses_name_and_price():
    from backend.app.catalog_parse import parse_catalog

    res = asyncio.run(parse_catalog(url="https://id.shp.ee/i4befBuF", text=None))
    assert res.name
    assert not res.name.lower().startswith("jual ")
    assert res.price and res.price.startswith("Rp")
    assert res.parse_source == "link"
    assert "stock" in res.needs_manual


@pytest.mark.skipif(
    os.environ.get("RUN_LIVE_PARSE", "0") != "1",
    reason="live network test; set RUN_LIVE_PARSE=1 to run against real share links",
)
def test_live_tokopedia_link_parses_name_image_only():
    from backend.app.catalog_parse import parse_catalog

    res = asyncio.run(parse_catalog(url="https://vt.tokopedia.com/t/ZS9BRhoHp6Vgc-mhs03/", text=None))
    assert res.name
    assert res.image_url
    assert res.parse_source == "link"
    assert set(res.needs_manual) >= {"price", "promo", "stock"}
