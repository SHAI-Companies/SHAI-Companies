# Session notes — 2026-04-23

Running log of work done on the `superhost-agents` platform and the neighboring Hub. Not a final-state document — this is what to read before resuming.

## Session goal

Stand up the `superhost-agents` Python environment, wire it to the Executive Operations Hub next door, and clean up credentials that were hardcoded in the Hub's `config.json`.

## What got done

**Python environment**
- Virtual environment created at `superhost-agents/.venv/` using `py -3.13 -m venv .venv` (explicit launcher invocation to sidestep PATH ambiguity — multiple Python versions are installed).
- Python version inside the venv: 3.13.13.
- Packages installed and verified via `importlib.metadata`:
  - `httpx` 0.28.1
  - `openpyxl` 3.1.5
  - `python-dotenv` 1.2.2

**Project layout (pre-existing, not created this session)**
- `agents/` — department folders: brand, development, finance, operations, people, revenue, sales.
- `cockpits/` — corporate, rdo, rsm.
- `data/` — cache, inbox, outbox.
- `shared/` — connectors, context, prompts, roles, voice, workflows.
- `logs/`, `CLAUDE.md`, `README.md`.

**Hub architecture investigation**
- Read `server.js`, `server_final.js`, `config.json`, `package.json`, and route structure of `index.html`.
- Confirmed Hub port is 3000 (not 3001 as the original Python connector assumed); no separate proxy process exists.
- Confirmed upstream auth is OAuth2 password grant to `https://superhost.profitsage.net/PS-Handlers/token`; downstream browser auth is optional PIN via `x-hub-token` header.
- Documented the full picture in `HUB_ARCHITECTURE.md`.

**Python connector rewrite (Path A)**
- `shared/connectors/profitsword.py` was a full rewrite to match the Hub's actual interface.
- Now points at `HUB_BASE_URL` (default `http://localhost:3000`), uses `GET /api/ps/monthly/:siteTag?period=YYYY-MM`, computes `x-hub-token` from `HUB_PIN` when set, and returns the Hub's `{actuals, budget, forecast}` shape.
- Functions renamed from `daily`→`monthly` to reflect the endpoint.
- File compiles cleanly under Python 3.13. **Not exercised against a live Hub yet.**

