/**
 * PSC Call Sheet Generator
 *
 * Generates a one-page landscape Word doc for a monthly PSC review call.
 *
 * USAGE:
 *   1. Fill in the CONFIG block below with property-specific data
 *   2. Run: node build_call_sheet.js
 *   3. Output: /home/claude/<property>_<month>_Call_Sheet.docx
 *
 * REQUIRED INPUTS (from the scorecard PDF):
 *   - Property name, month, score, trend
 *   - 6 at-a-glance metrics (most relevant for that property)
 *   - 5 lead questions tailored to the variance pattern
 *   - 8 backup questions by category
 */

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, LevelFormat, BorderStyle, WidthType,
        ShadingType, PageOrientation, Header, TabStopType } = require('docx');
const fs = require('fs');

// ============================================================
// CONFIG — FILL IN FOR EACH PROPERTY/MONTH
// ============================================================
const CONFIG = {
  property: "PROPERTY NAME HERE",          // e.g., "HOME2 SUITES LEXINGTON / HAMBURG"
  monthYear: "MONTH YYYY",                  // e.g., "March 2026"
  score: "XXX",                             // e.g., "102"
  tier: "TIER LABEL",                       // e.g., "On Track" / "Watch" / "At Risk"
  trendNote: "trend descriptor",           // e.g., "Watch March flow"
  outputFilename: "Property_Month_Call_Sheet.docx",

  // Six at-a-glance metrics — pick the most relevant for this property
  glanceLabels: ["YTD GOP", "Month Flow", "RevPAR Index", "Forecast Var", "Next Month", "AOS / Turnover"],
  glanceValues: ["+$X.XK", "XX.X%", "XXX.X", "+/- XX%", "+/- $X.XK", "XX.X / X.X%"],

  // Five lead questions — built from variance analysis
  leadQuestions: [
    { question: "Question 1 here", why: "Why it matters here" },
    { question: "Question 2 here", why: "Why it matters here" },
    { question: "Question 3 here", why: "Why it matters here" },
    { question: "Question 4 here", why: "Why it matters here" },
    { question: "What are the three things you're committing to in the next 30 days — owner, date, $ impact?",
      why: "Action exit. No call ends without this." }
  ],

  // Eight backup questions — pull from question bank as needed
  backupQuestions: [
    { category: "Score", question: "Backup question here" },
    { category: "Revenue", question: "Backup question here" },
    { category: "Index", question: "Backup question here" },
    { category: "Margin", question: "Backup question here" },
    { category: "Forecast", question: "Backup question here" },
    { category: "GSAT", question: "Backup question here" },
    { category: "Associate", question: "Backup question here" },
    { category: "Closing", question: "Backup question here" }
  ]
};
// ============================================================

// Brand colors
const NAVY = "0D2137";
const TEAL = "1A7E8F";
const GOLD = "C8963F";
const LIGHT_GRAY = "F2F2F2";
const MED_GRAY = "8C8C8C";
const DARK_TEXT = "1F1F1F";
const PRIORITY_FILL = "FFF4E0";

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

const cell = (text, opts = {}) => new TableCell({
  borders: cellBorders,
  width: { size: opts.width, type: WidthType.DXA },
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  children: [new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({
      text, bold: opts.bold || false, color: opts.color || DARK_TEXT,
      size: opts.size || 18, font: "Calibri"
    })]
  })]
});

const docHeader = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 4 } },
    tabStops: [{ type: TabStopType.RIGHT, position: 14400 }],
    children: [
      new TextRun({ text: "SUPERHOST HOSPITALITY", bold: true, color: NAVY, size: 18, font: "Calibri", characterSpacing: 30 }),
      new TextRun({ text: "\tMonthly PSC Review — Call Sheet", color: MED_GRAY, size: 16, font: "Calibri", italics: true })
    ]
  })]
});

const children = [];

// Title
children.push(new Paragraph({
  spacing: { before: 100, after: 40 },
  children: [new TextRun({
    text: CONFIG.property,
    bold: true, color: NAVY, size: 28, font: "Calibri", characterSpacing: 30
  })]
}));

children.push(new Paragraph({
  spacing: { before: 0, after: 80 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 14, color: GOLD, space: 4 } },
  children: [new TextRun({
    text: `${CONFIG.monthYear} PSC Review  |  Score: ${CONFIG.score} (${CONFIG.tier})  |  Trend: ${CONFIG.trendNote}`,
    color: TEAL, size: 20, font: "Calibri", italics: true
  })]
}));

