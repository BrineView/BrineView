"""Dependency injection — one-line adapter swap."""
import logging
import os
from functools import lru_cache

from .adapters.base import DataAdapter
from .adapters.synthetic import SyntheticAdapter

logger = logging.getLogger("brineview.adapter")

ADAPTER_NAME = os.environ.get("BRINEVIEW_ADAPTER", "synthetic")


@lru_cache(maxsize=1)
def get_adapter() -> DataAdapter:
    """Return the singleton adapter instance. Swap via env var."""
    if ADAPTER_NAME == "synthetic":
        return SyntheticAdapter()
    raise ValueError(f"Unknown adapter: {ADAPTER_NAME}")


def warm_adapter() -> None:
    """Eagerly initialize the adapter at startup so the first request isn't slow."""
    logger.info("Loading data adapter...")
    get_adapter()
    logger.info("Data adapter ready.")
