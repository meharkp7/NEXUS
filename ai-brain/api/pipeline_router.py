import logging
from typing import Any

from fastapi import APIRouter, Depends

from api.rbac_deps import RbacCtx, require_permission
from analytics.analytics_service import AnalyticsService
from analytics.zombie_detector import ZombieDetector
from analytics.roi_calculator import ROICalculator
from analytics.funnel_analysis import FunnelAnalyzer
from graph.feature_relationships import FeatureRelationshipEngine
from graph.graph_builder import GraphBuilder
from graph.neo4j_client import Neo4jClient
from ingestion.mock_consumer import MockConsumer
from processing.journey_engine import JourneyEngine
from processing.session_engine import SessionEngine
from rag_advisor.advisor_bot import AdvisorBot
from simulation.journey_simulator import JourneySimulator

log = logging.getLogger(__name__)

router = APIRouter(tags=["pipeline"])


def _run_core_pipeline() -> dict[str, Any]:
    consumer = MockConsumer()
    session_engine = SessionEngine()
    journey_engine = JourneyEngine()

    neo4j_client = None
    try:
        neo4j_client = Neo4jClient()
        graph_builder = GraphBuilder(neo4j_client)
        relationship_engine = FeatureRelationshipEngine(graph_builder)
    except Exception as e:
        log.warning("Neo4j unavailable, skipping graph: %s", e)
        relationship_engine = None

    funnel_analyzer = FunnelAnalyzer()
    zombie_detector = ZombieDetector()
    roi_calculator = ROICalculator()
    analytics_service = AnalyticsService(
        funnel_analyzer,
        zombie_detector,
        roi_calculator,
    )
    simulator = JourneySimulator()
    advisor = AdvisorBot()

    events = consumer.consume()
    sessions = session_engine.build_sessions(events)
    journeys = journey_engine.build_journeys(sessions)
    raw_journeys = [j["journey"] for j in journeys]

    if relationship_engine:
        try:
            relationship_engine.process_journeys(raw_journeys)
        except Exception as e:
            log.warning("Graph update failed: %s", e)

    analytics = analytics_service.run(raw_journeys)

    original = simulator.simulate_conversion_rate(raw_journeys)
    modified = simulator.simulate_removal(raw_journeys, "KYC")
    new = simulator.simulate_conversion_rate(modified)
    simulation = {"original": original, "new": new}
    insights = advisor.generate_insights(analytics, simulation)

    if neo4j_client:
        try:
            neo4j_client.close()
        except Exception:
            pass

    return {
        "journeys": journeys,
        "analytics": analytics,
        "simulation": simulation,
        "insights": insights,
    }


@router.get("/pipeline/run")
def run_pipeline_http(_rbac: RbacCtx = Depends(require_permission("ai_advisor:run_simulations"))):
    return _run_core_pipeline()


@router.get("/run")
def run_pipeline_legacy(_rbac: RbacCtx = Depends(require_permission("ai_advisor:run_simulations"))):
    return _run_core_pipeline()
