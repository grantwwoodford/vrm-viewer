from __future__ import annotations

import io
import threading
import wave

import numpy as np

VOICES = {
    "default": "af_heart",
    "late_night": "af_nicole",
    "expressive": "af_bella",
}

INSTALL_HINT = (
    "Kokoro is not installed. Install espeak-ng, then run "
    '`pip install -e ".[kokoro]"`.'
)


class KokoroTTS:
    """Lazy, process-local Kokoro pipeline with serialized inference."""

    sample_rate = 24_000

    def __init__(self) -> None:
        self._pipeline = None
        self._lock = threading.Lock()

    def _get_pipeline(self):
        if self._pipeline is not None:
            return self._pipeline
        try:
            from kokoro import KPipeline
        except ImportError as exc:
            raise RuntimeError(INSTALL_HINT) from exc
        self._pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
        return self._pipeline

    def synthesize(self, text: str, voice: str = "default", speed: float = 1.0) -> bytes:
        voice_name = VOICES.get(voice, voice)
        with self._lock:
            parts: list[np.ndarray] = []
            for result in self._get_pipeline()(text, voice=voice_name, speed=speed):
                audio = result[-1] if isinstance(result, tuple) else result.audio
                if hasattr(audio, "detach"):
                    audio = audio.detach().cpu().numpy()
                parts.append(np.asarray(audio, dtype=np.float32).reshape(-1))

        samples = np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)
        return pcm_to_wav(samples, self.sample_rate)


def pcm_to_wav(samples: np.ndarray, sample_rate: int) -> bytes:
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2", copy=False)
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm.tobytes())
    return output.getvalue()
