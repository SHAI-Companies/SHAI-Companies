"""
Generate a polished, emailable PDF version of the persona intake form.

Reads the canonical schema at superhost-agents/personas/intake-schema.json
and produces an A4 PDF a leader can fill in (Adobe Reader form fields, or
print-and-write-by-hand). Brand-aligned: SHAI navy / pink / blue palette.

Usage:
    python tools-generate-intake-pdf.py
        Generates a blank form at out/personas/intake-form-blank.pdf

    python tools-generate-intake-pdf.py --slug tim-foley
        Pre-fills the leader's name + title (and optional email) from
        public/brand/team/manifest.json + data.contacts.corporate.
        Output: out/personas/intake-form-tim-foley.pdf

    python tools-generate-intake-pdf.py --all
        Generates one PDF per leader from manifest.json (14 PDFs).

    python tools-generate-intake-pdf.py --out path/to/file.pdf
        Override output path.

The PDF has fillable AcroForm fields where it makes sense (text, textarea,
checkboxes for radio/multiselect, sliders rendered as numbered scales).
Adobe Reader users can type directly into the form, save, and email back.
Paper users print and fill by hand.
"""
from __future__ import annotations
import argparse
import json
import sys
import time
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, Flowable
)
from reportlab.pdfbase import pdfform
from reportlab.pdfbase.acroform import AcroForm
from reportlab.lib.enums import TA_LEFT

# ─────────────────────────────────────────────────────────────────────────────
# Paths + brand palette
# ─────────────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
SCHEMA_PATH = ROOT / "superhost-agents" / "personas" / "intake-schema.json"
MANIFEST_PATH = ROOT / "public" / "brand" / "team" / "manifest.json"
DATA_JSON = ROOT / "data.json"
# Default output: public/downloads/ so the hub serves them as static at
# /downloads/SHAI-Persona-Intake-*.pdf — Chris can attach to email or link
# straight to a leader's PDF from the intake form.
OUT_DIR = ROOT / "public" / "downloads"

# SHAI brand
NAVY = colors.HexColor("#0B1F3A")
NAVY_2 = colors.HexColor("#0d2547")
PINK = colors.HexColor("#FF2DB2")
BLUE = colors.HexColor("#1A6BFF")
SLATE = colors.HexColor("#6B7A90")
INK = colors.HexColor("#1F2C44")
INK_DIM = colors.HexColor("#5A6A88")
LIGHT = colors.HexColor("#F2F4F7")
LINE = colors.HexColor("#C8D0DE")

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def load_schema():
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def load_manifest():
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return {"leaders": []}


def load_corp_contacts():
    """Returns the corporate-roster slug -> contact dict, or {} if none."""
    if not DATA_JSON.exists():
        return {}
    try:
        d = json.loads(DATA_JSON.read_text(encoding="utf-8"))
        return ((d.get("contacts") or {}).get("corporate")) or {}
    except Exception:
        return {}


def get_leader(slug):
    """Returns dict with name, title, email, cell, photo or None.

    Lookup precedence:
      1) public/brand/team/manifest.json — the corporate-team roster
      2) data.json -> personas[slug] — custom-created clients added via the
         POST /api/personas/create endpoint (the "+ New Client" button in
         persona-intake.html). These do NOT live in the manifest.
    """
    # 1) Manifest lookup (corp team)
    manifest = load_manifest()
    leader = next((L for L in manifest.get("leaders", []) if L.get("slug") == slug), None)
    if leader:
        corp = load_corp_contacts().get(slug, {})
        return {
            "slug": slug,
            "name": leader.get("name", ""),
            "title": leader.get("title", ""),
            "email": corp.get("email", "") if corp else "",
            "cell": corp.get("cell", "") if corp else "",
        }
    # 2) data.json -> personas[slug] (custom-created clients)
    if DATA_JSON.exists():
        try:
            data = json.loads(DATA_JSON.read_text(encoding="utf-8"))
        except Exception:
            data = {}
        persona = (data.get("personas") or {}).get(slug)
        if persona:
            return {
                "slug": slug,
                "name": persona.get("name", "") or slug,
                "title": persona.get("title", ""),
                "email": "",
                "cell": "",
            }
    return None


