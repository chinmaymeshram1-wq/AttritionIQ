import math
from typing import Any


def sanitize_for_json(obj: Any) -> Any:
    """
    Recursively sanitize data structures for JSON compliance.

    Transforms:
    - NaN -> None (JSON null)
    - Infinity -> None (JSON null)
    - -Infinity -> None (JSON null)
    - Normal numbers (int, float) -> unchanged
    - Strings, booleans -> unchanged
    - Dicts, lists, tuples -> recursively sanitized
    """
    if obj is None:
        return None
    # Note: bool is a subclass of int in Python, check bool first to preserve boolean type
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, int):
        return obj
    if isinstance(obj, float):
        if not math.isfinite(obj):
            return None
        return obj
    if isinstance(obj, str):
        return obj
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [sanitize_for_json(v) for v in obj]
    # Handle numpy / pandas scalars if encountered
    if hasattr(obj, "item"):
        try:
            return sanitize_for_json(obj.item())
        except Exception:
            pass
    return obj
