/**
 * GM Response Standards Generator
 *
 * Generates a Word doc grading framework: for each lead question,
 * shows what a strong vs. weak GM answer looks like.
 *
 * USAGE:
 *   1. Fill in the CONFIG block with the 5 lead questions and tailored
 *      strong/weak answers based on the property's specific data
 *   2. Run: node build_response_standards.js
 *   3. Output: /home/claude/<property>_<month>_Response_Standards.docx
 */

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, LevelFormat, BorderStyle, WidthType,
        ShadingType, PageOrientation, Header, TabStopType } = require('docx');
const fs = require('fs');

// ============================================================
// CONFIG — FILL IN FOR EACH PROPERTY/MONTH
// ============================================================
const CONFIG = {
  property: "PROPERTY NAME",
  monthYear: "MONTH YYYY",
  outputFilename: "Property_Month_Response_Standards.docx",

  // Five questions with strong/weak answer standards.
  // Strong answers should:
  //   - Quantify in dollars
  //   - Segment timing vs. structural
  //   - Show ownership of the variance
  //   - Bring a forward plan
  // Weak answers are generic, deferred, no numbers, no plan.
  questions: [
    {
      question: "Q1 question text here",
      strongAnswer: {
        opener: "Quote of strong opening line here.",
        bullets: [
          "Specific quantified data point 1",
          "Specific quantified data point 2",
          "Specific quantified data point 3"
        ],
        closer: "Strong forward-looking close that shows ownership."
      },
      weakAnswer: {
        examples: [
          "Generic weak answer 1",
          "Generic weak answer 2"
        ],
        whyWeak: [
          "Why this is weak — reason 1",
          "Why this is weak — reason 2",
          "Why this is weak — reason 3",
          "Why this is weak — reason 4"
        ]
      },
      grading: "What you're grading: the underlying competency this question tests."
    }
    // Repeat for Q2-Q5
  ]
};
// ============================================================

const NAVY = "0D2137";
const TEAL = "1A7E8F";
const GOLD = "C8963F";
const LIGHT_GRAY = "F2F2F2";
const MED_GRAY = "8C8C8C";
const DARK_TEXT = "1F1F1F";
const GOOD_FILL = "E8F5E9";
const BAD_FILL = "FFEBEE";

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

const cell = (text, opts = {}) => new TableCell({
  borders: cellBorders,
  width: { size: opts.width, type: WidthType.DXA },
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
  margins: { top: 100, bottom: 100, left: 140, right: 140 },
  children: [new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({
      text, bold: opts.bold || false, color: opts.color || DARK_TEXT,
      size: opts.size || 18, font: "Calibri"
    })]
  })]
});

const cellMulti = (paragraphs, opts = {}) => new TableCell({
  borders: cellBorders,
  width: { size: opts.width, type: WidthType.DXA },
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
  margins: { top: 100, bottom: 100, left: 140, right: 140 },
  children: paragraphs
});

const para = (text, opts = {}) => new Paragraph({
  spacing: { before: opts.before || 0, after: opts.after || 60 },
  alignment: opts.align || AlignmentType.LEFT,
  children: [new TextRun({
    text, bold: opts.bold || false, italics: opts.italics || false,
    color: opts.color || DARK_TEXT, size: opts.size || 18, font: "Calibri"
  })]
});

const bulletPara = (text, opts = {}) => new Paragraph({
  spacing: { before: 30, after: 30 },
  indent: { left: 180, hanging: 140 },
  children: [
    new TextRun({ text: "• ", color: opts.color || DARK_TEXT, size: 18, font: "Calibri" }),
    new TextRun({ text, color: opts.color || DARK_TEXT, size: 18, font: "Calibri" })
  ]
});

const docHeader = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 4 } },
    tabStops: [{ type: TabStopType.RIGHT, position: 14400 }],
    children: [
      new TextRun({ text: "SUPERHOST HOSPITALITY", bold: true, color: NAVY, size: 18, font: "Calibri", characterSpacing: 30 }),
      new TextRun({ text: "\tGM Response Standards", color: MED_GRAY, size: 16, font: "Calibri", italics: true })
    ]
  })]
});

const children = [];

// Title
children.push(new Paragraph({
  spacing: { before: 100, after: 40 },
  children: [new TextRun({
    text: "WHAT A GOOD GM ANSWER LOOKS LIKE",
    bold: true, color: NAVY, size: 26, font: "Calibri", characterSpacing: 30
  })]
}));

children.push(new Paragraph({
  spacing: { before: 0, after: 120 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 14, color: GOLD, space: 4 } },
  children: [new TextRun({
    text: `${CONFIG.property}  |  ${CONFIG.monthYear}  |  Grading the Five Lead Questions`,
    color: TEAL, size: 18, font: "Calibri", italics: true
  })]
}));

children.push(new Paragraph({
  spacing: { before: 0, after: 120 },
  children: [new TextRun({
    text: "If the GM can deliver these answers — they're managing the property. If they can't, the gap itself is the conversation.",
    italics: true, color: MED_GRAY, size: 18, font: "Calibri"
  })]
}));

