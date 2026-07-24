"""
Generates the printable QR code PDF for a hunt (admin "Print QR Codes"
feature). Two sections in one document:

  - Guest Signs: a grid of QR codes with only a plain numeric index —
    no name/hint/area, since these pages get printed, cut apart, and
    physically posted where guests will see them before scanning.
  - Staff Reference Sheet: a table mapping each index back to the
    character's name/hint/area, clearly marked "STAFF USE ONLY" so
    whoever places the signs knows where each one goes.

Used by GET /api/admin/hunts/{hunt_id}/print-qr-codes (routers/hunts.py).
"""

import io
import re

import httpx
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfgen import canvas

GRID_COLS = 2
GRID_ROWS = 3
CELLS_PER_PAGE = GRID_COLS * GRID_ROWS
MARGIN = 0.5 * inch

PAGE_WIDTH, PAGE_HEIGHT = letter
GRID_WIDTH = PAGE_WIDTH - 2 * MARGIN
GRID_HEIGHT = PAGE_HEIGHT - 2 * MARGIN
CELL_WIDTH = GRID_WIDTH / GRID_COLS
CELL_HEIGHT = GRID_HEIGHT / GRID_ROWS

STAFF_TABLE_TOP_OFFSET = 0.9 * inch
STAFF_FONT_SIZE = 9
STAFF_LINE_HEIGHT = 0.16 * inch
STAFF_ROW_PADDING = 0.14 * inch
STAFF_HINT_COL_WIDTH = 2.8 * inch

STAFF_COL_X = {
    "index": MARGIN,
    "name": MARGIN + 0.5 * inch,
    "hint": MARGIN + 2.3 * inch,
    "area": MARGIN + 5.3 * inch,
}


def _fetch_qr_image(url: str) -> ImageReader:
    response = httpx.get(url, timeout=30.0)
    response.raise_for_status()
    return ImageReader(io.BytesIO(response.content))


def _draw_cut_lines(c: canvas.Canvas) -> None:
    c.saveState()
    c.setDash(3, 3)
    c.setStrokeColorRGB(0.6, 0.6, 0.6)

    for col in range(1, GRID_COLS):
        x = MARGIN + col * CELL_WIDTH
        c.line(x, MARGIN, x, PAGE_HEIGHT - MARGIN)

    for row in range(1, GRID_ROWS):
        y = PAGE_HEIGHT - MARGIN - row * CELL_HEIGHT
        c.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)

    c.restoreState()


def _draw_guest_sign_pages(c: canvas.Canvas, characters: list[dict]) -> None:
    for page_start in range(0, len(characters), CELLS_PER_PAGE):
        page_characters = characters[page_start:page_start + CELLS_PER_PAGE]

        c.setFont("Helvetica-Bold", 10)
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.drawString(MARGIN, PAGE_HEIGHT - MARGIN + 0.15 * inch, "Guest Signs")
        c.setFillColorRGB(0, 0, 0)

        for i, character in enumerate(page_characters):
            index = page_start + i + 1
            col = i % GRID_COLS
            row = i // GRID_COLS

            cell_x = MARGIN + col * CELL_WIDTH
            cell_y = PAGE_HEIGHT - MARGIN - (row + 1) * CELL_HEIGHT

            qr_size = min(CELL_WIDTH, CELL_HEIGHT) * 0.6
            qr_x = cell_x + (CELL_WIDTH - qr_size) / 2
            qr_y = cell_y + (CELL_HEIGHT - qr_size) / 2 + 0.2 * inch

            try:
                image = _fetch_qr_image(character["qr_code_image_url"])
                c.drawImage(
                    image, qr_x, qr_y, width=qr_size, height=qr_size,
                    preserveAspectRatio=True, mask="auto",
                )
            except (httpx.HTTPError, OSError):
                c.setFont("Helvetica", 8)
                c.drawCentredString(
                    cell_x + CELL_WIDTH / 2, cell_y + CELL_HEIGHT / 2,
                    "QR image unavailable",
                )

            c.setFont("Helvetica-Bold", 16)
            c.drawCentredString(cell_x + CELL_WIDTH / 2, cell_y + 0.25 * inch, str(index))

        _draw_cut_lines(c)
        c.showPage()


def _draw_staff_header(c: canvas.Canvas, hunt_name: str) -> float:
    """Draws the staff-page banner + column headers. Returns the y position for the first data row."""
    c.setFont("Helvetica-Bold", 16)
    c.setFillColorRGB(0.7, 0, 0)
    c.drawString(MARGIN, PAGE_HEIGHT - MARGIN, "STAFF USE ONLY — DO NOT POST")
    c.setFillColorRGB(0, 0, 0)

    c.setFont("Helvetica", 9)
    c.drawString(MARGIN, PAGE_HEIGHT - MARGIN - 0.25 * inch, f"Staff Reference Sheet — {hunt_name}")

    y = PAGE_HEIGHT - MARGIN - STAFF_TABLE_TOP_OFFSET

    c.setFont("Helvetica-Bold", STAFF_FONT_SIZE)
    c.drawString(STAFF_COL_X["index"], y, "#")
    c.drawString(STAFF_COL_X["name"], y, "Name")
    c.drawString(STAFF_COL_X["hint"], y, "Hint")
    c.drawString(STAFF_COL_X["area"], y, "Area")
    y -= 0.12 * inch
    c.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)

    return y - STAFF_LINE_HEIGHT


def _draw_staff_reference_pages(c: canvas.Canvas, hunt_name: str, characters: list[dict]) -> None:
    bottom_limit = MARGIN
    y = _draw_staff_header(c, hunt_name)
    c.setFont("Helvetica", STAFF_FONT_SIZE)

    for i, character in enumerate(characters):
        index = i + 1
        hint_lines = simpleSplit(
            character.get("hint") or "—", "Helvetica", STAFF_FONT_SIZE, STAFF_HINT_COL_WIDTH,
        )
        row_height = max(1, len(hint_lines)) * STAFF_LINE_HEIGHT + STAFF_ROW_PADDING

        if y - row_height < bottom_limit:
            c.showPage()
            y = _draw_staff_header(c, hunt_name)
            c.setFont("Helvetica", STAFF_FONT_SIZE)

        c.drawString(STAFF_COL_X["index"], y, str(index))
        c.drawString(STAFF_COL_X["name"], y, character["name"] or "")
        c.drawString(STAFF_COL_X["area"], y, character.get("area") or "—")
        for line_index, line in enumerate(hint_lines):
            c.drawString(STAFF_COL_X["hint"], y - line_index * STAFF_LINE_HEIGHT, line)

        y -= row_height

    c.showPage()


def build_qr_code_pdf(hunt_name: str, characters: list[dict]) -> bytes:
    """
    characters: list of dicts (already ordered by sort_order) with keys
    "name", "hint", "area", "qr_code_image_url". Index numbers (matching
    Guest Sign / Staff Reference rows) are 1-based position in this list.
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle(f"{hunt_name} — QR Code Signs")

    if not characters:
        c.setFont("Helvetica", 12)
        c.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT / 2, "No characters found for this hunt.")
        c.showPage()
    else:
        _draw_guest_sign_pages(c, characters)
        _draw_staff_reference_pages(c, hunt_name, characters)

    c.save()
    return buffer.getvalue()


def safe_filename_stem(name: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9_-]+", "_", name).strip("_")
    return stem or "hunt"
