"""Ranked-shortlist export to CSV and PDF -- the same data the dashboard
shows, just serialized for sharing with a hiring manager who isn't in
the tool.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.job_description import JobDescription
from app.schemas.candidates import CandidateListItem

CSV_HEADERS = [
    "rank",
    "name",
    "source",
    "resume_match_score",
    "code_verified_score",
    "quality_score",
    "offer_acceptance_probability",
    "overall_rank_score",
    "github_url",
    "languages",
    "data_limited",
]


def _row(rank: int, item: CandidateListItem) -> list[str]:
    match = item.match
    return [
        str(rank),
        item.name,
        match.source if match else "",
        f"{match.resume_match_score:.1f}" if match and match.resume_match_score is not None else "",
        f"{match.code_verified_score:.1f}" if match and match.code_verified_score is not None else "",
        f"{match.quality_score:.1f}" if match and match.quality_score is not None else "",
        f"{match.offer_acceptance_probability:.2f}"
        if match and match.offer_acceptance_probability is not None
        else "",
        f"{match.overall_rank_score:.1f}" if match else "",
        item.github.profile_url if item.github else "",
        ", ".join((item.github.languages or {}).keys()) if item.github else "",
        "yes" if (item.github and item.github.data_limited) else "no",
    ]


def generate_csv(job: JobDescription, items: list[CandidateListItem]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(CSV_HEADERS)
    for i, item in enumerate(items, start=1):
        writer.writerow(_row(i, item))
    return buffer.getvalue().encode("utf-8")


def generate_pdf(job: JobDescription, items: list[CandidateListItem]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph(f"SkillScout Shortlist — {job.title}", styles["Title"]))
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    story.append(Paragraph(f"Generated {generated_at} · {len(items)} candidates", styles["Normal"]))
    story.append(Spacer(1, 0.2 * inch))

    table_data = [["#", "Name", "Resume", "Code-Verified", "Quality", "Accept %", "Overall"]]
    for i, item in enumerate(items, start=1):
        m = item.match
        table_data.append(
            [
                str(i),
                item.name,
                f"{m.resume_match_score:.0f}" if m and m.resume_match_score is not None else "N/A",
                f"{m.code_verified_score:.0f}" if m and m.code_verified_score is not None else "N/A",
                f"{m.quality_score:.0f}" if m and m.quality_score is not None else "N/A",
                f"{m.offer_acceptance_probability * 100:.0f}%"
                if m and m.offer_acceptance_probability is not None
                else "N/A",
                f"{m.overall_rank_score:.0f}" if m else "N/A",
            ]
        )

    table = Table(table_data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0e131b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f6f8")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d8dee5")),
                ("ALIGN", (2, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 0.25 * inch))
    story.append(
        Paragraph(
            "Every score is computed live from real GitHub activity and/or uploaded resume text. "
            "N/A means that signal wasn't available for this candidate, not a zero.",
            styles["Italic"],
        )
    )

    doc.build(story)
    return buffer.getvalue()
