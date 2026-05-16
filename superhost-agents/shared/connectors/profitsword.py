"""
ProfitSword connector — reads monthly financial data via the Executive Operations Hub.

The Hub (C:/Users/Owner/Superhost Hub/server.js) handles ProfitSage OAuth2 auth,
token caching, and query composition upstream. This connector just calls the
Hub's /api/ps/* routes from Python over localhost.

Hub must be running: `cd "C:/Users/Owner/Superhost Hub" && npm start`

Env vars (see .env.example):
    HUB_BASE_URL       — defaults to http://localhost:3000
    HUB_PIN            — optional; must match the Hub's HUB_PIN if that env var is set
    PORTFOLIO_SITETAGS — comma-separated ProfitSage site codes, e.g. "011,075,079"
"""

import base64
import os
from typing import Optional

import httpx

HUB_BASE_URL = os.getenv("HUB_BASE_URL", "http://localhost:3000").rstrip("/")
HUB_PIN = os.getenv("HUB_PIN")


def _auth_headers() -> dict:
    if not HUB_PIN:
        return {}
    token = base64.b64encode(HUB_PIN.encode("utf-8")).decode("ascii")
    return {"x-hub-token": token}


def get_monthly_performance(
    site_tag: str,
    period: Optional[str] = None,
    data_set_id: Optional[str] = None,
) -> Optional[dict]:
    """
    Fetch one property's monthly P&L via GET /api/ps/monthly/:siteTag.

    Args:
        site_tag:    3-digit ProfitSage site code (e.g. "011")
        period:      YYYY-MM (e.g. "2026-04"). Defaults to the Hub's activePeriod.
        data_set_id: Override the default actuals data set ID.

    Returns:
        {"actuals": ..., "budget": ..., "forecast": ...} — forecast may be null.
        None if the Hub responds 404.
    """
    url = f"{HUB_BASE_URL}/api/ps/monthly/{site_tag}"
    params: dict[str, str] = {}
    if period:
        params["period"] = period
    if data_set_id:
        params["dataSetId"] = data_set_id
    resp = httpx.get(url, params=params, headers=_auth_headers(), timeout=30.0)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def get_portfolio_monthly(period: Optional[str] = None) -> dict[str, dict]:
    """
    Fetch monthly data for every site listed in PORTFOLIO_SITETAGS.

    Returns a dict keyed by siteTag. Failed fetches become {"error": "..."} so
    one bad property doesn't kill the whole portfolio pull.
    """
    site_tags = (os.getenv("PORTFOLIO_SITETAGS") or "").split(",")
    results: dict[str, dict] = {}
    for tag in [t.strip() for t in site_tags if t.strip()]:
        try:
            results[tag] = get_monthly_performance(tag, period=period)
        except Exception as e:
            results[tag] = {"error": str(e)}
    return results


def health_check() -> bool:
    """True if the Hub is reachable. /api/auth responds without a valid PIN."""
    try:
        resp = httpx.get(f"{HUB_BASE_URL}/api/auth", timeout=3.0)
        return resp.status_code in (200, 401)
    except Exception:
        return False
