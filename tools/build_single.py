#!/usr/bin/env python3
"""Inline the CSS and JS of index.html into one self-contained file.

    python3 tools/build_single.py                 -> dist/jarvis.html (standalone)
    python3 tools/build_single.py --fragment      -> dist/jarvis.fragment.html
                                                     (no doctype/html/head/body —
                                                      for hosts that supply their own)
"""
import argparse
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "index.html"
OUT_DIR = ROOT / "dist"

LINK_RE = re.compile(r'[ \t]*<link[^>]+href="([^"]+\.css)"[^>]*>\s*')
SCRIPT_RE = re.compile(r'[ \t]*<script src="([^"]+\.js)"></script>\s*')


def read(rel: str) -> str:
    path = ROOT / rel
    if not path.exists():
        sys.exit(f"missing asset: {rel}")
    return path.read_text(encoding="utf-8").rstrip()


def inline(html: str) -> str:
    html = LINK_RE.sub(lambda m: f"<style>\n{read(m.group(1))}\n</style>\n", html)
    html = SCRIPT_RE.sub(lambda m: f"<script>\n{read(m.group(1))}\n</script>\n", html)
    return html


def to_fragment(html: str) -> str:
    """Strip the document skeleton, keeping <title>, <style> and body content."""
    title = re.search(r"<title>(.*?)</title>", html, re.S)
    head = re.search(r"<head>(.*?)</head>", html, re.S)
    body = re.search(r"<body>(.*?)</body>", html, re.S)
    if not (head and body):
        sys.exit("could not locate <head>/<body> to build a fragment")
    styles = "\n".join(re.findall(r"<style>.*?</style>", head.group(1), re.S))
    parts = []
    if title:
        parts.append(f"<title>{title.group(1)}</title>")
    if styles:
        parts.append(styles)
    parts.append(body.group(1).strip())
    return "\n".join(parts) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--fragment", action="store_true",
                    help="emit a body-only fragment instead of a full document")
    args = ap.parse_args()

    html = inline(SRC.read_text(encoding="utf-8"))
    name = "jarvis.fragment.html" if args.fragment else "jarvis.html"
    out = OUT_DIR / name
    OUT_DIR.mkdir(exist_ok=True)
    out.write_text(to_fragment(html) if args.fragment else html, encoding="utf-8")
    print(f"{out.relative_to(ROOT)}  ({out.stat().st_size / 1024:.1f} kb)")


if __name__ == "__main__":
    main()
