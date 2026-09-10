"""Dependency injection — one-line adapter swap."""
import os
from functools import lru_cache

from .adapters.base import DataAdapter
from .adapters.synthetic import SyntheticAdapter

ADAPTER_NAME = os.environ.get("BRINEVIEW_ADAPTER", "synthetic")


@lru_cache(maxsize=1)
def get_adapter() -> DataAdapter:
    """Return the singleton adapter instance. Swap via env var."""
    if ADAPTER_NAME == "synthetic":
        return SyntheticAdapter()
    raise ValueError(f"Unknown adapter: {ADAPTER_NAME}")
