"""BrineView user-data routes — add and preview your own NetCDF/CSV data."""
from typing import Any

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from .. import userdata

router = APIRouter(prefix="/api/user-data", tags=["user-data"])


@router.get("")
def list_user_data() -> list[dict[str, Any]]:
    return userdata.list_datasets()


@router.post("")
async def upload_user_data(file: UploadFile = File(...)) -> dict[str, Any]:
    raw = await file.read()
    try:
        return userdata.store_upload(file.filename or "upload", raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{index}/field")
def get_user_field(
    index: int,
    variable: str = Query(..., description="Variable name"),
    depth: float = Query(0.0, description="Depth in meters"),
    time_index: int = Query(0, ge=0, description="Time step index"),
) -> dict[str, Any]:
    try:
        return userdata.field_for(index, variable, depth, time_index)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{index}")
def delete_user_data(index: int) -> dict[str, str]:
    try:
        userdata.delete_dataset(index)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"deleted": str(index)}