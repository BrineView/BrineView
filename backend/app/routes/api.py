"""BrineView API routes — 5 endpoints."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..adapters.base import DataAdapter
from ..deps import get_adapter

router = APIRouter(prefix="/api", tags=["ocean"])


@router.get("/variables")
def list_variables(adapter: DataAdapter = Depends(get_adapter)) -> list[str]:
    return adapter.get_variables()


@router.get("/meta")
def get_meta(adapter: DataAdapter = Depends(get_adapter)) -> dict[str, Any]:
    return adapter.get_meta()


@router.get("/field")
def get_field(
    variable: str = Query(..., description="Variable name"),
    depth: float = Query(..., description="Depth in meters"),
    time_index: int = Query(..., ge=0, description="Time step index"),
    adapter: DataAdapter = Depends(get_adapter),
) -> dict[str, Any]:
    try:
        return adapter.get_field(variable, depth, time_index)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/floats")
def list_floats(adapter: DataAdapter = Depends(get_adapter)) -> list[dict[str, Any]]:
    return adapter.list_floats()


@router.get("/floats/{float_id}")
def get_float(
    float_id: str,
    adapter: DataAdapter = Depends(get_adapter),
) -> dict[str, Any]:
    try:
        return adapter.get_float(float_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
