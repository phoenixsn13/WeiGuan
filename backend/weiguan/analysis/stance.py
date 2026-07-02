from __future__ import annotations


def stance_polarity(label: str | None) -> int:  # review:P8-T2
    if label in {"question", "skeptic"}:
        return -1
    if label in {"analysis", "meme", "other"}:
        return 1
    return 0

