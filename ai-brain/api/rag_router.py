import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from api.analytics_router import _rows_for_rag
from api.rbac_deps import RbacCtx, enforce_tenant_scope, require_permission
from rag_advisor.vector_store import get_vector_store
from services.llm_advisor import synthesize_answer
from storage.sqlite_store import get_store

router = APIRouter(tags=["rag"])


class RagQueryBody(BaseModel):
    tenantId: str = Field(..., min_length=1)
    question: str = Field(..., min_length=2, max_length=2000)


@router.post("/rag-query")
def rag_query(
    body: RagQueryBody,
    rbac: RbacCtx = Depends(require_permission("ai_advisor:view_recommendations")),
):
    enforce_tenant_scope(rbac.role, rbac.tenant_header, body.tenantId)
    # Same row source as analytics (SQLite + optional demo fallback) so RAG is not empty when UI uses demo data.
    rows = _rows_for_rag(body.tenantId)
    vs = get_vector_store()
    vs.index_tenant_events(rows, body.tenantId)
    evidence = vs.query(body.question, k=6)

    lines = []
    for ev in evidence[:3]:
        lines.append(f"- ({ev['score']}) {ev['text'][:280]}")
    if not lines:
        answer = (
            "Not enough indexed telemetry to answer. Ingest more events or broaden the question."
        )
    else:
        answer = (
            "Based on similar usage patterns in your telemetry corpus:\n"
            + "\n".join(lines)
            + "\n\nPrioritize features with high engagement variance or zombie signals in the Adoption view."
        )

    answer_final, llm_model, llm_meta = synthesize_answer(body.question, evidence, answer)

    try:
        get_store().append_audit(
            tenant_id=body.tenantId,
            action="rag_query",
            actor=rbac.role or "api",
            resource="rag",
            detail=json.dumps(
                {
                    "questionPreview": body.question[:240],
                    "evidenceCount": len(evidence),
                    "llmModel": llm_model,
                    "llmUsed": llm_meta.get("usedLlm"),
                    "llmLatencyMs": llm_meta.get("latencyMs"),
                    "llmError": llm_meta.get("error"),
                }
            ),
        )
    except Exception:
        pass

    return {
        "tenantId": body.tenantId,
        "question": body.question,
        "answer": answer_final,
        "evidence": evidence,
        "llmModel": llm_model,
        "llm": llm_meta,
    }
