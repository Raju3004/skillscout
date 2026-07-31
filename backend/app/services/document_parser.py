"""Extracts plain text from uploaded PDF/DOCX files.

Shared by job-description upload (step 2) and resume upload (step 7) so
both feed the same downstream text-matching pipeline.
"""

from __future__ import annotations

import io


class DocumentParseError(Exception):
    pass


def extract_text(filename: str, content: bytes) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return _extract_pdf(content)
    if lower.endswith(".docx"):
        return _extract_docx(content)
    if lower.endswith(".txt"):
        try:
            return content.decode("utf-8", errors="ignore")
        except Exception as exc:  # pragma: no cover - defensive
            raise DocumentParseError(f"Could not read text file: {exc}") from exc
    raise DocumentParseError(f"Unsupported file type: {filename}")


def _extract_pdf(content: bytes) -> str:
    try:
        import pdfplumber
    except ImportError as exc:  # pragma: no cover
        raise DocumentParseError("PDF parsing is not available on the server") from exc

    try:
        text_parts: list[str] = []
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                text_parts.append(page_text)
        text = "\n".join(text_parts).strip()
        if not text:
            raise DocumentParseError(
                "No extractable text found in this PDF (it may be a scanned image)."
            )
        return text
    except DocumentParseError:
        raise
    except Exception as exc:
        raise DocumentParseError(f"Could not parse PDF: {exc}") from exc


def _extract_docx(content: bytes) -> str:
    try:
        import docx
    except ImportError as exc:  # pragma: no cover
        raise DocumentParseError("DOCX parsing is not available on the server") from exc

    try:
        document = docx.Document(io.BytesIO(content))
        text = "\n".join(p.text for p in document.paragraphs if p.text.strip())
        if not text.strip():
            raise DocumentParseError("No extractable text found in this document.")
        return text
    except DocumentParseError:
        raise
    except Exception as exc:
        raise DocumentParseError(f"Could not parse DOCX: {exc}") from exc
