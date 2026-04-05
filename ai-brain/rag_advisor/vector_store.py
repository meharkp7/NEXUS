import json
import logging
import re
from typing import Any, Optional

import numpy as np

log = logging.getLogger(__name__)

_store_singleton: Optional["TenantStoryIndex"] = None


def _row_to_text(r: dict[str, Any]) -> str:
    meta = r.get("metadata")
    if isinstance(meta, str):
        try:
            meta = json.loads(meta) if meta else {}
        except json.JSONDecodeError:
            meta = {}
    elif meta is None:
        meta = {}
    parts = [
        f"feature {r.get('feature_id')}",
        f"event {r.get('event_type')}",
        f"time {r.get('timestamp')}",
    ]
    if isinstance(meta, dict) and meta.get("story"):
        parts.append(str(meta["story"])[:600])
    elif meta:
        parts.append(json.dumps(meta, default=str)[:400])
    return re.sub(r"\s+", " ", " ".join(parts)).strip()


class TenantStoryIndex:
    def __init__(self) -> None:
        self._docs: list[str] = []
        self._vect = None
        self._matrix = None
        self._tenant: Optional[str] = None

    def index_tenant_events(self, rows: list[dict[str, Any]], tenant_id: str) -> None:
        from sklearn.feature_extraction.text import TfidfVectorizer

        texts = [_row_to_text(r) for r in rows if r.get("feature_id")]
        self._tenant = tenant_id
        self._docs = texts
        if not texts:
            self._matrix = None
            self._vect = None
            return
        self._vect = TfidfVectorizer(
            max_features=min(800, max(50, len(texts) * 4)),
            stop_words="english",
            ngram_range=(1, 2),
        )
        self._matrix = self._vect.fit_transform(texts)

    def query(self, question: str, k: int = 5) -> list[dict[str, Any]]:
        if not question.strip() or self._matrix is None or self._vect is None:
            return []
        from sklearn.metrics.pairwise import cosine_similarity

        qv = self._vect.transform([question])
        sim = cosine_similarity(qv, self._matrix).flatten()
        # Zero / NaN vector when the question shares no tokens with the corpus (e.g. query "test").
        sim = np.nan_to_num(sim, nan=0.0, posinf=0.0, neginf=0.0)
        idx = np.argsort(sim)[::-1][: max(k, 6)]
        out = []
        for i in idx:
            if sim[i] <= 0:
                continue
            out.append({"text": self._docs[int(i)], "score": round(float(sim[i]), 4)})
            if len(out) >= k:
                break
        # No vocabulary overlap: still return top docs so the advisor can surface corpus context.
        if not out and len(idx) and self._docs:
            for j in range(min(k, len(idx))):
                bi = int(idx[j])
                out.append({
                    "text": self._docs[bi],
                    "score": round(float(max(sim[bi], 0.0)), 4),
                })
        return out


def get_vector_store() -> TenantStoryIndex:
    global _store_singleton
    if _store_singleton is None:
        _store_singleton = TenantStoryIndex()
    return _store_singleton
