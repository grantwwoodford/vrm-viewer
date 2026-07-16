from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Literal, Protocol

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .tts import KokoroTTS, VOICES

WEB_DIR = Path(__file__).parent / "web"


class TTSService(Protocol):
    def synthesize(self, text: str, voice: str, speed: float) -> bytes: ...


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2_000)
    voice: Literal["default", "late_night", "expressive"] = "default"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


def create_app(tts: TTSService | None = None) -> FastAPI:
    app = FastAPI(title="VRM Viewer", docs_url="/api/docs")
    app.state.tts = tts or KokoroTTS()

    @app.get("/api/health")
    async def health() -> dict[str, object]:
        return {"status": "ok", "tts": "lazy", "voices": VOICES}

    @app.post("/api/tts")
    async def synthesize(request: SpeechRequest) -> Response:
        text = request.text.strip()
        if not text:
            raise HTTPException(status_code=422, detail="Text cannot be blank")
        try:
            audio = await asyncio.to_thread(
                app.state.tts.synthesize, text, request.voice, request.speed
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"TTS failed: {exc}") from exc
        return Response(audio, media_type="audio/wav", headers={"Cache-Control": "no-store"})

    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
    return app
