from __future__ import annotations

import io
import wave

import numpy as np
from fastapi.testclient import TestClient

from vrm_viewer.app import create_app
from vrm_viewer.tts import pcm_to_wav


class FakeTTS:
    def synthesize(self, text: str, voice: str, speed: float) -> bytes:
        assert text == "Hello"
        assert voice == "expressive"
        assert speed == 1.1
        return pcm_to_wav(np.zeros(240, dtype=np.float32), 24_000)


def test_health_and_static_viewer() -> None:
    client = TestClient(create_app(FakeTTS()))
    assert client.get("/api/health").json()["status"] == "ok"
    page = client.get("/")
    assert page.status_code == 200
    assert "VRM VIEWER" in page.text
    assert client.get("/models/avatar.vrm").content[:4] == b"glTF"
    assert client.get("/models/idle.vrma").content[:4] == b"glTF"


def test_tts_returns_valid_wav() -> None:
    client = TestClient(create_app(FakeTTS()))
    response = client.post(
        "/api/tts", json={"text": "Hello", "voice": "expressive", "speed": 1.1}
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    with wave.open(io.BytesIO(response.content), "rb") as wav:
        assert wav.getframerate() == 24_000
        assert wav.getnchannels() == 1
        assert wav.getnframes() == 240


def test_tts_rejects_blank_text() -> None:
    client = TestClient(create_app(FakeTTS()))
    assert client.post("/api/tts", json={"text": "   "}).status_code == 422


def test_tts_rejects_unknown_voice() -> None:
    client = TestClient(create_app(FakeTTS()))
    response = client.post("/api/tts", json={"text": "Hello", "voice": "unknown"})
    assert response.status_code == 422
