const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber, PageBreak } = require('docx');

// ─── Shared constants ───
const NAVY = "0D2137";
const TEAL = "1A7E8F";
const GOLD = "C8963F";
const LTGRAY = "F2F5F8";
const WHITE = "FFFFFF";
const BLACK = "1A1A1A";
const DKGRAY = "4A5568";

const PAGE_W = 12240;
const PAGE_H = 15840;
const MARGIN = 1440;
const CONTENT_W = PAGE_W - MARGIN * 2; // 9360

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const cellPad = { top: 80, bottom: 80, left: 120, right: 120 };

// ─── Helper: tip box (table with teal left border) ───
function tipBox(text) {
  const tealBorder = { style: BorderStyle.SINGLE, size: 12, color: TEAL };
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: { top: noBorder, bottom: noBorder, right: noBorder, left: tealBorder },
            shading: { fill: "EBF5F7", type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 200, right: 200 },
            width: { size: CONTENT_W, type: WidthType.DXA },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "PRO TIP: ", bold: true, font: "Arial", size: 20, color: TEAL }),
                  new TextRun({ text, font: "Arial", size: 20, color: DKGRAY }),
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

// ─── Helper: section intro paragraph ───
function intro(text) {
  return new Paragraph({
    spacing: { before: 60, after: 200 },
    children: [new TextRun({ text, font: "Arial", size: 22, color: DKGRAY, italics: true })]
  });
}

// ─── Helper: body paragraph ───
function body(text) {
  return new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text, font: "Arial", size: 22, color: BLACK })]
  });
}

// ─── Helper: bullet item ───
function bullet(text, ref) {
  return new Paragraph({
    numbering: { reference: ref || "bullets", level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 22, color: BLACK })]
  });
}

// ─── Helper: sub-bullet ───
function subBullet(text, ref) {
  return new Paragraph({
    numbering: { reference: ref || "bullets", level: 1 },
    spacing: { after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 20, color: DKGRAY })]
  });
}

function spacer(pts) {
  return new Paragraph({ spacing: { before: pts || 100, after: 0 }, children: [] });
}

