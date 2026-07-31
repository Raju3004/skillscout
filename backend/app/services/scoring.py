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


def _calibrate_similarity(raw: float, low: float = 0.05, high: float = 0.55) -> float:
    """Sentence-embedding cosine similarity between differently-worded but
    topically related text rarely exceeds ~0.5-0.6, even for a strong match.
    Rescaling the observed [low, high] range to [0, 1] keeps the score
    intuitive without changing the underlying (real, computed) similarity
    or its ranking -- this is a display calibration, not a fabrication.
    """
    if raw <= low:
        return 0.0
    if raw >= high:
        return 1.0
    return (raw - low) / (high - low)


def compute_text_match_score(jd_text: str, candidate_text: str) -> tuple[float, str]:
    """The shared JD-to-text semantic matcher. Used for both a GitHub
    profile's corpus (Code-Verified Match) and raw resume text (Resume
    Match) -- one matching pipeline, two text sources, per the SRS."""
    similarity, method = semantic_similarity(jd_text, candidate_text)
    calibrated = _calibrate_similarity(similarity)
    return round(calibrated * 100, 1), method


def compute_code_verified_score(jd_text: str, profile: GithubProfile) -> tuple[float, str]:
    corpus = build_candidate_corpus(profile.bio, profile.languages or {}, profile.top_repos or [])
    return compute_text_match_score(jd_text, corpus)


# (feature_key, weight, description)
ACCEPTANCE_WEIGHTS: list[tuple[str, float, str]] = [
    ("role_fit", 0.35, "How closely the role matches their demonstrated skills"),
    ("growth_signal", 0.25, "Recent, active building suggests openness to a new challenge"),
    ("reachability", 0.25, "Lower profile visibility usually means fewer competing offers"),
    ("profile_stability", 0.15, "Established enough on GitHub to be a credible, stable hire"),
]

# Never claim certainty either direction -- this is an estimate from public
# signals, not a guarantee (Honesty over Hype).
ACCEPTANCE_FLOOR = 0.05
ACCEPTANCE_CEILING = 0.95


def compute_offer_acceptance(code_verified_score: float, profile: GithubProfile) -> tuple[float, dict]:
    """Estimated probability [0,1] a candidate would engage with/accept this
    role, derived entirely from public GitHub signals. This is a heuristic
    proxy, not a model trained on real offer outcomes -- there is no such
    labeled data available, so we don't pretend otherwise.
    """
    features = profile.activity_features or {}

    raw = {
        "role_fit": max(0.0, min(1.0, code_verified_score / 100)),
        "growth_signal": _recency_score(features.get("most_recent_push_at")),
        "reachability": 1.0 - _log_scale(profile.followers or 0, 50_000),
        "profile_stability": _account_maturity_score(profile.account_created_at),
    }

    breakdown = {}
    total = 0.0
    for key, weight, description in ACCEPTANCE_WEIGHTS:
        normalized = raw.get(key, 0.0)
        contribution = normalized * weight
        total += contribution
        breakdown[key] = {
            "value": round(normalized, 3),
            "weight": weight,
            "contribution": round(contribution * 100, 1),
            "description": description,
        }

    probability = max(ACCEPTANCE_FLOOR, min(ACCEPTANCE_CEILING, total))
    return round(probability, 3), breakdown


def compute_overall_rank(
    code_verified_score: float | None,
    quality_score: float | None,
    offer_acceptance_probability: float | None = None,
    resume_match_score: float | None = None,
) -> float:
    match_scores = [s for s in (code_verified_score, resume_match_score) if s is not None]
    match_component = sum(match_scores) / len(match_scores) if match_scores else None

    parts: list[tuple[float, float]] = []
    if match_component is not None:
        parts.append((match_component, 0.55))
    if quality_score is not None:
        parts.append((quality_score, 0.30))
    if offer_acceptance_probability is not None:
        parts.append((offer_acceptance_probability * 100, 0.15))

    if not parts:
        return 0.0

    weight_sum = sum(w for _, w in parts)
    return round(sum(v * w for v, w in parts) / weight_sum, 1)
