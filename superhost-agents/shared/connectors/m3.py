"""
M3 Accounting — monthly P&L pulls for owner reports and scorecards.
Scheduled CSV drops to `data/inbox/m3/` until live API integration.
"""

import os
import csv
from pathlib import Path
from typing import Optional

M3_INBOX = Path(os.getenv("M3_INBOX", "data/inbox/m3"))


def get_monthly_pl(property_code: str, year: int, month: int) -> Optional[list[dict]]:
    fname = f"{property_code}_PL_{year}_{month:02d}.csv"
    fpath = M3_INBOX / fname
    if not fpath.exists():
        return None
    with open(fpath, newline="") as f:
        return list(csv.DictReader(f))


def list_available_months(property_code: str) -> list[tuple[int, int]]:
    results = []
    for f in M3_INBOX.glob(f"{property_code}_PL_*.csv"):
        parts = f.stem.split("_")
        if len(parts) == 4:
            try:
                results.append((int(parts[2]), int(parts[3])))
            except ValueError:
                continue
    return sorted(results)
