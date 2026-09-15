"""Shared utilities."""
import numpy as np
from typing import Any


def sanitize(arr: Any) -> Any:
    """Replace NaN/Inf with None for safe JSON serialization."""
    if isinstance(arr, np.ndarray):
        return sanitize(arr.tolist())
    if isinstance(arr, list):
        return [sanitize(x) for x in arr]
    if isinstance(arr, float) and (np.isnan(arr) or np.isinf(arr)):
        return None
    if isinstance(arr, (np.floating, np.integer)):
        v = float(arr)
        if np.isnan(v) or np.isinf(v):
            return None
        return v
    return arr
