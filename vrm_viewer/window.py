from __future__ import annotations

import os
import socket
import threading
import time

import uvicorn

from .app import create_app


def _port_is_open(host: str, port: int) -> bool:
    probe_host = "127.0.0.1" if host in ("", "0.0.0.0") else host
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        return sock.connect_ex((probe_host, port)) == 0


def run_window(host: str, port: int) -> None:
    if _port_is_open(host, port):
        raise SystemExit(f"Port {port} is already in use")

    os.environ.setdefault("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
    os.environ.setdefault("QT_API", "pyqt6")
    try:
        import PyQt6.QtWebEngineWidgets  # noqa: F401
        import webview
    except ImportError as exc:
        raise SystemExit('Desktop mode requires `pip install -e ".[desktop]"`') from exc

    errors: list[BaseException] = []

    def serve() -> None:
        try:
            uvicorn.Server(
                uvicorn.Config(create_app(), host=host, port=port, log_level="warning")
            ).run()
        except BaseException as exc:
            errors.append(exc)

    server = threading.Thread(target=serve, daemon=True)
    server.start()
    deadline = time.monotonic() + 30
    while not _port_is_open(host, port):
        if errors or not server.is_alive():
            raise SystemExit(f"Server failed to start: {errors[0] if errors else 'stopped'}")
        if time.monotonic() >= deadline:
            raise SystemExit("Server did not start within 30 seconds")
        time.sleep(0.1)

    url_host = "127.0.0.1" if host in ("", "0.0.0.0") else host
    webview.create_window(
        "VRM Viewer",
        f"http://{url_host}:{port}/?desktop=1",
        width=520,
        height=760,
        frameless=True,
        transparent=True,
        on_top=True,
        resizable=True,
        easy_drag=False,
    )
    webview.start(gui="qt", private_mode=False)