// Build each question block
CONFIG.questions.forEach((q, i) => {
  // Question header
  children.push(new Paragraph({
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: NAVY, space: 3 } },
    children: [
      new TextRun({ text: `Q${i + 1}.  `, bold: true, color: GOLD, size: 22, font: "Calibri" }),
      new TextRun({ text: q.question, bold: true, color: NAVY, size: 22, font: "Calibri" })
    ]
  }));

  // Strong / Weak side-by-side
  const strongParagraphs = [
    para(`"${q.strongAnswer.opener}"`, { italics: true, after: 80 })
  ];
  q.strongAnswer.bullets.forEach(b => strongParagraphs.push(bulletPara(b)));
  if (q.strongAnswer.closer) {
    strongParagraphs.push(para(`"${q.strongAnswer.closer}"`, { before: 80, italics: true }));
  }

  const weakParagraphs = [];
  q.weakAnswer.examples.forEach((ex, idx) => {
    weakParagraphs.push(para(`"${ex}"`, { italics: true, after: 80 }));
    if (idx < q.weakAnswer.examples.length - 1) {
      weakParagraphs.push(para("Or:", { color: MED_GRAY, size: 16, after: 60 }));
    }
  });
  weakParagraphs.push(para("WHY IT'S WEAK:", { bold: true, color: "C62828", size: 16, before: 60, after: 40 }));
  q.weakAnswer.whyWeak.forEach(w => weakParagraphs.push(bulletPara(w)));

  const qTable = new Table({
    width: { size: 14400, type: WidthType.DXA },
    columnWidths: [7200, 7200],
    rows: [
      new TableRow({
        children: [
          cell("✓  STRONG ANSWER", { width: 7200, fill: "2E7D32", color: "FFFFFF", bold: true, align: AlignmentType.CENTER, size: 18 }),
          cell("✗  WEAK ANSWER", { width: 7200, fill: "C62828", color: "FFFFFF", bold: true, align: AlignmentType.CENTER, size: 18 })
        ]
      }),
      new TableRow({
        children: [
          cellMulti(strongParagraphs, { width: 7200, fill: GOOD_FILL }),
          cellMulti(weakParagraphs, { width: 7200, fill: BAD_FILL })
        ]
      })
    ]
  });
  children.push(qTable);

  children.push(new Paragraph({
    spacing: { before: 80, after: 0 },
    children: [
      new TextRun({ text: "WHAT YOU'RE GRADING:  ", bold: true, color: GOLD, size: 16, font: "Calibri", characterSpacing: 20 }),
      new TextRun({ text: q.grading, color: DARK_TEXT, size: 16, font: "Calibri", italics: true })
    ]
  }));
});

// Grading rubric
children.push(new Paragraph({
  spacing: { before: 320, after: 100 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 14, color: GOLD, space: 4 } },
  children: [new TextRun({
    text: "GRADING THE GM ACROSS THE FIVE", bold: true, color: NAVY,
    size: 22, font: "Calibri", characterSpacing: 30
  })]
}));

const gradeRows = [
  ["GM Score", "What It Means", "Next Step"],
  ["5 of 5 strong",
   "GM is managing the property, not running it. Trust extended.",
   "Capture playbook. Use as portfolio benchmark."],
  ["3-4 strong",
   "Solid operator. Has the data, builds the plans, owns the variance.",
   "Reinforce. Coach the gaps. Standard cadence."],
  ["1-2 strong",
   "Reactive. Knows the numbers but not the why or the what's next.",
   "Move to bi-weekly. RDO joins. Coach the framework."],
  ["0 strong",
   "Property is running them. Action exit not happening.",
   "Formal coaching plan. Weekly check-ins. Escalation path."]
];

const gradeTable = new Table({
  width: { size: 14400, type: WidthType.DXA },
  columnWidths: [2400, 6800, 5200],
  rows: gradeRows.map((row, i) => new TableRow({
    tableHeader: i === 0,
    children: row.map((text, j) => cell(text, {
      width: [2400, 6800, 5200][j],
      fill: i === 0 ? NAVY : (i % 2 === 0 ? LIGHT_GRAY : "FFFFFF"),
      color: i === 0 ? "FFFFFF" : DARK_TEXT,
      bold: i === 0 || j === 0,
      align: j === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
      size: 18
    }))
  }))
});

children.push(gradeTable);

children.push(new Paragraph({
  spacing: { before: 200, after: 0 },
  children: [
    new TextRun({ text: "BOTTOM LINE:  ", bold: true, color: GOLD, size: 18, font: "Calibri", characterSpacing: 30 }),
    new TextRun({ text: "You're not just grading the property's performance — you're grading the GM's command of it. The scorecard tells you the result. The answers tell you whether the GM owns the result.", color: DARK_TEXT, size: 18, font: "Calibri", italics: true })
  ]
}));

// Build
const doc = new Document({
  creator: "Superhost Hospitality",
  title: `${CONFIG.property} — ${CONFIG.monthYear} Response Standards`,
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
  console.log(`Response standards created: ${outPath}`);
});
