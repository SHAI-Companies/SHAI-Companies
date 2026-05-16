"""
Delphi / Cvent — group sales data.
Scheduled CSV drops to `data/inbox/delphi/` until live API.
Expected files:
  group_pace_YYYY-MM-DD.csv
  grc_status_YYYY-MM-DD.csv
  account_activity_YYYY-MM-DD.csv
"""

import os
import csv
from pathlib import Path
from typing import Optional

DELPHI_INBOX = Path(os.getenv("DELPHI_INBOX", "data/inbox/delphi"))


def get_latest(feed_name: str) -> Optional[Path]:
    candidates = sorted(DELPHI_INBOX.glob(f"{feed_name}_*.csv"), reverse=True)
    return candidates[0] if candidates else None


def read_feed(feed_name: str) -> Optional[list[dict]]:
    path = get_latest(feed_name)
    if not path:
        return None
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def get_group_pace() -> Optional[list[dict]]:
    return read_feed("group_pace")


def get_grc_status() -> Optional[list[dict]]:
    return read_feed("grc_status")


def get_account_activity() -> Optional[list[dict]]:
    return read_feed("account_activity")
