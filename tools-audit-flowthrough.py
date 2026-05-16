"""
Flow-Through audit — finds every property × period whose flow% reads as
mathematically impossible or formula-inconsistent.

Reads the current data.json. Applies the Superhost Flex/Flow formula
(verbatim from server.js calcFlow). Bins each result and prints the
diagnostics so we can see the spread before fixing anything.

Categories the audit reports:
  IMPOSSIBLE    — NaN, Infinity, or value derived from corrupt inputs
  EXTREME_HIGH  — flow% > 250% (Branch 2: GOP beat on revenue miss)
  EXTREME_LOW   — flow% < -200% (Branch 3a: rev beat eaten by costs)
  ZERO_TRAP     — formula returned 0 but the situation isn't actually flat
  UNGUARDED_NAN — input has NaN/non-numeric that the calc didn't catch
  IN_RANGE      — flow% in [-100%, 200%] — what an executive expects to see

Usage:
    python tools-audit-flowthrough.py
    python tools-audit-flowthrough.py --period 2026-05    # just one period
    python tools-audit-flowthrough.py --json out.json     # also write json
"""
from __future__ import annotations
import argparse, json, math, sys
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent
DATA_JSON = ROOT / "data.json"


def calc_flow(m: dict) -> tuple[float | None, str]:
    """Verbatim port of server.js calcFlow + dashboard.html calcFlow.

    Returns (flow_pct_or_None, branch_id). branch_id explains which arm
    of the conditional the calc fell through, plus diagnostic notes for
    inputs that look suspicious.
    """
    if not m:
        return None, "no_manual"
    rev    = m.get("revenue")
    revBud = m.get("revBud")
    gop    = m.get("gopAmt")
    gopBud = m.get("gopBudAmt")

    if rev is None or revBud is None or gop is None or gopBud is None:
        return None, "missing_input"

    # Catch non-numeric / NaN slipping through
    for nm, v in [("revenue", rev), ("revBud", revBud), ("gopAmt", gop), ("gopBudAmt", gopBud)]:
        if not isinstance(v, (int, float)) or (isinstance(v, float) and math.isnan(v)):
            return None, f"non_numeric_{nm}"

    revVar = rev - revBud
    gopVar = gop - gopBud

    # Branch resolver
    if gopVar > 0:
        if revVar > 0:
            adjusted = gopVar
            branch = "B1_both_beat"
        else:
            adjusted = gopVar - revVar
            branch = "B2_gop_beat_rev_miss"
    else:
        adjusted = gopVar - revVar
        if revVar > 0:
            branch = "B3a_rev_beat_gop_miss"
        else:
            branch = "B3b_both_miss"

    if adjusted == 0:
        return 0.0, branch + "_zero"
    # Mirrors the production calcFlow guard: revenue within 0.5% of plan
    # (floor at $500) is too tight a divisor to be meaningful.
    rev_bud_abs = abs(revBud) if isinstance(revBud, (int, float)) else 0
    guard = max(500.0, rev_bud_abs * 0.005)
    if abs(revVar) < guard:
        return None, branch + "_tiny_revvar"

    flow = (adjusted / abs(revVar)) * 100
    return flow, branch


def categorize(flow: float | None, branch: str) -> str:
    if flow is None:
        if branch.startswith("non_numeric") or branch in ("missing_input",):
            return "MISSING_OR_NON_NUMERIC"
        return "GUARDED_NULL"
    if math.isnan(flow) or math.isinf(flow):
        return "IMPOSSIBLE"
    if flow > 250:
        return "EXTREME_HIGH"
    if flow < -200:
        return "EXTREME_LOW"
    if -100 <= flow <= 200:
        return "IN_RANGE"
    return "OUT_OF_RANGE"


