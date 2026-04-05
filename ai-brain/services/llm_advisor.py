import logging
import os
import re
import time
from typing import Any, Optional

import httpx

log = logging.getLogger(__name__)

_EMAIL = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_PHONE = re.compile(r"(?:\+91|0)?[6-9]\d{9}\b")
_TOKENISH = re.compile(r"\bBearer\s+\S+", re.I)


def _redact_for_llm(text: str) -> str:
    if not text:
        return text
    t = _EMAIL.sub("[EMAIL]", text)
    t = _PHONE.sub("[PHONE]", t)
    t = _TOKENISH.sub("Bearer [REDACTED]", t)
    return t[:8000]


def synthesize_answer(
    question: str,
    evidence: list[dict[str, Any]],
    tfidf_fallback: str,
) -> tuple[str, Optional[str], dict[str, Any]]:
    """
    OpenAI-compatible chat completion when keys are set.
    Returns (answer, model_or_none, meta) where meta includes ops fields for the API/UI.
    """
    meta: dict[str, Any] = {
        "usedLlm": False,
        "latencyMs": None,
        "error": None,
        "retries": 0,
    }

    disabled = os.environ.get("NEXUS_LLM_ENABLED", "true").lower() in ("0", "false", "no")
    api_key = (os.environ.get("NEXUS_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY") or "").strip()
    if disabled or not api_key:
        if disabled:
            meta["error"] = "llm_disabled"
        return tfidf_fallback, None, meta

    base = (os.environ.get("NEXUS_LLM_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    model = (os.environ.get("NEXUS_LLM_MODEL") or "gpt-4o-mini").strip()
    timeout = float(os.environ.get("NEXUS_LLM_TIMEOUT_SEC", "45"))
    max_tokens = int(os.environ.get("NEXUS_LLM_MAX_TOKENS", "700"))
    temperature = float(os.environ.get("NEXUS_LLM_TEMPERATURE", "0.25"))

    q_safe = _redact_for_llm(question)
    ctx = "\n".join(
        f"- ({e.get('score')}) {_redact_for_llm(str(e.get('text', ''))[:400])}"
        for e in (evidence or [])[:8]
    )
    if not ctx.strip():
        ctx = "(No retrieval snippets; answer conservatively from the question only.)"

    system = (
        "You are InsightOS analytics advisor for product and program leaders. "
        "Use ONLY the evidence lines and the user question — do not invent metrics, tenant names, or URLs. "
        "If evidence is thin, say what is unknown. Two short paragraphs max; bullet list OK for actions."
    )
    user = f"Question:\n{q_safe}\n\nEvidence (from telemetry retrieval):\n{ctx}"

    url = f"{base}/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {"Authorization": f"Bearer {api_key}"}

    t0 = time.perf_counter()
    last_err: Optional[str] = None

    for attempt in range(2):
        try:
            with httpx.Client(timeout=timeout) as client:
                r = client.post(url, headers=headers, json=payload)
                if r.status_code in (429, 503) and attempt == 0:
                    meta["retries"] = 1
                    time.sleep(0.8)
                    continue
                r.raise_for_status()
                data = r.json()
                text = (
                    data.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                    .strip()
                )
                meta["latencyMs"] = round((time.perf_counter() - t0) * 1000, 1)
                if text:
                    meta["usedLlm"] = True
                    log.info(
                        "LLM advisor ok model=%s latency_ms=%s", model, meta["latencyMs"]
                    )
                    return text, model, meta
                last_err = "empty_content"
        except httpx.HTTPStatusError as e:
            last_err = f"http_{e.response.status_code}"
            log.warning("LLM advisor HTTP error: %s", last_err)
            if e.response.status_code in (429, 503) and attempt == 0:
                meta["retries"] = 1
                time.sleep(1.0)
                continue
            break
        except Exception as e:
            last_err = type(e).__name__
            log.warning("LLM advisor failed: %s", e)
            break

    meta["latencyMs"] = round((time.perf_counter() - t0) * 1000, 1)
    meta["error"] = last_err or "unknown"
    return tfidf_fallback, None, meta
