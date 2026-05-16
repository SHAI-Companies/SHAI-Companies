"""
Fetch corporate leadership photos + bios from superhosthospitality.com/leadership
and write them locally so the hub doesn't depend on external availability.

Outputs:
  - public/brand/team/<slug>.<ext>           — each photo, downloaded
  - public/brand/team/manifest.json          — list of leaders with photo path,
                                              name, title, slug, source URL

Re-runnable: any time the leadership page changes (new hire, photo refresh),
re-run to refresh the manifest + photos. Skips downloads where the local
file already exists and has non-zero size, unless --force is passed.

Usage:
    python tools-fetch-leadership.py            # fetch + write
    python tools-fetch-leadership.py --force    # re-download even if cached
"""
from __future__ import annotations
import argparse, json, re, sys, time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
SOURCE_URL = "https://www.superhosthospitality.com/leadership"
OUT_DIR = ROOT / "public" / "brand" / "team"
MANIFEST = OUT_DIR / "manifest.json"

UA = {"User-Agent": "Mozilla/5.0 (compatible; SuperhostHub/1.0)"}


def fetch(url: str, binary: bool = False) -> bytes | str:
    req = Request(url, headers=UA)
    with urlopen(req, timeout=20) as r:
        b = r.read()
    return b if binary else b.decode("utf-8", errors="replace")


def slugify(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.strip().lower())
    return s.strip("-")


def parse_leadership(html: str) -> list[dict]:
    """Each leader block in the page is roughly:
         <img src='images/bio_<id>.<ext>' ...>
         <section class='textBlock'>
           <h4>Name</h4>
           <h5 ...>Title</h5>
           <p>Bio...</p>
         </section>
    Walk all bio_ images in order, then for each, pull the next h4 + h5.
    """
    leaders = []
    # Find every img + the following textBlock as a single match
    pattern = re.compile(
        r"<img\s+src=['\"](?P<src>images/bio_\d+\.[a-zA-Z]+)['\"][^>]*>"
        r"\s*<section[^>]*class=['\"][^'\"]*textBlock[^'\"]*['\"][^>]*>"
        r"(?P<block>.*?)</section>",
        re.IGNORECASE | re.DOTALL,
    )
    for m in pattern.finditer(html):
        src = m.group("src")
        block = m.group("block")
        # Extract h4 (name) and h5 (title)
        # Site uses <h2> for name and <h3 class='position'> for title
        h4 = re.search(r"<h2[^>]*>(.*?)</h2>", block, re.IGNORECASE | re.DOTALL)
        h5 = re.search(r"<h3[^>]*>(.*?)</h3>", block, re.IGNORECASE | re.DOTALL)
        # Strip tags + whitespace
        def clean(s):
            if not s: return ""
            s = re.sub(r"<[^>]+>", " ", s)
            s = re.sub(r"\s+", " ", s).strip()
            # Decode common HTML entities
            return (s.replace("&amp;", "&").replace("&#8217;", "'")
                     .replace("&#8211;", "-").replace("&#8220;", '"').replace("&#8221;", '"'))
        name = clean(h4.group(1) if h4 else "")
        title = clean(h5.group(1) if h5 else "")
        if not name:
            continue
        ext = src.split(".")[-1].lower()
        slug = slugify(name)
        leaders.append({
            "name": name,
            "title": title,
            "slug": slug,
            "ext": ext,
            "source_image_url": f"https://www.superhosthospitality.com/{src}",
            "local_path": f"/brand/team/{slug}.{ext}",
        })
    return leaders


def download_image(url: str, dest: Path, force: bool) -> tuple[str, int]:
    """Returns (status, bytes). status: 'fetched' | 'cached' | 'failed'."""
    if dest.exists() and dest.stat().st_size > 0 and not force:
        return ("cached", dest.stat().st_size)
    try:
        data = fetch(url, binary=True)
        if not data:
            return ("failed", 0)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return ("fetched", len(data))
    except Exception as e:
        print(f"  [ERR] {url}: {e}")
        return ("failed", 0)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--force", action="store_true", help="Re-download even if cached")
    p.add_argument("--source", default=SOURCE_URL, help=f"Leadership page URL (default {SOURCE_URL})")
    args = p.parse_args()

    print(f"Fetching {args.source} ...")
    html = fetch(args.source)
    leaders = parse_leadership(html)
    print(f"Parsed {len(leaders)} leaders.\n")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Download photos
    for i, L in enumerate(leaders, 1):
        dest = ROOT / "public" / L["local_path"].lstrip("/")
        status, n = download_image(L["source_image_url"], dest, args.force)
        print(f"  {i:>2}. {L['name']:<28} {L['title'][:40]:<40} {status:<8} {n:>7} bytes  -> {L['local_path']}")
        L["bytes"] = n
        L["status"] = status

    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "source": args.source,
        "count": len(leaders),
        "leaders": leaders,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n[OK] Wrote {MANIFEST.relative_to(ROOT)}  ({len(leaders)} leaders)")
    failed = [L for L in leaders if L["status"] == "failed"]
    if failed:
        print(f"\n[WARN] {len(failed)} download(s) failed:")
        for L in failed:
            print(f"  - {L['name']}: {L['source_image_url']}")


if __name__ == "__main__":
    main()
