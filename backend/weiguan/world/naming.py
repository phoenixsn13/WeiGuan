from __future__ import annotations

import re

_HEX_FRAGMENT = re.compile(r"[0-9a-f]{12,}", re.IGNORECASE)
_WORLD_ID_FRAGMENT = re.compile(r"w_[0-9a-f]{6,}", re.IGNORECASE)


def _safe_candidate(value: str | None) -> str | None:
    candidate = (value or "").strip()
    if not candidate:
        return None
    if _HEX_FRAGMENT.search(candidate) or _WORLD_ID_FRAGMENT.search(candidate):
        return None
    return candidate


def _date_part(created_at: str) -> str:
    return (created_at or "").strip()[:10] or "未知日期"


def resolve_world_name(
    *,
    name: str | None,
    latest_content: str | None,
    primary_identity_name: str | None,
    created_at: str,
) -> str:
    """Return a display-safe world name without exposing storage IDs."""
    explicit = _safe_candidate(name)
    if explicit:
        return explicit

    content = _safe_candidate(latest_content)
    if content:
        return content[:12]

    identity = _safe_candidate(primary_identity_name)
    if identity:
        return f"{identity}的世界"

    return f"围观世界·{_date_part(created_at)}"
