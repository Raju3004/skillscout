"""Light heuristics for pulling an identity out of resume text: a display
name (for the candidate row) and, if present, a GitHub username -- used to
link a resume to an existing GitHub-discovered candidate so the dual-score
view has something to compare against.
"""

from __future__ import annotations

import re

GITHUB_URL_RE = re.compile(r"github\.com/([A-Za-z0-9-]+)", re.IGNORECASE)


def extract_github_username(resume_text: str) -> str | None:
    match = GITHUB_URL_RE.search(resume_text)
    if not match:
        return None
    username = match.group(1).strip("/")
    if username.lower() in {"orgs", "sponsors", "settings", "search", "about"}:
        return None
    return username


def extract_candidate_name(resume_text: str, fallback: str) -> str:
    for line in resume_text.splitlines():
        line = line.strip()
        if not line:
            continue
        if len(line) > 60 or "@" in line or any(ch.isdigit() for ch in line):
            continue
        words = line.split()
        if 1 <= len(words) <= 4:
            return line
        break
    return fallback
