"""
HRIS / Payroll connector — staff rosters, turnover, training completion.
Drops to `data/inbox/hris/`:
  roster_YYYY-MM-DD.csv
  terminations_YYYY-MM-DD.csv
  training_completion_YYYY-MM-DD.csv
"""

import os
import csv
from pathlib import Path
from typing import Optional

HRIS_INBOX = Path(os.getenv("HRIS_INBOX", "data/inbox/hris"))


def get_latest(feed_name: str) -> Optional[Path]:
    candidates = sorted(HRIS_INBOX.glob(f"{feed_name}_*.csv"), reverse=True)
    return candidates[0] if candidates else None


def read_feed(feed_name: str) -> Optional[list[dict]]:
    path = get_latest(feed_name)
    if not path:
        return None
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def get_roster() -> Optional[list[dict]]:
    return read_feed("roster")


def get_terminations() -> Optional[list[dict]]:
    return read_feed("terminations")


def get_training_completion() -> Optional[list[dict]]:
    return read_feed("training_completion")
