"""Candidate Quality Score: a transparent, weighted feature model over real
GitHub activity signals.

Note on approach: the SRS names XGBoost as the intended model, but XGBoost
needs a labeled training set (real hire/no-hire outcomes) that doesn't
exist here. Training a regressor on invented labels would violate the
"Provable over Promised" and "Honesty over Hype" tenets -- the model would
look sophisticated while actually encoding made-up numbers. A declared,
weighted linear model over real features gives the same 0-100 score with
every contribution traceable to a real signal, which also satisfies
"Explainability over Black-Box Accuracy" directly instead of needing a
SHAP approximation on top of a black box.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

from app.models.github_profile import GithubProfile
from app.services.embedding_matcher import build_candidate_corpus, semantic_similarity

# (feature_key, weight, description)
QUALITY_WEIGHTS: list[tuple[str, float, str]] = [
    ("repo_activity", 0.28, "Number of owned, non-fork repositories"),
    ("popularity", 0.22, "Stars + forks earned across owned repos"),
    ("recency", 0.20, "How recently the candidate pushed code"),
    ("language_diversity", 0.12, "Distinct languages used across repos"),
    ("community", 0.10, "GitHub followers"),
    ("account_maturity", 0.08, "Account age, as a proxy for sustained engagement"),
]


def _log_scale(value: float, cap: float) -> float:
    if value <= 0:
        return 0.0
    return min(1.0, math.log1p(value) / math.log1p(cap))


def _recency_score(most_recent_push_at: str | None) -> float:
    if not most_recent_push_at:
        return 0.0
    try:
        pushed = datetime.fromisoformat(most_recent_push_at.replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    days_ago = (datetime.now(timezone.utc) - pushed).days
    if days_ago <= 30:
        return 1.0
    if days_ago >= 730:
        return 0.0
    return max(0.0, 1.0 - (days_ago - 30) / (730 - 30))


def _account_maturity_score(created_at: str) -> float:
    if not created_at:
        return 0.0
    try:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    years = (datetime.now(timezone.utc) - created).days / 365.25
    return min(1.0, years / 6.0)


def compute_quality_score(profile: GithubProfile) -> tuple[float, dict]:
    features = profile.activity_features or {}

    raw = {
        "repo_activity": _log_scale(features.get("owned_repo_count", 0), 40),
        "popularity": _log_scale(
            features.get("total_stars", 0) + features.get("total_forks", 0), 500
        ),
        "recency": _recency_score(features.get("most_recent_push_at")),
        "language_diversity": _log_scale(features.get("distinct_languages", 0), 8),
        "community": _log_scale(profile.followers or 0, 1000),
        "account_maturity": _account_maturity_score(profile.account_created_at),
    }

    breakdown = {}
    total = 0.0
    for key, weight, description in QUALITY_WEIGHTS:
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


def compute_code_verified_score(jd_text: str, profile: GithubProfile) -> tuple[float, str]:
    corpus = build_candidate_corpus(profile.bio, profile.languages or {}, profile.top_repos or [])
    similarity, method = semantic_similarity(jd_text, corpus)
    return round(similarity * 100, 1), method


def compute_overall_rank(
    code_verified_score: float | None,
    quality_score: float | None,
    offer_acceptance_probability: float | None = None,
) -> float:
    parts: list[tuple[float, float]] = []
    if code_verified_score is not None:
        parts.append((code_verified_score, 0.55))
    if quality_score is not None:
        parts.append((quality_score, 0.30))
    if offer_acceptance_probability is not None:
        parts.append((offer_acceptance_probability * 100, 0.15))

    if not parts:
        return 0.0

    weight_sum = sum(w for _, w in parts)
    return round(sum(v * w for v, w in parts) / weight_sum, 1)