// At-a-glance bar
const glanceTable = new Table({
  width: { size: 14400, type: WidthType.DXA },
  columnWidths: [2400, 2400, 2400, 2400, 2400, 2400],
  rows: [
    new TableRow({
      children: CONFIG.glanceLabels.map(text => cell(text, {
        width: 2400, fill: NAVY, color: "FFFFFF", bold: true, align: AlignmentType.CENTER, size: 16
      }))
    }),
    new TableRow({
      children: CONFIG.glanceValues.map(text => cell(text, {
        width: 2400, fill: LIGHT_GRAY, color: DARK_TEXT, bold: true, align: AlignmentType.CENTER, size: 22
      }))
    })
  ]
});

children.push(glanceTable);

// Lead with these five
children.push(new Paragraph({
  spacing: { before: 240, after: 80 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 4 } },
  children: [new TextRun({
    text: "LEAD WITH THESE FIVE", bold: true, color: NAVY,
    size: 22, font: "Calibri", characterSpacing: 30
  })]
}));

const priority5 = [["#", "Question", "Why It Matters"]].concat(
  CONFIG.leadQuestions.map((q, i) => [String(i + 1), q.question, q.why])
);

const priorityTable = new Table({
  width: { size: 14400, type: WidthType.DXA },
  columnWidths: [600, 8400, 5400],
  rows: priority5.map((row, i) => new TableRow({
    tableHeader: i === 0,
    children: row.map((text, j) => cell(text, {
      width: [600, 8400, 5400][j],
      fill: i === 0 ? NAVY : PRIORITY_FILL,
      color: i === 0 ? "FFFFFF" : DARK_TEXT,
      bold: i === 0 || j === 0,
      align: j === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
      size: i === 0 ? 16 : 18
    }))
  }))
});

children.push(priorityTable);

// Backup questions
children.push(new Paragraph({
  spacing: { before: 240, after: 80 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 4 } },
  children: [new TextRun({
    text: "BACKUP — IF TIME PERMITS", bold: true, color: NAVY,
    size: 22, font: "Calibri", characterSpacing: 30
  })]
}));

const backupRows = [["Category", "Question"]].concat(
  CONFIG.backupQuestions.map(q => [q.category, q.question])
);

const backupTable = new Table({
  width: { size: 14400, type: WidthType.DXA },
  columnWidths: [2400, 12000],
  rows: backupRows.map((row, i) => new TableRow({
    tableHeader: i === 0,
    children: row.map((text, j) => cell(text, {
      width: [2400, 12000][j],
      fill: i === 0 ? NAVY : (i % 2 === 0 ? LIGHT_GRAY : "FFFFFF"),
      color: i === 0 ? "FFFFFF" : DARK_TEXT,
      bold: i === 0 || j === 0,
      align: AlignmentType.LEFT,
      size: i === 0 ? 16 : 18
    }))
  }))
});

children.push(backupTable);

// Action capture box
children.push(new Paragraph({
  spacing: { before: 240, after: 80 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD, space: 4 } },
  children: [new TextRun({
    text: "ACTION CAPTURE — END OF CALL", bold: true, color: NAVY,
    size: 22, font: "Calibri", characterSpacing: 30
  })]
}));

const actionRows = [
  ["#", "Action Item", "Owner", "Due", "$ Impact"],
  ["1", "", "", "", ""],
  ["2", "", "", "", ""],
  ["3", "", "", "", ""]
];

const actionTable = new Table({
  width: { size: 14400, type: WidthType.DXA },
  columnWidths: [600, 8000, 1800, 1600, 2400],
  rows: actionRows.map((row, i) => new TableRow({
    tableHeader: i === 0,
    height: i === 0 ? undefined : { value: 600, rule: "atLeast" },
    children: row.map((text, j) => cell(text, {
      width: [600, 8000, 1800, 1600, 2400][j],
      fill: i === 0 ? NAVY : "FFFFFF",
      color: i === 0 ? "FFFFFF" : DARK_TEXT,
      bold: i === 0,
      align: j === 0 || j === 2 || j === 3 ? AlignmentType.CENTER : AlignmentType.LEFT,
      size: i === 0 ? 16 : 18
    }))
  }))
});

children.push(actionTable);

// Build doc
const doc = new Document({
  creator: "Superhost Hospitality",
  title: `${CONFIG.property} — ${CONFIG.monthYear} Call Sheet`,
  styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 270 } } }
      }]
    }]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840, orientation: PageOrientation.LANDSCAPE },
        margin: { top: 720, right: 720, bottom: 720, left: 720 }
      }
    },
    headers: { default: docHeader },
    children: children
  }]
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = `/home/claude/${CONFIG.outputFilename}`;
  fs.writeFileSync(outPath, buffer);
  console.log(`Call sheet created: ${outPath}`);
});