def styles():
    s = getSampleStyleSheet()
    return {
        "title":      ParagraphStyle("title", parent=s["Title"], fontName="Helvetica-Bold",
                                     fontSize=22, leading=26, textColor=NAVY, spaceAfter=6),
        "subtitle":   ParagraphStyle("subtitle", parent=s["Normal"], fontName="Helvetica",
                                     fontSize=11, leading=15, textColor=INK_DIM, spaceAfter=14),
        "h2":         ParagraphStyle("h2", parent=s["Heading2"], fontName="Helvetica-Bold",
                                     fontSize=14, leading=18, textColor=NAVY,
                                     spaceBefore=14, spaceAfter=6, keepWithNext=1),
        "sec_desc":   ParagraphStyle("sec_desc", parent=s["Normal"], fontName="Helvetica-Oblique",
                                     fontSize=9.5, leading=13, textColor=INK_DIM, spaceAfter=10),
        "field_lbl":  ParagraphStyle("field_lbl", parent=s["Normal"], fontName="Helvetica-Bold",
                                     fontSize=10, leading=13, textColor=NAVY, spaceAfter=2),
        "field_help": ParagraphStyle("field_help", parent=s["Normal"], fontName="Helvetica-Oblique",
                                     fontSize=8.5, leading=11, textColor=INK_DIM, spaceAfter=4),
        "small":      ParagraphStyle("small", parent=s["Normal"], fontName="Helvetica",
                                     fontSize=9, leading=12, textColor=INK_DIM),
        "body":       ParagraphStyle("body", parent=s["Normal"], fontName="Helvetica",
                                     fontSize=10, leading=14, textColor=INK),
        "eyebrow":    ParagraphStyle("eyebrow", parent=s["Normal"], fontName="Helvetica-Bold",
                                     fontSize=8.5, leading=11, textColor=PINK,
                                     spaceAfter=4, alignment=TA_LEFT),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Custom flowables — write-in lines, checkboxes, scale ticks
# ─────────────────────────────────────────────────────────────────────────────
class WriteLine(Flowable):
    """A single horizontal line for short text answers."""
    def __init__(self, width, height=14):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.line(0, 0, self.width, 0)

    def wrap(self, *args):
        return self.width, self.height


class WriteBox(Flowable):
    """A bordered box for textarea answers (multi-line write-in)."""
    def __init__(self, width, height=72):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.rect(0, 0, self.width, self.height, stroke=1, fill=0)
        # Add light horizontal guidelines for handwriting
        c.setStrokeColor(colors.HexColor("#EEF1F6"))
        c.setLineWidth(0.3)
        line_height = 14
        n_lines = max(1, int(self.height / line_height) - 1)
        for i in range(1, n_lines + 1):
            y = self.height - (i * line_height)
            c.line(4, y, self.width - 4, y)

    def wrap(self, *args):
        return self.width, self.height


class CheckboxList(Flowable):
    """Vertical list of checkbox + label rows for radio/multiselect."""
    def __init__(self, width, options, multi=False, row_height=15):
        super().__init__()
        self.width = width
        self.options = options
        self.multi = multi
        self.row_height = row_height

    def draw(self):
        c = self.canv
        c.setFont("Helvetica", 9.5)
        for i, opt in enumerate(self.options):
            y = self.height - ((i + 1) * self.row_height) + 4
            c.setStrokeColor(NAVY)
            c.setLineWidth(0.7)
            c.rect(0, y, 9, 9, stroke=1, fill=0)
            c.setFillColor(INK)
            c.drawString(15, y + 1, opt)

    def wrap(self, *args):
        self.height = max(15, len(self.options) * self.row_height)
        return self.width, self.height


class SliderScale(Flowable):
    """A 1-10 numbered scale with circles to mark."""
    def __init__(self, width, lo=1, hi=10):
        super().__init__()
        self.width = width
        self.lo = lo
        self.hi = hi
        self.height = 28

    def draw(self):
        c = self.canv
        n = self.hi - self.lo + 1
        slot = self.width / n
        c.setFont("Helvetica", 8.5)
        c.setStrokeColor(NAVY)
        c.setFillColor(NAVY)
        for i in range(n):
            x = slot * (i + 0.5)
            # Circle
            c.setStrokeColor(NAVY)
            c.setLineWidth(0.7)
            c.setFillColor(colors.white)
            c.circle(x, 14, 6, stroke=1, fill=1)
            # Number
            c.setFillColor(INK)
            c.drawCentredString(x, 0, str(self.lo + i))

    def wrap(self, *args):
        return self.width, self.height


class RankedList(Flowable):
    """Numbered options with a write-in line for the rank number."""
    def __init__(self, width, options, row_height=18):
        super().__init__()
        self.width = width
        self.options = options
        self.row_height = row_height

    def draw(self):
        c = self.canv
        c.setFont("Helvetica", 9.5)
        for i, opt in enumerate(self.options):
            y = self.height - ((i + 1) * self.row_height) + 6
            # Rank box (write the rank number here)
            c.setStrokeColor(NAVY)
            c.setLineWidth(0.7)
            c.rect(0, y - 2, 18, 12, stroke=1, fill=0)
            # Option label
            c.setFillColor(INK)
            c.drawString(24, y + 1, opt)

    def wrap(self, *args):
        self.height = max(18, len(self.options) * self.row_height)
        return self.width, self.height


# ─────────────────────────────────────────────────────────────────────────────
# PDF builder
# ─────────────────────────────────────────────────────────────────────────────
def build_pdf(out_path: Path, schema: dict, leader: dict | None = None):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    margin = 0.6 * inch
    page_w, page_h = LETTER
    text_w = page_w - 2 * margin

    def header_footer(canv, doc):
        # Header band
        canv.saveState()
        canv.setFillColor(NAVY)
        canv.rect(0, page_h - 0.45 * inch, page_w, 0.45 * inch, stroke=0, fill=1)
        canv.setFillColor(colors.white)
        canv.setFont("Helvetica-Bold", 9.5)
        canv.drawString(margin, page_h - 0.3 * inch, "SHAI · Persona Intake")
        canv.setFont("Helvetica", 8.5)
        canv.setFillColor(colors.HexColor("#A8C0E8"))
        canv.drawRightString(page_w - margin, page_h - 0.3 * inch,
                             f"Schema v{schema.get('meta', {}).get('version', 1)} · {time.strftime('%Y-%m-%d')}")
        # Footer
        canv.setFillColor(SLATE)
        canv.setFont("Helvetica", 8)
        canv.drawCentredString(page_w / 2, 0.4 * inch,
                               f"Page {doc.page} · Return completed form to chatfield@superhosthospitality.com")
        canv.restoreState()

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=LETTER,
        leftMargin=margin, rightMargin=margin,
        topMargin=margin + 0.3 * inch, bottomMargin=margin + 0.2 * inch,
        title="SHAI Persona Intake",
        author="Superhost Hospitality",
    )

    sty = styles()
    story = []

    # ── Cover / instructions ─────────────────────────────────────────────
    story.append(Paragraph("Persona Intake Form", sty["title"]))
    if leader and leader.get("name"):
        story.append(Paragraph(f"Prepared for: <b>{leader['name']}</b>{' · ' + leader['title'] if leader.get('title') else ''}", sty["subtitle"]))
    else:
        story.append(Paragraph("Blank form — to be assigned at the top of page 2.", sty["subtitle"]))

    story.append(Paragraph("What this is", sty["h2"]))
    story.append(Paragraph(
        "This form captures everything the Superhost Executive Hub needs to authentically represent you in writing — "
        "how you read data, how you decide, how you talk to ownership, how your voice actually sounds. "
        "Filled out, it becomes the system prompt the hub's AI uses when someone asks a question of you specifically. "
        "Unfilled, the AI gives generic answers in your name; we'd rather it didn't.",
        sty["body"]))
    story.append(Spacer(1, 8))

    story.append(Paragraph("How to fill it out", sty["h2"]))
    story.append(Paragraph(
        "<b>Adobe Reader</b>: open the PDF and type directly into the boxes (most fields are fillable). Save and email back to chatfield@superhosthospitality.com.<br/>"
        "<b>Paper</b>: print, fill by hand, scan, and email the scan back.<br/>"
        "<b>Time</b>: budget about 45 minutes for the full form. Section H — voice training samples — is the most valuable; spend the most time there.<br/>"
        "<b>Optional</b>: any field can be left blank, but * marks the ones the hub really needs. Personal touches (Section J) are entirely optional.",
        sty["body"]))
    story.append(Spacer(1, 10))

    story.append(Paragraph("What happens to your answers", sty["h2"]))
    story.append(Paragraph(
        "Your answers go into the hub's data store and become part of the AI persona that speaks in your name. "
        "Internal use only — never shared with owners, brands, or anyone outside Superhost. "
        "You can review or edit your intake at any time via the Hub's Persona Intake screen. "
        "Constraints in Section I (what the AI is forbidden to say in your voice) are enforced absolutely.",
        sty["body"]))

    if not leader:
        story.append(Spacer(1, 14))
        story.append(Paragraph("Assigned to:", sty["h2"]))
        rows = [["Name", WriteLine(text_w - 80)],
                ["Title", WriteLine(text_w - 80)],
                ["Date", WriteLine(text_w - 80)]]
        t = Table(rows, colWidths=[80, text_w - 80])
        t.setStyle(TableStyle([
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (0,-1), 10),
            ("TEXTCOLOR", (0,0), (0,-1), NAVY),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ("TOPPADDING", (0,0), (-1,-1), 6),
        ]))
        story.append(t)

    story.append(PageBreak())

    # ── Sections ─────────────────────────────────────────────────────────
    sections = schema.get("sections", [])
    for sec_idx, sec in enumerate(sections):
        story.append(Paragraph(sec["title"], sty["h2"]))
        if sec.get("description"):
            story.append(Paragraph(sec["description"], sty["sec_desc"]))

        for f in sec.get("fields", []):
            label = f["label"] + (" *" if f.get("required") else "")
            help_text = ""
            if f.get("placeholder"):
                help_text = "<i>e.g. " + str(f["placeholder"]) + "</i>"

            # Pre-fill display for known fields when leader is set
            prefill_value = ""
            if leader and sec["id"] == "identity":
                if f["id"] == "fullName":
                    prefill_value = leader.get("name", "")
                elif f["id"] == "title":
                    prefill_value = leader.get("title", "")

            # Field rendering by type
            ftype = f.get("type")
            block = []
            block.append(Paragraph(label, sty["field_lbl"]))
            if help_text:
                block.append(Paragraph(help_text, sty["field_help"]))

            if ftype == "text" or ftype == "number":
                if prefill_value:
                    # If pre-filled, show the value above the line
                    block.append(Paragraph(f"<b>{prefill_value}</b>", sty["body"]))
                    block.append(Spacer(1, 2))
                else:
                    block.append(WriteLine(text_w))
                block.append(Spacer(1, 8))
            elif ftype == "textarea":
                rows = f.get("rows", 3)
                # 16pt per row, min 60pt
                box_h = max(60, rows * 16)
                block.append(WriteBox(text_w, box_h))
                block.append(Spacer(1, 8))
            elif ftype == "select":
                opts = f.get("options", [])
                # Render as a checkbox list (radio) for paper-friendliness
                block.append(CheckboxList(text_w, opts, multi=False))
                block.append(Spacer(1, 6))
            elif ftype == "radio":
                opts = f.get("options", [])
                block.append(CheckboxList(text_w, opts, multi=False))
                block.append(Spacer(1, 6))
            elif ftype == "multiselect":
                opts = f.get("options", [])
                block.append(Paragraph("<i>Check all that apply.</i>", sty["field_help"]))
                block.append(CheckboxList(text_w, opts, multi=True))
                block.append(Spacer(1, 6))
            elif ftype == "slider":
                lo = f.get("min", 1); hi = f.get("max", 10)
                block.append(Paragraph(f"<i>Circle the number that fits ({lo} = low / {hi} = high)</i>", sty["field_help"]))
                block.append(SliderScale(text_w * 0.7, lo, hi))
                block.append(Spacer(1, 6))
            elif ftype == "ranked":
                opts = f.get("options", [])
                block.append(Paragraph("<i>Number each from 1 (most important) to " + str(len(opts)) + " (least). Write the number in the box on the left.</i>", sty["field_help"]))
                block.append(RankedList(text_w, opts))
                block.append(Spacer(1, 6))
            else:
                block.append(WriteLine(text_w))
                block.append(Spacer(1, 8))

            # Keep each field block together so it doesn't split across pages
            story.append(KeepTogether(block))

        # Section divider
        story.append(Spacer(1, 12))
        if sec_idx < len(sections) - 1:
            # Page-break heuristic: long sections get their own page
            field_count = len(sec.get("fields", []))
            if field_count >= 7:
                story.append(PageBreak())

    # Final return-instructions footer page
    story.append(PageBreak())
    story.append(Paragraph("You're done.", sty["title"]))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Save the filled PDF and email it to <b>chatfield@superhosthospitality.com</b>, "
        "or hand back the printed copy. Once submitted, your AI persona is live in the Hub "
        "within a business day — every time someone asks for your perspective in writing, "
        "your voice carries the answer.",
        sty["body"]))
    story.append(Spacer(1, 18))
    story.append(Paragraph("Questions about a specific field?", sty["h2"]))
    story.append(Paragraph(
        "Reach out directly. The form is meant to capture how you actually think — "
        "if a question doesn't fit your role, write \"N/A\" and move on.",
        sty["body"]))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    return out_path


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--slug", help="Generate a per-leader pre-filled form")
    p.add_argument("--all", action="store_true", help="Generate one PDF per leader from manifest")
    p.add_argument("--out", help="Override output path (single-PDF mode only)")
    args = p.parse_args()

    schema = load_schema()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.all:
        manifest = load_manifest()
        leaders = manifest.get("leaders", [])
        if not leaders:
            print("No leaders in manifest — run tools-fetch-leadership.py first.")
            return
        # Always also generate a blank version (for new hires not in the manifest)
        blank_out = OUT_DIR / "SHAI-Persona-Intake-Form.pdf"
        build_pdf(blank_out, schema, None)
        print(f"  [OK] {blank_out.relative_to(ROOT)}  (blank)")
        for L in leaders:
            slug = L.get("slug")
            if not slug:
                continue
            leader = get_leader(slug)
            # Use a friendly filename: SHAI-Persona-Intake-Tim-Foley.pdf
            friendly = "-".join(p.capitalize() for p in slug.split("-"))
            out = OUT_DIR / f"SHAI-Persona-Intake-{friendly}.pdf"
            build_pdf(out, schema, leader)
            print(f"  [OK] {out.relative_to(ROOT)}  ({leader['name']})")
        print(f"\nGenerated {len(leaders) + 1} PDFs in {OUT_DIR.relative_to(ROOT)}")
        print("Hub serves them at /downloads/SHAI-Persona-Intake-<Name>.pdf")
        return

    if args.slug:
        leader = get_leader(args.slug)
        if not leader:
            print(f"Unknown leader slug: {args.slug}")
            print("Available slugs:")
            for L in load_manifest().get("leaders", []):
                print(f"  - {L['slug']:<32} {L['name']}")
            sys.exit(1)
        friendly = "-".join(p.capitalize() for p in args.slug.split("-"))
        out = Path(args.out) if args.out else OUT_DIR / f"SHAI-Persona-Intake-{friendly}.pdf"
    else:
        out = Path(args.out) if args.out else OUT_DIR / "SHAI-Persona-Intake-Form.pdf"
        leader = None

    build_pdf(out, schema, leader)
    print(f"[OK] Wrote {out}")
    print(f"     Pages: depend on schema fields; ~12-16 pages with 10 sections.")
    print(f"     Email this PDF to the leader. They fill in Adobe Reader or print + write by hand.")


if __name__ == "__main__":
    main()
