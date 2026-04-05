"""
Federated learning placeholder: averages client weight vectors from stdin JSON.
Real FL would use secure aggregation + differential privacy; this is a dev stub only.

Input JSON: {"weights": [[0.1, 0.2], [0.3, 0.1]]}
Output JSON: {"mean": [0.2, 0.15], "clients": 2}
"""

from __future__ import annotations

import json
import sys


def main() -> None:
    data = json.load(sys.stdin)
    blocks = data.get("weights") or []
    if not blocks:
        print(json.dumps({"error": "no weights"}))
        sys.exit(1)
    dim = len(blocks[0])
    acc = [0.0] * dim
    for w in blocks:
        if len(w) != dim:
            print(json.dumps({"error": "dimension mismatch"}))
            sys.exit(1)
        for i, v in enumerate(w):
            acc[i] += float(v)
    n = len(blocks)
    mean = [x / n for x in acc]
    print(json.dumps({"mean": mean, "clients": n}))


if __name__ == "__main__":
    main()
