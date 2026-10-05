import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import run_analysis  # noqa: E402
from app.model import build_model, solve  # noqa: E402
from app.schemas import AnalyzeRequest  # noqa: E402


@pytest.fixture(scope="session")
def default_built():
    b = build_model(AnalyzeRequest())
    solve(b)
    return b


@pytest.fixture(scope="session")
def default_result():
    return run_analysis(AnalyzeRequest())
