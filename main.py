"""Entry point for Vercel, which looks for an `app` object in a top-level file.

The real app lives in src/resume_agent/api/app.py. This file only finds it.
"""

import sys
from pathlib import Path

# The package sits under src/. Add that folder to the import path, so the
# import below works even if the platform did not install the project itself.
sys.path.insert(0, str(Path(__file__).parent / "src"))

from resume_agent.api.app import app  # noqa: E402  (must come after the path line)

__all__ = ["app"]
