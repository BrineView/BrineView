"""Vercel default-location entrypoint shim.

`pyproject.toml` already declares `[tool.vercel] entrypoint`, but Vercel only
honours that file when the build runs at the repo root on a commit that
contains it. This file lives at a default search location (`api/index.py`),
so detection succeeds even if the build uses a different root or an older
commit. It simply re-exports the real FastAPI app.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.main import app  # noqa: F401 -- Vercel looks for top-level `app`
