import json
import os

_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class DataLoader:
    @staticmethod
    def load_json(path: str):
        p = path if os.path.isabs(path) else os.path.join(_BASE, path)
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)