// ─── BUILD DOCUMENT ───
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: TEAL },
        paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: GOLD },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u2013", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        ] },
      { reference: "numbers",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        ] },
    ]
  },
  sections: [
    // ══════════════════════ COVER PAGE ══════════════════════
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
        }
      },
      children: [
        spacer(2400),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "SUPERHOST HOSPITALITY", font: "Arial", size: 20, bold: true, color: TEAL, characterSpacing: 300 })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "Executive Operations Hub", font: "Arial", size: 52, bold: true, color: NAVY })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: GOLD, space: 8 } },
          children: []
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "User Guide & Section Reference", font: "Arial", size: 28, color: DKGRAY })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: "Version 3.0  |  April 2026", font: "Arial", size: 22, color: "8899AA" })]
        }),
        spacer(2000),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Confidential \u2014 Internal Use Only", font: "Arial", size: 18, color: "8899AA", italics: true })]
        }),
      ]
    },

    // ══════════════════════ TABLE OF CONTENTS + OVERVIEW ══════════════════════
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: TEAL, space: 4 } },
            children: [
              new TextRun({ text: "Superhost Executive Hub \u2014 User Guide", font: "Arial", size: 16, color: "8899AA" })
            ]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "Page ", font: "Arial", size: 16, color: "8899AA" }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "8899AA" }),
            ]
          })]
        })
      },
      children: [
        // OVERVIEW
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Overview")] }),
        body("The Superhost Executive Operations Hub is a centralized command center for portfolio-level hotel performance management. It consolidates live ProfitSword data, manual KPI entry, AI-powered analysis, brand compliance, and ownership reporting into a single browser-based interface."),
        body("This guide walks through every section of the Hub, explains what each view is designed to do, and provides practical tips for getting the most value from each feature."),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Getting Started")] }),
        body("The Hub runs locally on your machine (localhost:3000). On launch, you\u2019ll see the PIN screen if a HUB_PIN is configured in your .env file. Enter the 4-digit PIN to proceed. If no PIN is set, the Hub loads directly to the AI Command view."),
        body("The header bar shows the current data source status (Live or Demo mode), active period selector, and a Refresh button to pull the latest data from ProfitSword. The sidebar on the left provides navigation to all sections."),

        tipBox("Set your active period in the header dropdown before running any analysis. All KPI cards, leaderboard rankings, and AI responses reference the selected period."),
        spacer(100),

        // ─── 1. AI COMMAND ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. AI Command")] }),
        intro("Your primary interface for asking questions, generating analysis, and drafting communications across the entire portfolio."),
        body("The AI Command panel is a conversational interface powered by Claude. It has access to every property\u2019s current KPIs, budget variances, compliance records, ownership groups, and RDO assignments. You can ask natural-language questions and receive structured, data-backed responses."),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Mode Buttons")] }),
        body("Five mode buttons at the bottom of the chat control the AI\u2019s persona and response style:"),
        bullet("Executive \u2014 Default mode. Portfolio-level analysis, NOI focus, strategic recommendations."),
        bullet("Owner Lens \u2014 Frames responses from an ownership/investor perspective. Emphasizes distributions, cap rate impact, and asset value."),
        bullet("GM Coach \u2014 Shifts tone to direct property-level coaching. Focuses on actionable steps a GM can execute this week."),
        bullet("Revenue \u2014 Revenue management focus. Rate strategy, comp set positioning, channel mix, demand analysis."),
        bullet("Drafting \u2014 Generates ready-to-send emails, memos, and narratives. Specify the audience and the AI adapts tone accordingly."),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Quick Prompts")] }),
        body("Pre-built prompt tiles appear on the welcome screen for common tasks: portfolio NOI vs. budget, negative flow-through flags, GM accountability emails, RDO territory diagnostics, ownership call prep, and forecast stress tests. Click any tile to instantly launch that query."),

        tipBox("Use GM Coach mode before a property review call. Ask it to prep you on a specific property \u2014 it will surface the KPIs, variances, and talking points you need."),
        spacer(100),

        // ─── 2. DASHBOARD ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. Dashboard")] }),
        intro("The portfolio-level snapshot. Eight KPI cards, RDO territory summary, and active alerts in a single view."),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("KPI Cards")] }),
        body("Eight cards display weighted portfolio averages for the active period:"),
        bullet("Total Operating Revenue \u2014 Sum of all property revenues (TOTOPRV from ProfitSword)."),
        bullet("Occupancy \u2014 Portfolio-wide occupied rooms \u00F7 available rooms."),
        bullet("ADR \u2014 Portfolio-wide room revenue \u00F7 occupied rooms."),
        bullet("RevPAR \u2014 Portfolio-wide room revenue \u00F7 available rooms."),
        bullet("GOP \u2014 Gross Operating Profit as a percentage of total revenue."),
        bullet("NOI \u2014 Net Operating Income, summed across properties."),
        bullet("Flow% \u2014 Adjusted flex/flow-through percentage using the Superhost 3-step formula."),
        bullet("Score \u2014 Average composite score across all properties."),
        spacer(60),
        body("Each card is clickable. Clicking opens a detail modal showing the top 3 and bottom 3 performers for that metric, followed by a full property breakdown with horizontal bar charts for visual comparison."),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("RDO Snapshot")] }),
        body("Below the KPI cards, the RDO Snapshot section shows territory-level rollups \u2014 one card per RDO with property count, average score, RevPAR, and top/bottom performers. This is a quick visual check on which territory is leading and which needs attention."),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Active Alerts")] }),
        body("The bottom section surfaces any alerts (critical, watch, or informational) that are currently active. Alerts are created on the Alerts tab and flow to both the Dashboard and the sidebar badge count."),

        tipBox("Click on a KPI card to instantly see which properties are dragging the portfolio average down. This saves the trip to the Leaderboard for quick diagnostics."),
        spacer(100),

        // ─── 3. LEADERBOARD ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. Leaderboard")] }),
        intro("Ranked property table with filtering by RDO territory, ownership group, and brand \u2014 sortable by any KPI."),
        body("The Leaderboard is the primary property comparison view. Every active property appears in a sortable table with columns for Score, RevPAR, vs. Budget, Occ%, ADR, GOP%, Flow%, and RevPAR Index."),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Filters")] }),
        body("Two dropdown filters sit above the table:"),
        bullet("Portfolio Filter \u2014 Narrow by RDO (Tim, Jennifer, Mark), ownership group (Lakhany, Capitol One, Gateway, Alpental, INDC, Gulfstream), or brand family (Hilton, Marriott, IHG, Choice)."),
        bullet("Sort By \u2014 Choose the primary sort column: Score (default), RevPAR, GOP%, Flow%, Occ%, or RevPAR Index."),
        spacer(60),
        body("Each row includes a color-coded Status badge (green/amber/red) and Pace indicator. The Updated column shows when data was last refreshed for that property."),

        tipBox("Sort by Flow% to quickly identify which GMs are converting revenue variance into profit. A property with high revenue but low flow signals cost control issues worth investigating."),
        spacer(100),

        // ─── 4. COMPARE ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. Compare")] }),
        intro("Side-by-side period-over-period comparison. Select two months to see movement across every property."),
        body("Choose Period A and Period B from the dropdowns, then click Compare. The view generates a summary KPI row showing the portfolio-level delta, followed by a property-by-property comparison table with variance columns for all key metrics."),
        body("This is particularly useful for identifying trend breaks \u2014 a property that was improving in March but reversed in April, or a territory that is pulling ahead."),

        tipBox("Use Compare before ownership calls to frame the narrative: \u201CRevPAR moved from $X to $Y period-over-period, driven by [these properties].\u201D"),
        spacer(100),

        // ─── 5. RDO TEAMS ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. RDO Teams")] }),
        intro("Territory-level performance view organized by Regional Director of Operations."),
        body("The RDO Teams panel displays one card per RDO with aggregate KPIs across their assigned properties. Below the cards, an Action Items section lists flagged items for each territory, and a full Property Assignment table shows the complete RDO-to-property mapping."),
        body("Use this view to prepare for RDO check-ins or to compare territory performance side-by-side. If one RDO\u2019s portfolio consistently outperforms, that\u2019s a coaching opportunity for the others."),

        tipBox("Before your weekly ops call, pull up RDO Teams and ask the AI Command (in GM Coach mode): \u201CWhat should I push [RDO name] on this week?\u201D"),
        spacer(100),

        // ─── 6. OWNERSHIP ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. Ownership")] }),
        intro("Group properties by ownership entity for investor-facing analysis."),
        body("The Ownership view organizes performance data by ownership group \u2014 Lakhany Group, Capitol One, Gateway, Alpental Capital, INDC, and Gulfstream. Each group gets a summary card with aggregate Score, RevPAR, GOP%, and property count."),
        body("The Portfolio by Ownership table below provides the detail: each property sorted under its owner with Score, RevPAR, vs. Budget, GOP%, and Flow%."),
        body("This is the view to reference when preparing ownership reports, asset management calls, or board presentations. It answers the question every owner asks: \u201CHow are my properties performing relative to budget?\u201D"),

        tipBox("Use the Generate tab\u2019s Owner Narrative feature after reviewing this data \u2014 it drafts the actual narrative you\u2019d send to each ownership group."),
        spacer(100),

        // ─── 7. FORECAST ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. Forecast")] }),
        intro("Forward-looking pace analysis, GM forecast credibility scoring, and flow-through tracking."),
        body("The Forecast panel opens with summary KPI cards showing forward-looking pace data. Below that, three distinct sections provide operational intelligence:"),
        bullet("30-Day Forward Outlook \u2014 Weekly pace projections based on booking data and historical patterns."),
        bullet("GM Forecast Credibility \u2014 Compares each GM\u2019s submitted forecast against actuals over time. Properties where GMs consistently over-forecast or under-forecast are flagged."),
        bullet("Flow-Through Tracker \u2014 The Superhost flex/flow calculation applied at the property level. Shows the 3-step adjusted flow percentage alongside revenue and GOP variance for each property."),
        spacer(60),
        body("The flow-through formula follows Superhost\u2019s standard: (1) Revenue Variance = Actual Revenue \u2013 Budget Revenue, (2) GOP Variance = Actual GOP \u2013 Budget GOP, (3) Adjusted = if GOP Variance > 0 and Rev Variance > 0, use GOP Variance; otherwise, GOP Variance \u2013 Rev Variance, (4) Flow% = Adjusted \u00F7 |Revenue Variance|."),

        tipBox("A flow-through above 50% is strong. Between 30\u201350% is acceptable. Below 30% signals cost leakage that needs immediate GM attention."),
        spacer(100),

        // ─── 8. BRAND QA ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("8. Brand QA & Compliance")] }),
        intro("QA scores, inspection tracking, PIP management, and AI-powered brand audit PDF extraction."),
        body("The Brand QA tab tracks compliance health across all brand families. Each property card shows QA score, last inspection date, next inspection window, open PIPs, status (Compliant, Watch, At-Risk, In PIP), and a deficiency list when available."),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Sorting & Filtering")] }),
        body("Two dropdowns at the top allow you to sort (by Name, QA Score, Next Inspection, Open PIPs, or Status) and filter (All, Compliant, Watch, At Risk, In PIP). Use these to triage \u2014 sort by QA Score ascending to immediately see the weakest performers."),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Adding / Updating Records")] }),
        body("Click \u201C+ Add / Update\u201D to manually enter or edit QA data for any property. The modal captures score, dates, PIP count, and notes."),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("PDF Brand Audit Upload")] }),
        body("Click \u201CUpload Brand Audit PDF\u201D to upload an inspection report directly from a brand\u2019s portal. The system extracts the PDF text, sends it to Claude for structured analysis, and automatically populates the property\u2019s compliance record with the extracted score, deficiencies, and inspection date."),

        tipBox("Upload brand audit PDFs as soon as they arrive. The AI extraction captures deficiency details that are easy to miss in a manual review."),
        spacer(100),

        // ─── 9. PIPELINE ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("9. Pipeline")] }),
        intro("Development property tracker for openings, pre-opening milestones, and brand status."),
        body("The Pipeline tab manages properties that are not yet operating. Each entry tracks the property name, brand, location, target opening date, current phase (Planning, Construction, Pre-Opening, Soft Open), assigned RDO, and milestone notes."),
        body("Sort by opening date to see what\u2019s coming next, or filter by phase to focus on properties that need pre-opening attention. The pipeline count appears as a badge in the sidebar navigation."),

        tipBox("Keep the Pipeline current \u2014 when a property reaches Soft Open, update it here and add it to your active property list with Data Entry so KPIs start flowing immediately."),
        spacer(100),

        // ─── 10. GENERATE ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("10. Generate")] }),
        intro("One-click AI document generation using live portfolio data."),
        body("The Generate panel provides pre-built document templates that pull your current data and produce ready-to-send outputs:"),
        bullet("RDO Recap \u2014 A structured weekly territory summary for each RDO with KPI highlights, variance flags, and action items."),
        bullet("GM Prep \u2014 A pre-meeting property briefing for a specific GM. Select the property from the dropdown and the AI generates a prep sheet with performance data, talking points, and questions to ask."),
        bullet("Portfolio Scorecard \u2014 A formatted, printable scorecard across all properties. Includes a Print/PDF button for generating a hard copy."),
        spacer(60),
        body("Generated outputs appear inline with Copy, Email, and Print options. The scorecard can be printed directly from the browser or saved as a PDF."),

        tipBox("Generate a GM Prep before every 1:1. It takes 5 seconds and ensures you\u2019re walking into the conversation with the right data and the right questions."),
        spacer(100),

        // ─── 11. ALERTS ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("11. Alerts")] }),
        intro("Active alert management with priority classification."),
        body("The Alerts tab lets you create and manage portfolio-wide alerts. Each alert has a title, priority level (Critical, Watch, Info), and detail text."),
        body("Critical alerts appear with a red badge in the sidebar and surface on the Dashboard. Use this for items that need immediate visibility: a failed brand inspection, a labor crisis at a property, a compliance deadline, or a revenue cliff."),
        body("Click \u201C+ New Alert\u201D to create one. Alerts persist until manually dismissed."),
        spacer(100),

        // ─── 12. AI TOOLKIT ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("12. AI Toolkit")] }),
        intro("Curated prompt library for common executive workflows."),
        body("The AI Toolkit is a grid of pre-built prompt cards, each targeting a specific use case. Unlike the AI Command\u2019s open-ended chat, these cards launch targeted conversations with the context pre-loaded."),
        body("Examples include: expense deep-dive, STR analysis, labor efficiency review, capital planning discussion, rate strategy brainstorm, and more. Each card opens a focused AI conversation with relevant data already injected."),

        tipBox("Browse the Toolkit before writing a prompt from scratch in AI Command. There may already be a card that covers exactly what you need."),
        spacer(100),

        // ─── 13. DATA ENTRY ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("13. Data Entry")] }),
        intro("Manual KPI entry for properties not yet connected to ProfitSword or for supplemental data."),
        body("The Data Entry view shows one card per property with fields for all key metrics: Revenue, Budget Revenue, GOP, Budget GOP, Occupied Rooms, Available Rooms, Room Revenue, Budget Room Revenue, Guest Score, NOI, Budget NOI, and more."),
        body("Enter values and click \u201CSave All\u201D to commit. The Hub calculates Occ%, ADR, RevPAR, GOP%, and Flow% automatically from the raw inputs. Saved data flows into every other panel \u2014 Dashboard, Leaderboard, Forecast, Compare, and Generate."),
        body("For properties connected to ProfitSword, you generally do not need to use Data Entry \u2014 the Refresh button in the header pulls live data. But Data Entry is useful for overrides, manual adjustments, or properties awaiting PS tag mapping."),

        tipBox("Always include both actual and budget figures for Revenue and GOP. Without budget data, Flow% cannot be calculated and will show as N/A."),
        spacer(100),

        // ─── 14. ADMIN ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("14. Admin")] }),
        intro("System configuration: ProfitSword connection, AI keys, site tag mapping, and data management."),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("ProfitSword Configuration")] }),
        body("Enter your ProfitSword/ProfitSage API credentials (username, password, base URL) and the DataSet ID. The DataSet ID determines which data layer you pull \u2014 actuals, budget, forecast, or primary forecast. Click \u201CTest\u201D to verify connectivity before saving."),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("AI (Claude) + Security")] }),
        body("Enter your Claude API key (from console.anthropic.com). Set the active period for the portfolio. The Hub PIN is controlled via the .env file for access security."),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Site Tag Mapping")] }),
        body("This is the critical link between your Hub properties and ProfitSword\u2019s system. Each property must be mapped to its correct ProfitSword site tag. Click \u201CFetch Sites from PS\u201D to auto-discover available sites and attempt name matching. Verify each mapping manually \u2014 unmapped properties (red border) will be skipped on refresh."),
        body("After mapping, click \u201CSave Mapping\u201D to persist, then \u201CRefresh All from PS\u201D to pull data for the active period."),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Data Management")] }),
        body("Export Snapshot saves the current period\u2019s data as a JSON file. Restore from JSON reloads a previous snapshot. Download Backup creates a full data dump. Clear Period Data wipes the active period \u2014 use with caution."),

        tipBox("After initial setup, verify your DataSet ID with your ProfitSword admin. Pulling from the wrong dataset is the #1 cause of numbers not matching what you see in the PS portal."),
        spacer(200),

        // ─── APPENDIX ───
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Appendix: Key Formulas")] }),
        intro("Reference for the calculations used across the Hub."),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [2800, 6560],
          rows: [
            headerRow(["Metric", "Formula"]),
            formulaRow("Occupancy %", "Occupied Rooms \u00F7 Available Rooms \u00D7 100"),
            formulaRow("ADR", "Room Revenue \u00F7 Occupied Rooms"),
            formulaRow("RevPAR", "Room Revenue \u00F7 Available Rooms"),
            formulaRow("GOP %", "Gross Operating Profit \u00F7 Total Revenue \u00D7 100"),
            formulaRow("Flow-Through %", "Step 1: RevVar = Actual Rev \u2013 Budget Rev\nStep 2: GOPVar = Actual GOP \u2013 Budget GOP\nStep 3: Adjusted = IF(GOPVar>0 AND RevVar>0, GOPVar, GOPVar \u2013 RevVar)\nStep 4: Flow% = Adjusted \u00F7 ABS(RevVar) \u00D7 100"),
            formulaRow("Composite Score", "Weighted blend of RevPAR Index, GOP%, Guest Satisfaction, and Flow%"),
          ]
        }),
      ]
    }
  ]
});

function headerRow(cells) {
  return new TableRow({
    children: cells.map((text, i) => new TableCell({
      borders,
      width: { size: i === 0 ? 2800 : 6560, type: WidthType.DXA },
      shading: { fill: NAVY, type: ShadingType.CLEAR },
      margins: cellPad,
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, font: "Arial", size: 20, color: WHITE })] })]
    }))
  });
}

function formulaRow(metric, formula) {
  return new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: 2800, type: WidthType.DXA },
        margins: cellPad,
        children: [new Paragraph({ children: [new TextRun({ text: metric, bold: true, font: "Arial", size: 20, color: NAVY })] })]
      }),
      new TableCell({
        borders,
        width: { size: 6560, type: WidthType.DXA },
        margins: cellPad,
        children: formula.split('\n').map(line =>
          new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: line, font: "DM Mono, Consolas, monospace", size: 19, color: DKGRAY })] })
        )
      })
    ]
  });
}

// ─── PACK ───
Packer.toBuffer(doc).then(buffer => {
  const outPath = process.argv[2] || 'Superhost_Hub_User_Guide.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`✓ Written to ${outPath} (${(buffer.length/1024).toFixed(0)} KB)`);
});
