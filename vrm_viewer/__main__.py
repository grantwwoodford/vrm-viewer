from __future__ import annotations

import argparse

import uvicorn

from .app import create_app


def main() -> None:
    parser = argparse.ArgumentParser(prog="vrm-viewer")
    parser.add_argument("--window", action="store_true", help="open a transparent desktop window")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8768, type=int)
    args = parser.parse_args()

    if args.window:
        from .window import run_window

        run_window(args.host, args.port)
        return

    print(f"VRM Viewer: http://{args.host}:{args.port}")
    uvicorn.run(create_app(), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