def fmt_money(v):
    if v is None: return "—"
    return f"${v:,.0f}"

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--period", help="Only audit one period (e.g. 2026-05)")
    p.add_argument("--json", help="Also write the full audit to this JSON file")
    p.add_argument("--show", default="all",
                   help="Which categories to print rows for: all / problems / impossible / extreme")
    args = p.parse_args()

    if not DATA_JSON.exists():
        sys.exit(f"data.json not found at {DATA_JSON}")
    data = json.loads(DATA_JSON.read_text(encoding="utf-8"))
    by_period = data.get("byPeriod") or {}
    if not by_period:
        sys.exit("data.byPeriod is empty — nothing to audit.")

    periods = [args.period] if args.period else sorted(by_period.keys())

    rows = []
    counts = defaultdict(int)
    for period in periods:
        if period not in by_period:
            continue
        for pid, store in (by_period[period] or {}).items():
            m = (store or {}).get("manual") or {}
            flow, branch = calc_flow(m)
            cat = categorize(flow, branch)
            counts[cat] += 1
            counts[f"branch:{branch}"] += 1
            rows.append({
                "period":  period,
                "propId":  pid,
                "category": cat,
                "branch":  branch,
                "flow":    None if flow is None else round(flow, 2),
                "revenue": m.get("revenue"),
                "revBud":  m.get("revBud"),
                "gopAmt":  m.get("gopAmt"),
                "gopBudAmt": m.get("gopBudAmt"),
                "revVar":  None if m.get("revenue") is None or m.get("revBud") is None else m.get("revenue") - m.get("revBud"),
                "gopVar":  None if m.get("gopAmt") is None or m.get("gopBudAmt") is None else m.get("gopAmt") - m.get("gopBudAmt"),
            })

    # Lookup property names
    props = {}
    if (ROOT / "server.js").exists():
        # Fallback: read manifest if available
        m_path = ROOT / "public" / "brand" / "team" / "manifest.json"
        if m_path.exists():
            try: props = {l["slug"]: l for l in json.loads(m_path.read_text()).get("leaders", [])}
            except: pass

    HUB_PROPS = {
        1:  "Embassy Suites Chicago Naperville",
        2:  "Hampton Inn Suites Chicago Schaumburg",
        3:  "Tru by Hilton Holland",
        4:  "Home2 Suites Holland",
        5:  "DoubleTree Winston Salem",
        6:  "Home2 Suites Normal",
        7:  "Home2 Suites Fort Wayne",
        8:  "Home2 Suites Plano",
        9:  "TownePlace Suites Mesquite",
        10: "Mainstay Suites Lexington",
        11: "Quality Inn Lexington",
        12: "Home2 Suites Lexington Hamburg",
        13: "Home2 Suites Owensboro",
        14: "TownePlace Suites Owensboro",
        15: "Hilton Garden Inn Atlanta Airport North",
        16: "Home2 Suites Evansville",
        17: "Tru by Hilton Northlake",
        18: "Holiday Inn Lexington",
        19: "Home2 Suites Prosper",
    }
    for r in rows:
        try: r["propName"] = HUB_PROPS.get(int(r["propId"]), f"#{r['propId']}")
        except: r["propName"] = f"#{r['propId']}"

    # ── Print summary ───────────────────────────────────────────────────
    print("=" * 80)
    print(f"FLOW-THROUGH AUDIT  ·  {len(rows)} (property x period) rows audited")
    print(f"Periods scanned: {', '.join(periods)}")
    print("=" * 80)
    print()
    print("Category breakdown:")
    for cat in ["IMPOSSIBLE", "EXTREME_HIGH", "EXTREME_LOW", "OUT_OF_RANGE",
                "IN_RANGE", "GUARDED_NULL", "MISSING_OR_NON_NUMERIC"]:
        n = counts.get(cat, 0)
        bar = "#" * min(60, n)
        flag = "  <-- review" if cat in ("IMPOSSIBLE", "EXTREME_HIGH", "EXTREME_LOW", "OUT_OF_RANGE") else ""
        print(f"  {cat:<24} {n:>4}  {bar}{flag}")
    print()
    print("Branch breakdown:")
    branches = sorted([k for k in counts.keys() if k.startswith("branch:")])
    for b in branches:
        print(f"  {b[7:]:<32} {counts[b]:>4}")
    print()

    # ── Show rows that need review ──────────────────────────────────────
    show_cats = {
        "all":      None,
        "problems": {"IMPOSSIBLE","EXTREME_HIGH","EXTREME_LOW","OUT_OF_RANGE","MISSING_OR_NON_NUMERIC"},
        "impossible":{"IMPOSSIBLE"},
        "extreme":  {"EXTREME_HIGH","EXTREME_LOW","OUT_OF_RANGE"},
    }.get(args.show, None)

    review = [r for r in rows if r["category"] in ("IMPOSSIBLE","EXTREME_HIGH","EXTREME_LOW","OUT_OF_RANGE")]
    if review:
        print(f"--- ROWS NEEDING REVIEW ({len(review)}) ---")
        review.sort(key=lambda r: (r["period"], -(abs(r["flow"]) if r["flow"] is not None else 0)))
        for r in review:
            flow_s = f"{r['flow']:>10.1f}%" if r["flow"] is not None else "      None"
            print(f"  {r['period']}  hub#{int(r['propId']):>2}  {r['propName'][:34]:<34}  flow={flow_s}  branch={r['branch']:<28}  rev={fmt_money(r['revenue']):>14}  bud={fmt_money(r['revBud']):>14}  gop={fmt_money(r['gopAmt']):>14}  gopBud={fmt_money(r['gopBudAmt']):>14}")
        print()

    if args.show == "all" and not review:
        print("(no rows to flag — all flow values fall inside [-100%, 200%] or are null)")

    if args.json:
        Path(args.json).write_text(json.dumps({
            "summary": dict(counts),
            "rows": rows,
        }, indent=2), encoding="utf-8")
        print(f"\n[OK] Wrote full audit to {args.json}")


if __name__ == "__main__":
    main()
