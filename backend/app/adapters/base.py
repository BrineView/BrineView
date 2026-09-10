"""Abstract base class for ocean data adapters."""
from abc import ABC, abstractmethod
from typing import Any


class DataAdapter(ABC):
    """Interface that all data adapters must implement.

    Future adapters (INCOISAdapter, ArgoLiveAdapter) can be dropped in
    without changing the API contract or the frontend.
    """

    @abstractmethod
    def get_variables(self) -> list[str]:
        """Return list of available variable names."""
        ...

    @abstractmethod
    def get_meta(self) -> dict[str, Any]:
        """Return dataset metadata (depths, times, lat/lon ranges)."""
        ...

    @abstractmethod
    def get_field(self, variable: str, depth: float, time_index: int) -> dict[str, Any]:
        """Return a 2D field slice for the given variable/depth/time."""
        ...

    @abstractmethod
    def list_floats(self) -> list[dict[str, Any]]:
        """Return lightweight list of float positions."""
        ...

    @abstractmethod
    def get_float(self, float_id: str) -> dict[str, Any]:
        """Return full float detail including observed and model profiles."""
        ...
