"""Resume-based Quality Score -- used when a candidate has no GitHub
profile (e.g. non-software domains like mechanical/civil engineering,
where there's no public code activity to score). Same philosophy as the
GitHub Quality Score: a transparent weighted formula over things
actually found in the text, not a guess, not an API call.

This is a genuinely weaker signal than the GitHub-based Quality Score --
self-reported resume text vs. verifiable public activity -- and callers
should label it as such rather than implying equal confidence.
"""

from __future__ import annotations

import math
import re

CERT_PATTERNS = [
    r"\bcertified\b",
    r"\bcertification\b",
    r"\blicensed\b",
    r"\bP\.?E\.?\b",
    r"\bPMP\b",
    r"\bLEED\b",
    r"\bSix Sigma\b",
    r"\bChartered Engineer\b",
    r"\bCEng\b",
    r"\bAutoCAD\b",
    r"\bSolidWorks\b",
]

DEGREE_PATTERNS: list[tuple[str, float]] = [
    (r"\bPh\.?D\.?\b|\bDoctorate\b", 1.0),
    (r"\bMaster'?s?\b|\bM\.?S\.?\b|\bM\.?Tech\b|\bM\.?E\.?\b|\bMBA\b", 0.75),
    (r"\bBachelor'?s?\b|\bB\.?S\.?\b|\bB\.?Tech\b|\bB\.?E\.?\b", 0.5),
]

YEARS_PATTERN = re.compile(r"(\d{1,2})\+?\s*years?\s+(?:of\s+)?experience", re.IGNORECASE)

# (feature_key, weight, description)
RESUME_QUALITY_WEIGHTS: list[tuple[str, float, str]] = [
    ("experience", 0.45, "Years of experience mentioned in the resume"),
    ("certifications", 0.30, "Professional certifications or licenses mentioned"),
    ("education", 0.25, "Highest education level mentioned"),
]


def _log_scale(value: float, cap: float) -> float:
    if value <= 0:
        return 0.0
    return min(1.0, math.log1p(value) / math.log1p(cap))


def _extract_years(text: str) -> int:
    matches = YEARS_PATTERN.findall(text)
    if not matches:
        return 0
    return max(int(m) for m in matches)


def _count_certifications(text: str) -> int:
    return sum(1 for pattern in CERT_PATTERNS if re.search(pattern, text, re.IGNORECASE))


def _education_score(text: str) -> float:
    for pattern, score in DEGREE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return score
    return 0.0


def compute_resume_quality_score(resume_text: str) -> tuple[float, dict]:
    years = _extract_years(resume_text)
    certs = _count_certifications(resume_text)

    raw = {
        "experience": _log_scale(years, 15),
        "certifications": _log_scale(certs, 4),
        "education": _education_score(resume_text),
    }

    breakdown = {}
    total = 0.0
    for key, weight, description in RESUME_QUALITY_WEIGHTS:
        normalized = raw.get(key, 0.0)
        contribution = normalized * weight * 100
        total += contribution
        breakdown[key] = {
            "value": round(normalized, 3),
            "weight": weight,
            "contribution": round(contribution, 1),
            "description": description,
        }

    score = round(min(100.0, total), 1)
    return score, breakdown
