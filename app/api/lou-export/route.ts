import { NextRequest } from "next/server";
import ExcelJS from "exceljs";

// The styled .xlsx is built server-side with ExcelJS (Node), which gives us fills,
// borders, merges, and dropdowns that the plain client-side writer cannot. It
// mirrors the Hawk Ridge Letter of Understanding template: navy header band, a
// title, an intro box, and a bordered issues table with yellow Priority and
// Timeframe dropdown columns the customer fills in.
export const runtime = "nodejs";

interface IssueIn {
  businessIssue?: string;
  recommendedResponse?: string;
  category?: string;
  priority?: string;
  timeframe?: string;
  notes?: string;
}

interface Body {
  account?: string;
  coverLine?: string;
  categories?: string[];
  issues?: IssueIn[];
}

const NAVY = "FF15486A";
const NAVY_DK = "FF0E3A56";
const YELLOW = "FFFFFF00";
const WHITE = "FFFFFFFF";
const BORDER = "FFCBD5E1";

const PRIORITY_LIST = ["High", "Medium", "Low"];
const TIMEFRAME_LIST = ["Q1", "Q2", "Q3", "Q4", "Immediate", "TBD"];

const slug = (s: string) =>
  (s || "letter-of-understanding").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

function thinBorder() {
  const side = { style: "thin" as const, color: { argb: BORDER } };
  return { top: side, left: side, bottom: side, right: side };
}

function estimateHeight(a: string, b: string): number {
  const lines = (t: string, perLine: number) => Math.max(1, Math.ceil((t?.length || 0) / perLine));
  const need = Math.max(lines(a, 40), lines(b, 44));
  return Math.min(170, Math.max(36, need * 15));
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const account = (body.account || "the account").trim();
  const coverLine =
    (body.coverLine || "").trim() ||
    `This Letter of Understanding captures what Hawk Ridge Systems understood from our discovery conversation with ${account}.`;
  const issues = Array.isArray(body.issues) ? body.issues : [];
  const categoryList =
    Array.isArray(body.categories) && body.categories.length ? body.categories : ["Design", "Manufacturing"];

  const wb = new ExcelJS.Workbook();
  wb.creator = "Hawk Ridge Systems";
  const ws = wb.addWorksheet("Letter of Understanding", {
    views: [{ state: "frozen", ySplit: 6, showGridLines: false }],
  });

  ws.columns = [
    { width: 42 }, // A Critical Business Issue
    { width: 46 }, // B Can we help?
    { width: 18 }, // C Category
    { width: 13 }, // D Priority
    { width: 13 }, // E Timeframe
    { width: 32 }, // F Notes
  ];

  const navyFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: NAVY } };
  const whiteFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: WHITE } };
  const yellowFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: YELLOW } };

  // Paint the header band navy (rows 1-3, 5) and the data-area background.
  for (const r of [1, 2, 3, 5]) {
    for (let c = 1; c <= 6; c++) ws.getCell(r, c).fill = navyFill;
  }

  // Row 1: Last Updated.
  const updated = new Date().toLocaleDateString("en-US");
  const lu = ws.getCell("A1");
  lu.value = `Last Updated: ${updated}`;
  lu.font = { name: "Calibri", size: 9, color: { argb: "FFBFD3E2" } };
  lu.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 18;

  // Row 2: Title.
  ws.mergeCells("A2:F2");
  const title = ws.getCell("A2");
  title.value = `Letter of Understanding:  ${account}`;
  title.font = { name: "Calibri", size: 22, bold: true, color: { argb: WHITE } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 40;
  ws.getRow(3).height = 8;

  // Row 4: Intro box (white, rich text with a bold call to action).
  ws.mergeCells("A4:F4");
  const intro = ws.getCell("A4");
  intro.value = {
    richText: [
      { text: coverLine + "  ", font: { name: "Calibri", size: 11, color: { argb: "FF1F2937" } } },
      {
        text: "Please confirm or correct each item, set the Priority and Timeframe that fit your plans, add anything we missed, and share your feedback.",
        font: { name: "Calibri", size: 11, bold: true, color: { argb: "FF1F2937" } },
      },
    ],
  };
  intro.fill = whiteFill;
  intro.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  intro.border = thinBorder();
  ws.getRow(4).height = 54;
  ws.getRow(5).height = 10;

  // Row 6: Table header.
  const headers = [
    "Critical Business Issues",
    "Can we help?  If so, how?",
    "Category",
    "Priority",
    "Timeframe",
    `${account} Notes`,
  ];
  const headerRow = ws.getRow(6);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_DK } };
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
    cell.alignment = { vertical: "middle", horizontal: i < 2 ? "left" : "center", wrapText: true };
    cell.border = thinBorder();
  });
  headerRow.height = 30;

  // Data rows.
  const firstDataRow = 7;
  issues.forEach((it, idx) => {
    const r = firstDataRow + idx;
    const row = ws.getRow(r);
    const values = [
      it.businessIssue || "",
      it.recommendedResponse || "",
      it.category || "",
      it.priority || "",
      it.timeframe || "",
      it.notes || "",
    ];
    values.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      const isFill = ci === 3 || ci === 4; // Priority, Timeframe -> yellow
      cell.fill = isFill ? yellowFill : whiteFill;
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF1F2937" } };
      cell.alignment = {
        vertical: "top",
        horizontal: ci >= 2 && ci <= 4 ? "center" : "left",
        wrapText: true,
      };
      cell.border = thinBorder();
    });
    row.height = estimateHeight(values[0], values[1]);

    // Dropdowns on Category / Priority / Timeframe.
    row.getCell(3).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${categoryList.join(",").slice(0, 250)}"`],
    };
    row.getCell(4).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${PRIORITY_LIST.join(",")}"`],
    };
    row.getCell(5).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${TIMEFRAME_LIST.join(",")}"`],
    };
  });

  // A couple of blank navy rows below the table to frame it like the template.
  for (let r = firstDataRow + issues.length; r < firstDataRow + issues.length + 2; r++) {
    for (let c = 1; c <= 6; c++) ws.getCell(r, c).fill = navyFill;
    ws.getRow(r).height = 10;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug(account)}-letter-of-understanding.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
