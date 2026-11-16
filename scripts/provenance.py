#!/usr/bin/env python3
"""Reproduce the similarity scores in PROVENANCE.md (stdlib only).

usage: python3 scripts/provenance.py <path-to-clone-of-hafiznaveedchuhan-ctrl/my-email-studio>

Clone his repo at the commit named in PROVENANCE.md first:
  git clone https://github.com/hafiznaveedchuhan-ctrl/my-email-studio /tmp/nv-src
  git -C /tmp/nv-src checkout a18df62c8d8250b98fbdcae7f6506f76abf40bed

Each file in this repo is paired with its counterpart by path, after the renames below.
Score = difflib.SequenceMatcher(None, his_text, this_text, autojunk=False).ratio(), 0..1.
A file with no counterpart is listed as added here. A score is a text-overlap measure, not a
judgement of who had which idea: every paired file started as his, whatever its score.
"""
import difflib
import pathlib
import subprocess
import sys

RENAMES = [
    ("spice-circle-launch", "steep-club-launch"),
    ("01-get-the-pan-warm", "01-the-kettles-on"),
    ("03-rafis-tuesday-rule", "03-minas-ritual"),
    ("/home-cooks/", "/regulars/"),
]
MOVED = {
    "studio-kit/review/schema.json": "review/schema.json",
    "studio-kit/hooks/send-guard.mjs": ".claude/hooks/send-guard.mjs",
}


def counterpart(path: str) -> str:
    for a, b in RENAMES:
        path = path.replace(a, b)
    return MOVED.get(path, path)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    theirs = pathlib.Path(sys.argv[1])
    ours = pathlib.Path(__file__).resolve().parent.parent
    files = subprocess.check_output(["git", "-C", str(ours), "ls-files"], text=True).split()
    for f in sorted(files):
        other = theirs / counterpart(f)
        if other.is_file():
            a = other.read_text(encoding="utf-8", errors="ignore")
            b = (ours / f).read_text(encoding="utf-8", errors="ignore")
            print(f"{difflib.SequenceMatcher(None, a, b, autojunk=False).ratio():.2f}\t{f}")
        else:
            print(f"added\t{f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
