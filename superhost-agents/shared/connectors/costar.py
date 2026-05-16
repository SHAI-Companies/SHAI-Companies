"""
CoStar / STR — comp set index, market pace.
Reads most recent weekly STR export from `data/inbox/str/`.
"""

import os
from pathlib import Path
from typing import Optional

STR_INBOX = Path(os.getenv("STR_INBOX", "data/inbox/str"))


def get_latest_comp_report(property_code: str) -> Optional[Path]:
    candidates = sorted(STR_INBOX.glob(f"{property_code}_STR_*.xlsx"), reverse=True)
    return candidates[0] if candidates else None


def parse_comp_report(report_path: Path) -> dict:
    """
    Extract occ/ADR/RevPAR index, rolling 28-day, fair share gap.
    Implement against your STR export template.
    """
    import openpyxl
    wb = openpyxl.load_workbook(report_path, data_only=True)
    return {"note": f"Parse against your STR template. Loaded: {report_path}"}
