"""JD-to-candidate semantic matching via sentence embeddings.

Uses a small sentence-transformer (all-MiniLM-L6-v2) so it stays light
enough for a free-tier deploy. The model is lazy-loaded once per process
and reused for every request. If it ever fails to load (e.g. cold-start
resource pressure), we fall back to a TF-IDF cosine similarity so scoring
never crashes -- reliability over features.
"""

from __future__ import annotations

import threading

import numpy as np

from app.core.config import get_settings

_model = None
_model_lock = threading.Lock()
_model_load_failed = False

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def _get_model():
    global _model, _model_load_failed
    if not get_settings().USE_EMBEDDING_MODEL:
        return None
    if _model is not None or _model_load_failed:
        return _model
    with _model_lock:
        if _model is not None or _model_load_failed:
            return _model
        try:
            from sentence_transformers import SentenceTransformer

            _model = SentenceTransformer(MODEL_NAME)
        except Exception:
            _model_load_failed = True
            _model = None
    return _model


def _tfidf_similarity(a: str, b: str) -> float:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    vectorizer = TfidfVectorizer(stop_words="english", max_features=4096)
    try:
        matrix = vectorizer.fit_transform([a, b])
    except ValueError:
        return 0.0
    sim = cosine_similarity(matrix[0], matrix[1])[0][0]
    return float(sim)


def semantic_similarity(text_a: str, text_b: str) -> tuple[float, str]:
    """Returns (similarity in [0,1], method used)."""
    text_a = (text_a or "").strip()
    text_b = (text_b or "").strip()
    if not text_a or not text_b:
        return 0.0, "none"

    model = _get_model()
    if model is not None:
        embeddings = model.encode([text_a, text_b], normalize_embeddings=True)
        sim = float(np.dot(embeddings[0], embeddings[1]))
        return max(0.0, sim), "embedding"

    return max(0.0, _tfidf_similarity(text_a, text_b)), "tfidf-fallback"


def build_candidate_corpus(
    bio: str, languages: dict[str, int], top_repos: list[dict]
) -> str:
    """Flattens a GitHub profile into a text blob for semantic matching."""
    parts = []
    if bio:
        parts.append(bio)
    if languages:
        lang_line = ", ".join(f"{lang} ({count} repos)" for lang, count in languages.items())
        parts.append(f"Languages used: {lang_line}")
    for repo in top_repos[:8]:
        desc = repo.get("description") or ""
        lang = repo.get("language") or ""
        parts.append(f"{repo.get('name', '')} ({lang}): {desc}")
    return "\n".join(p for p in parts if p.strip())


def warm_up() -> None:
    """Best-effort model preload, called at app startup so the first real
    request isn't the one paying the cold-load cost."""
    try:
        _get_model()
    except Exception:
        pass
