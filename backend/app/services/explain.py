"""Turns the raw score breakdowns into a short, deterministic written
explanation -- template-based rather than LLM-generated, so every sentence
is directly traceable back to a real number (Provable over Promised).
"""

from __future__ import annotations

from app.models.github_profile import GithubProfile

QUALITY_LABELS = {
    "repo_activity": "a solid volume of owned repositories",
    "popularity": "strong community traction (stars/forks)",
    "recency": "recently active development",
    "language_diversity": "range across multiple languages",
    "community": "a sizeable GitHub following",
    "account_maturity": "a long-standing, established account",
}

ACCEPTANCE_LABELS = {
    "role_fit": "how well their work matches this role",
    "growth_signal": "signs of active, ongoing building",
    "reachability": "a profile size that suggests fewer competing offers",
    "profile_stability": "an established track record",
}


def _top_keys(breakdown: dict, n: int = 2) -> list[str]:
    ranked = sorted(breakdown.items(), key=lambda kv: kv[1]["contribution"], reverse=True)
    return [k for k, _ in ranked[:n]]


def build_written_summary(
    candidate_name: str,
    code_verified_score: float | None,
    quality_score: float | None,
    offer_acceptance_probability: float | None,
    quality_breakdown: dict,
    acceptance_breakdown: dict,
    profile: GithubProfile | None,
    data_limited: bool,
) -> str:
    sentences: list[str] = []

    if data_limited:
        sentences.append(
            f"{candidate_name} has very little public GitHub activity, so this score is "
            "based on limited evidence and should be treated as a rough signal, not a verdict."
        )
        return " ".join(sentences)

    if code_verified_score is not None:
        band = "a strong" if code_verified_score >= 70 else "a moderate" if code_verified_score >= 40 else "a weak"
        sentences.append(
            f"{candidate_name}'s public repositories show {band} semantic match "
            f"({code_verified_score:.0f}/100) to this job description."
        )

    if quality_breakdown:
        top = _top_keys(quality_breakdown, 2)
        reasons = " and ".join(QUALITY_LABELS.get(k, k) for k in top)
        sentences.append(f"Their Quality Score ({quality_score:.0f}/100) is driven mainly by {reasons}.")

    if profile and profile.top_repos:
        names = ", ".join(r.get("name", "") for r in profile.top_repos[:3] if r.get("name"))
        if names:
            sentences.append(f"Most relevant repos: {names}.")

    if offer_acceptance_probability is not None and acceptance_breakdown:
        top = _top_keys(acceptance_breakdown, 1)
        reason = ACCEPTANCE_LABELS.get(top[0], top[0]) if top else "public activity signals"
        pct = round(offer_acceptance_probability * 100)
        sentences.append(
            f"Estimated offer-acceptance likelihood is {pct}%, mainly reflecting {reason} "
            "-- an estimate from public signals, not a guarantee."
        )

    return " ".join(sentences)
