"""Drift guard: contracts/openapi.yaml examples must parse as schemas.py

Run: pytest backend/tests/test_contract.py
If this fails, contracts/openapi.yaml and backend/app/schemas.py drifted - fix yaml first.
"""

def test_openapi_example_parses():
    # Examples copied from contracts/openapi.yaml - keep them in sync manually.
    # (Avoids adding PyYAML just for this check)
    example_req = {
        "source": "mock",
        "window_seconds": 10,
        "products": [
            {"name": "Kaos Oversize Hitam", "price": "99k", "promo": "free ongkir Jawa", "stock": 42},
        ],
        "comments": [
            {"user": "budi_99", "text": "kak harga berapa?", "platform": "tiktok", "ts": 1710000000},
            {"user": "sari", "text": "ongkir ke medan berapa kak?", "platform": "shopee", "ts": 1710000001},
        ],
    }
    example_res = {
        "total": 18,
        "window_seconds": 10,
        "clusters": [{"label": "harga", "count": 9, "share": 0.5}, {"label": "ongkir", "count": 5, "share": 0.28}],
        "top_cluster": {"label": "harga", "label_id": "Harga", "count": 9, "share": 0.5, "samples": ["kak harga berapa?", "spill harga dong"]},
        "urgency": 82,
        "suggested_reply": "Harga Kaos Oversize 99k free ongkir Jawa kak - langsung checkout biar kebagian!",
        "why_now": "9 dari 18 komen window ini nanya harga - jawab sekarang sebelum pindah live lain.",
        "tone": "closing",
        "source": "mock",
    }

    from backend.app.schemas import AnalyzeRequest, AnalyzeResponse

    # will raise ValidationError if drifted
    req = AnalyzeRequest(**example_req)
    assert req.source == "mock"
    assert len(req.comments) == 2
    assert req.products[0].name == "Kaos Oversize Hitam"

    res = AnalyzeResponse(**example_res)
    assert res.top_cluster.label == "harga"
    assert 0 <= res.urgency <= 100


def test_suggested_reply_nullable_and_source_enum():
    from backend.app.schemas import AnalyzeResponse

    res = AnalyzeResponse(
        total=0,
        window_seconds=10,
        clusters=[],
        top_cluster=None,
        urgency=0,
        suggested_reply=None,
        why_now="Window kosong.",
        tone="inform",
        source="template",
    )
    assert res.suggested_reply is None


def test_rejects_unknown_source():
    import pytest
    from pydantic import ValidationError

    from backend.app.schemas import AnalyzeResponse

    with pytest.raises(ValidationError):
        AnalyzeResponse(
            total=0,
            window_seconds=10,
            clusters=[],
            top_cluster=None,
            urgency=0,
            why_now="x",
            source="tiktok",  # live fetch statuses use contract enum values, never platform names
        )


def test_catalog_parse_examples_parse():
    from backend.app.schemas import CatalogParseRequest, CatalogParseResponse

    req = CatalogParseRequest(url="https://id.shp.ee/i4befBuF")
    assert req.url.startswith("https://")

    res = CatalogParseResponse(
        name="POCO X8 Pro Series",
        price=None,
        promo=None,
        stock=None,
        image_url="https://example.com/img.webp",
        parse_source="link",
        needs_manual=["price", "promo", "stock"],
    )
    assert res.parse_source == "link"
