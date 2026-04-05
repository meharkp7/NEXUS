import json
import os

from models.event_model import Event

_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class MockConsumer:
    def consume(self):
        path = os.path.join(_BASE, "mock_data", "events.json")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return [Event(**e) for e in data]