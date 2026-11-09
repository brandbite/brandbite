"""Builds public/templates/brandbite-social-media-content-calendar.xlsx."""
import json
import sys
from datetime import date, timedelta

from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

OUT, SIZES = sys.argv[1], sys.argv[2]
ROWS = 120  # calendar rows ready to fill

INK, MUTED, ORANGE = "2B2D33", "6C6D75", "FF6426"
SOFT, LINE, INPUT = "F7F4F1", "E3E0DC", "FFF7E6"
FONT = "Arial"

thin = Side(style="thin", color=LINE)
box = Border(left=thin, right=thin, top=thin, bottom=thin)
head_font = Font(name=FONT, bold=True, color="FFFFFF", size=10)
head_fill = PatternFill("solid", fgColor=INK)
body = Font(name=FONT, size=10, color=INK)
muted = Font(name=FONT, size=10, color=MUTED, italic=True)
input_fill = PatternFill("solid", fgColor=INPUT)

sizes = json.load(open(SIZES, encoding="utf-8"))
STATUSES = ["Idea", "Brief ready", "In design", "In review", "Approved", "Scheduled", "Published"]
STATUS_COLORS = {
    "Idea": "EEEEEE", "Brief ready": "ECE4FF", "In design": "FFF1D6", "In review": "FFE3D6",
    "Approved": "DDF3E4", "Scheduled": "D9EBFF", "Published": "C8E6C9",
}

wb = Workbook()

# --- Sizes (lookup) ------------------------------------------------------------
sz = wb.active
sz.title = "Sizes"
sz.append(["Format", "Platform", "Name", "Width (px)", "Height (px)", "Ratio"])
for row in sizes:
    key = f"{row['platform']} · {row['format']}"
    sz.append([key, row["platform"], row["format"], row["width"], row["height"], row["ratio"]])
last_size = len(sizes) + 1
sz.append([])
sz.append([f"Source: brandbite.studio/sizes, checked against each platform's official specs in November 2026. Platforms change sizes; check before a big launch."])
for c in sz[1]:
    c.font, c.fill, c.border = head_font, head_fill, box
for r in sz.iter_rows(min_row=2, max_row=last_size):
    for c in r:
        c.font, c.border = body, box
sz.cell(row=last_size + 2, column=1).font = muted
for col, w in zip("ABCDEF", [44, 14, 30, 12, 12, 10]):
    sz.column_dimensions[col].width = w
sz.freeze_panes = "A2"

# --- Calendar ------------------------------------------------------------------
cal = wb.create_sheet("Calendar", 0)
headers = [
    ("Date", 12), ("Day", 7), ("Format", 38), ("Size (px)", 13), ("Campaign or topic", 24),
    ("Copy / caption", 40), ("Visual brief", 34), ("Owner", 14), ("Status", 13), ("Link", 26),
]
cal.append([h for h, _ in headers])
for i, (_, w) in enumerate(headers, start=1):
    cal.column_dimensions[get_column_letter(i)].width = w
for c in cal[1]:
    c.font, c.fill, c.border = head_font, head_fill, box
    c.alignment = Alignment(vertical="center", wrap_text=True)
cal.row_dimensions[1].height = 24

start = date.today().replace(day=1)
example = {
    "A": start + timedelta(days=2),
    "C": "Instagram · Portrait post (4:5)",
    "E": "Spring launch",
    "F": "Your whole team, one view of what's selling. Free for 14 days.",
    "G": "Product screenshot on brand blue, headline top left, logo bottom right.",
    "H": "Sam",
    "I": "In design",
}
for r in range(2, ROWS + 2):
    cal[f"B{r}"] = f'=IF(A{r}="","",TEXT(A{r},"ddd"))'
    cal[f"D{r}"] = (
        f'=IF(C{r}="","",IFERROR(INDEX(Sizes!$D$2:$D${last_size},MATCH(C{r},Sizes!$A$2:$A${last_size},0))'
        f'&" × "&INDEX(Sizes!$E$2:$E${last_size},MATCH(C{r},Sizes!$A$2:$A${last_size},0)),"Custom"))'
    )
    for col in "ABCDEFGHIJ":
        cell = cal[f"{col}{r}"]
        cell.font = body
        cell.border = box
        cell.alignment = Alignment(vertical="top", wrap_text=col in "FG")
        if col not in "BD":
            cell.fill = input_fill
    cal[f"A{r}"].number_format = "yyyy-mm-dd"
for col, value in example.items():
    cal[f"{col}2"] = value

