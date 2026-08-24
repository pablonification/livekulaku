from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from backend.app.main import app


def test_tiktok_fetched_comments_generate_priority_card() -> None:
    fetched_comments = [
        {"user": "viewer-1", "text": "kak harga berapa?", "platform": "tiktok"},
        {"user": "viewer-2", "text": "spill harga dong", "platform": "tiktok"},
    ]

    with patch(
        "backend.app.main._fetch_tiktok_window",
        new=AsyncMock(return_value=fetched_comments),
    ) as fetch_window:
        response = TestClient(app).post(
            "/api/analyze",
            json={
                "source": "tiktok",
                "handle": "@tokoku",
                "window_seconds": 10,
                "comments": [],
            },
        )

    assert response.status_code == 200
    card = response.json()
    assert fetch_window.await_count == 1
    assert card["total"] == 2
    assert card["top_cluster"]["label"] == "harga"
    assert card["top_cluster"]["count"] == 2
    assert card["top_cluster"]["samples"] == [
        "kak harga berapa?",
        "spill harga dong",
    ]
