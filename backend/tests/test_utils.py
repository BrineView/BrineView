"""Tests for backend/app/utils.py — sanitize function."""
import math
import numpy as np
import pytest
from app.utils import sanitize


def test_clean_passthrough():
    assert sanitize(42) == 42
    assert sanitize("hello") == "hello"
    assert sanitize(None) is None


def test_nan_to_none():
    assert sanitize(float("nan")) is None
    assert sanitize(math.nan) is None
    assert sanitize(np.nan) is None


def test_inf_to_none():
    assert sanitize(float("inf")) is None
    assert sanitize(float("-inf")) is None
    assert sanitize(math.inf) is None


def test_numpy_types():
    assert sanitize(np.float32(3.14)) == pytest.approx(3.14, abs=0.01)
    assert sanitize(np.int64(42)) == 42
    assert sanitize(np.float64(float("nan"))) is None
    assert sanitize(np.float32(float("inf"))) is None


def test_nested_lists():
    result = sanitize([1.0, float("nan"), [2.0, float("inf")]])
    assert result == [1.0, None, [2.0, None]]


def test_nested_arrays():
    arr = np.array([[1.0, float("nan")], [float("inf"), 3.0]])
    result = sanitize(arr)
    assert result == [[1.0, None], [None, 3.0]]