format_list = DataValidation(type="list", formula1=f"=Sizes!$A$2:$A${last_size}", allow_blank=True)
format_list.error = "Pick a format from the list, or type it on the Sizes sheet first."
format_list.showErrorMessage = False  # allow custom formats
status_list = DataValidation(type="list", formula1='"' + ",".join(STATUSES) + '"', allow_blank=True)
date_rule = DataValidation(type="date", operator="greaterThan", formula1="DATE(2000,1,1)", allow_blank=True)
date_rule.error = "Enter a date, e.g. 2026-03-03."
for dv, col in ((format_list, "C"), (status_list, "I"), (date_rule, "A")):
    cal.add_data_validation(dv)
    dv.add(f"{col}2:{col}{ROWS + 1}")

for status, color in STATUS_COLORS.items():
    cal.conditional_formatting.add(
        f"I2:I{ROWS + 1}",
        FormulaRule(formula=[f'$I2="{status}"'], fill=PatternFill("solid", fgColor=color)),
    )
cal.freeze_panes = "C2"
cal.auto_filter.ref = f"A1:J{ROWS + 1}"

# --- Summary -------------------------------------------------------------------
summ = wb.create_sheet("Summary", 1)
summ["A1"] = "Posts by status"
summ["A1"].font = Font(name=FONT, bold=True, size=12, color=INK)
summ.append(["Status", "Posts"])
for status in STATUSES:
    summ.append([status, None])
for i, _ in enumerate(STATUSES, start=3):
    summ[f"B{i}"] = f"=COUNTIF(Calendar!$I$2:$I${ROWS + 1},A{i})"
total_row = 3 + len(STATUSES)
summ[f"A{total_row}"] = "Total planned"
summ[f"B{total_row}"] = f'=COUNTA(Calendar!$C$2:$C${ROWS + 1})'

plat_start = total_row + 3
summ[f"A{plat_start - 1}"] = "Posts by platform"
summ[f"A{plat_start - 1}"].font = Font(name=FONT, bold=True, size=12, color=INK)
summ[f"A{plat_start}"] = "Platform"
summ[f"B{plat_start}"] = "Posts"
platforms = list(dict.fromkeys(row["platform"] for row in sizes))
for j, name in enumerate(platforms, start=plat_start + 1):
    summ[f"A{j}"] = name
    summ[f"B{j}"] = f'=COUNTIF(Calendar!$C$2:$C${ROWS + 1},A{j}&" ·*")'
for r in (2, plat_start):
    for c in summ[r]:
        if c.value is not None:
            c.font, c.fill, c.border = head_font, head_fill, box
for row in summ.iter_rows(min_row=3, max_row=plat_start + len(platforms)):
    for c in row:
        if c.value is not None and c.font != head_font:
            c.font, c.border = body, box
summ[f"A{total_row}"].font = Font(name=FONT, bold=True, size=10, color=INK)
summ.column_dimensions["A"].width = 22
summ.column_dimensions["B"].width = 10

# --- How to use ----------------------------------------------------------------
how = wb.create_sheet("How to use", 0)
lines = [
    ("Social media content calendar", Font(name=FONT, bold=True, size=18, color=INK)),
    ("A free template by brandbite · brandbite.studio/templates", Font(name=FONT, size=10, color=ORANGE)),
    ("", body),
    ("How to use it", Font(name=FONT, bold=True, size=12, color=INK)),
    ("1. Go to the Calendar sheet. Cells with a light yellow fill are yours to edit.", body),
    ("2. Enter a date, then pick a Format from the list. The Size fills in by itself.", body),
    ("3. Add the topic, the copy, a short visual brief for your designer, an owner and a status.", body),
    ("4. Filter by Status or Owner with the arrows in the header row.", body),
    ("5. The Summary sheet counts posts by status and by platform.", body),
    ("6. Row 2 is an example. Overwrite it or delete it.", body),
    ("", body),
    ("Good to know", Font(name=FONT, bold=True, size=12, color=INK)),
    ("Gray cells (Day, Size) are formulas. Leave them alone; they update themselves.", body),
    ("Need a format that isn't listed? Add a row to the Sizes sheet with a unique name in column A.", body),
    ("Sizes come from brandbite.studio/sizes, checked against each platform's official specs (November 2026).", body),
    ("Writing a brief for a big post? Try brandbite.studio/brief-generator.", body),
]
for i, (text, font) in enumerate(lines, start=1):
    how[f"A{i}"] = text
    how[f"A{i}"].font = font
how.column_dimensions["A"].width = 100
how.sheet_view.showGridLines = False
how["A5"].fill = input_fill

for ws in (cal, summ, sz):
    ws.sheet_view.zoomScale = 100

wb.properties.creator = "brandbite"
wb.properties.title = "Social media content calendar"
wb.active = 1  # open on the Calendar
# No cached values from openpyxl: make Excel and Sheets compute everything on open.
from openpyxl.workbook.properties import CalcProperties
wb.calculation = CalcProperties(fullCalcOnLoad=True)
wb.save(OUT)
print("saved", OUT)