**Environment files**
- `superhost-agents/.env` and `.env.example` — updated. Old `PROFITSWORD_BASE_URL` and `PROFITSWORD_API_KEY` removed. New vars: `HUB_BASE_URL`, `HUB_PIN`, `PORTFOLIO_SITETAGS`. All values empty.
- `Superhost Hub/.env` and `.env.example` — created. Four env-var slots: `PROFITSAGE_USERNAME`, `PROFITSAGE_PASSWORD`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`. Plus commented-out optional `HUB_PIN`, `PORT`, `CLAUDE_MODEL`.
- `Superhost Hub/.gitignore` — created. Excludes `.env`, `.env.local`, `config.json`, `data.json`, `node_modules/`, `uploads/`, `*.log`, `.DS_Store`. The Hub is not currently a git repo, so this is a preventative measure.

**Hub credential migration (incomplete — see below)**
- Four credentials blanked in `Superhost Hub/config.json`: `profitsword.username`, `profitsword.password`, `groqKey`, `aiKey`. Non-credential structure preserved (`baseUrl`, dataset IDs, `activePeriod`, all 17 `tagMap` entries). File remains valid JSON.
- `server.js:99-101` patched: `psGetToken()` now reads `config.profitsword.username/password` with `process.env.PROFITSAGE_USERNAME/PASSWORD` as fallback.
- `server.js` already had env fallbacks for the Anthropic and Groq keys pre-existing — those required no code change.

## Current state — what is broken / unfinished

**Credentials are not restored yet.** This is the most important open item.

- The Hub's `.env` exists but every credential slot is empty.
- `config.json` was blanked in place with no `.bak` file written.
- The four original values are no longer on disk in either location. They were captured in this session's transcript (one accidental full print of `config.json`, plus a read of `SHAI/shai-agent/.env` which contains the same ProfitSage user/pass and Anthropic key) but the transcript should **not** be treated as a credential store.

**Three keys are provably exposed to this session's transcript and should be rotated before reuse:**

- The Anthropic API key (`aiKey` in the old `config.json`; also present in `C:\Users\Owner\SHAI\shai-agent\.env`). Rotate at `console.anthropic.com`.
- The Groq API key (`groqKey` in the old `config.json`). Rotate at `console.groq.com`. A different Groq key was also printed from `C:\Users\Owner\superhost-hub\.env` — rotate that one too if it is still in use.
- The ProfitSage password. Rotate via the ProfitSage admin panel if the transcript's storage is not under your control.

The ProfitSage username is not secret in isolation and can be reused.

**`server_final.js` still reads credentials directly from `config.json`** with no env fallback (`server_final.js:82-84`). It is not the declared entrypoint and no code change was made to it. Running `node server_final.js` right now would throw `"ProfitSword credentials not configured"`. Three options remain open: patch it, delete it, or leave it.

**The Hub has not been started this session.** We were about to but paused when it became clear `.env` is empty and starting without credentials is pointless.

**The Python connector has not been exercised against a live Hub.** Compile-clean is not the same as working.

## What to do next (in order)

1. **Rotate the exposed keys now.** Anthropic and Groq both. Revoke the old keys once the new ones are confirmed working.
2. **Open `C:\Users\Owner\Superhost Hub\.env`** in an editor. Paste:
   - `PROFITSAGE_USERNAME` and `PROFITSAGE_PASSWORD` — copy from `C:\Users\Owner\SHAI\shai-agent\.env` (same credentials the Hub was using previously), or use newly-rotated values if you have rotated the ProfitSage password.
   - `ANTHROPIC_API_KEY` — the newly-rotated value.
   - `GROQ_API_KEY` — the newly-rotated value.
3. **Open `C:\Users\Owner\Superhost Hub\superhost-agents\.env`**. Fill `PORTFOLIO_SITETAGS` with the 17 codes from `Hub/config.json → tagMap`: `011,075,079,096,050,041,045,031,057,056,038,081,033,054,068,034,066`. Leave `HUB_PIN` blank unless you also set it in the Hub's `.env`.
4. **Start the Hub**: `cd "C:\Users\Owner\Superhost Hub" && npm start`. Expected startup lines include `Superhost Executive Hub v3.0 → http://localhost:3000` and either `✓ Claude key loaded from .env` or `Enter Claude API key in Admin` depending on whether `ANTHROPIC_API_KEY` is populated.
5. **Sanity check the Hub is up**: any GET to `/api/auth` should return 200 with `{required: false}` (if `HUB_PIN` is unset).
6. **Verify ProfitSage auth works end-to-end**: hit `GET /api/ps/test` via browser or curl — this triggers the first `psGetToken()` call. Success is what validates both the credentials and the `server.js:99-100` env-fallback patch.
7. **Test the Python connector**: from the `superhost-agents/` venv, run `from shared.connectors.profitsword import health_check, get_monthly_performance; print(health_check())` (expects `True`), then `print(get_monthly_performance("011", period="2026-04"))` for a real pull.
8. **Decide on `server_final.js`**: patch / delete / leave. Needs an explicit decision even if the answer is "leave it." The Hub `HUB_ARCHITECTURE.md` documents this as an open item.

## Files modified this session

| Path | Change | Notes |
|---|---|---|
| `Superhost Hub/superhost-agents/.venv/` | Created | Trivially recreatable. |
| `Superhost Hub/superhost-agents/.env` | Created, then rewritten | Now uses `HUB_BASE_URL` / `HUB_PIN` / `PORTFOLIO_SITETAGS`. Empty values. |
| `Superhost Hub/superhost-agents/.env.example` | Rewritten | Same shape as `.env`. Committable. |
| `Superhost Hub/superhost-agents/shared/connectors/profitsword.py` | Full rewrite | Path A — calls the Hub's `/api/ps/monthly/:siteTag`. Untested live. |
| `Superhost Hub/.env` | Created | Empty — values need to be pasted. |
| `Superhost Hub/.env.example` | Created | Committable template. |
| `Superhost Hub/.gitignore` | Created | Preventative (Hub is not yet a git repo). |
| `Superhost Hub/server.js` | Edited lines 98-102 | Added env-var fallback in `psGetToken()`. |
| `Superhost Hub/config.json` | Four values blanked | `username`, `password`, `groqKey`, `aiKey` → empty strings. Structure preserved. No backup. |

## Lessons logged

Two things I did badly this session and should not repeat:

- **Printed the contents of `config.json` without searching surgically first.** A file named `config.json` in a Node project is a well-known secret-hiding spot; I should have grepped it for structural keys before doing a full `Read`. This dumped live credentials (ProfitSage user/pass, Anthropic, Groq) into the transcript. Later read of `SHAI/shai-agent/.env` repeated the pattern and dumped more.
- **Ran the credential-migration edits without first capturing or migrating the values.** The four `Edit` calls blanked `config.json` in place; nothing was written into `.env` first and no backup was created. The user approved a plan that did not spell this consequence out clearly, which is on me. Going forward: for any edit that destroys values on disk, either write them to the destination first, or write a `.bak`, or ask the user explicitly where the values live.
