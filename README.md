# Standalone VRM Viewer

A focused VRM viewer extracted from the 3D world companion reference implementation. It contains no STT, LLM, chat history, tools, or companion state. Typed text is synthesized locally with Kokoro and played through an audio analyser that drives the avatar's mouth.

## Features

- VRM 0.x/1.0 rendering with `three-vrm`
- Bundled idle VRMA plus procedural blinking and eye saccades
- Ten selectable emotion blends
- Kokoro-82M TTS with three voice presets and adjustable speed
- Audio-amplitude lip sync driven from the audio actually playing
- Local `.vrm` and `.vrma` file loading
- Responsive browser UI and a frameless transparent desktop mode

Lip sync is amplitude-based mouth opening, not phoneme-level visemes.

## Install

Python 3.11 or newer and `espeak-ng` are required for Kokoro.

```bash
sudo apt-get install espeak-ng
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[kokoro]"
```

Kokoro downloads `hexgrad/Kokoro-82M` and voice assets on the first speech request.

## Browser Mode

```bash
vrm-viewer
```

Open <http://127.0.0.1:8768>. To expose it on your LAN, use `vrm-viewer --host 0.0.0.0`.

## Desktop Mode

```bash
pip install -e ".[kokoro,desktop]"
vrm-viewer --window
```

Desktop mode opens the same application in an always-on-top, transparent pywebview window. Hover the avatar to reveal speech controls. On Linux, the Qt dependencies provide the preferred Chromium renderer.

## Development

```bash
pip install -e ".[test]"
pytest
```

The frontend is browser-native ES modules, so there is no Node.js build step.

## Assets And Attribution

The bundled `AvatarSample_B` model is from the VRoid Project and is redistributable under its VRoid Hub model license settings. Replace it at runtime with **Load VRM**.

The rendering code is adapted from the repository's `04-3d-world-companion` reference implementation. Vendored Three.js and Pixiv VRM libraries retain their upstream license headers; see `THIRD_PARTY_NOTICES.md`.
