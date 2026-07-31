"""Aggregate 'shortlist composition' analytics -- scoped down per the SRS
backlog (section 7).

This deliberately does NOT attempt demographic diversity (gender,
ethnicity, etc.). Public GitHub data carries no such fields, and
inferring them from names/photos is unreliable and not something this
tool will do -- that would be exactly the kind of fabricated signal the
"Honesty over Hype" tenet rules out. Instead this measures diversity of
*evidence sources* and *technical profile*, which is what the SRS's own
risk section actually warns about: a code-activity scorer structurally
favors loud public contributors over quietly effective engineers, so a
shortlist worth trusting should show where that risk is showing up.
"""

from __future__ import annotations

from app.models.candidate import Candidate
from app.models.github_profile import GithubProfile
from app.models.match_result import MatchResult


def compute_diversity_stats(candidates: list[Candidate], matches: list[MatchResult], profiles: list[GithubProfile]) -> dict:
    total = len(matches)

    source_counts = {"github": 0, "resume": 0, "both": 0}
    for m in matches:
        source_counts[m.source] = source_counts.get(m.source, 0) + 1

    limited_data_count = sum(1 for p in profiles if p.data_limited)

    quality_bands = {"high": 0, "medium": 0, "low": 0, "unscored": 0}
    for m in matches:
        if m.quality_score is None:
            quality_bands["unscored"] += 1
        elif m.quality_score >= 70:
            quality_bands["high"] += 1
        elif m.quality_score >= 40:
            quality_bands["medium"] += 1
        else:
            quality_bands["low"] += 1

    language_counts: dict[str, int] = {}
    for p in profiles:
        for lang in (p.languages or {}).keys():
            language_counts[lang] = language_counts.get(lang, 0) + 1
    top_languages = sorted(language_counts.items(), key=lambda kv: kv[1], reverse=True)[:6]

    return {
        "total_candidates": total,
        "source_breakdown": source_counts,
        "limited_data_count": limited_data_count,
        "limited_data_pct": round(100 * limited_data_count / total, 1) if total else 0.0,
        "quality_band_distribution": quality_bands,
        "top_languages": [{"language": lang, "count": count} for lang, count in top_languages],
        "disclaimer": (
            "This measures diversity of evidence sources and technical background only -- "
            "no demographic data is collected or inferred. High concentration in one language, "
            "source type, or quality band may signal a scoring blind spot worth a manual look."
        ),
    }
