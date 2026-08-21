"""Drift guard: contracts/openapi.yaml examples must parse as schemas.py

Run: pytest backend/tests/test_contract.py
If this fails, contracts/openapi.yaml and backend/app/schemas.py drifted — fix yaml first.
"""

def test_openapi_example_parses():
    # Examples copied from contracts/openapi.yaml — keep them in sync manually.
    # (Avoids adding PyYAML just for this check)
    example_req = {
        "source": "mock",
        "window_seconds": 10,
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
        "suggested_reply": "Harga 99k free ongkir Jawa, luar Jawa +10k kak — langsung checkout biar kebagian!",
        "why_now": "9 dari 18 komen window ini nanya harga — jawab sekarang sebelum pindah live lain.",
        "tone": "closing",
        "source": "mock",
    }

    from livelaku.backend.app.schemas import AnalyzeRequest, AnalyzeResponse

    # will raise ValidationError if drifted
    req = AnalyzeRequest(**example_req)
    assert req.source == "mock"
    assert len(req.comments) == 2

    res = AnalyzeResponse(**example_res)
    assert res.top_cluster.label == "harga"
    assert 0 <= res.urgency <= 100
