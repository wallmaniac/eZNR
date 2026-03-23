#!/usr/bin/env python3
"""
pdf2word.py — Convert PDF to DOCX using pdf2docx.

Install dependency: pip install pdf2docx

Usage: python pdf2word.py input.pdf output.docx
"""
import sys
import os

def main():
    if len(sys.argv) < 3:
        print("Usage: python pdf2word.py <input.pdf> <output.docx>", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    docx_path = sys.argv[2]

    if not os.path.exists(pdf_path):
        print(f"Input file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    try:
        from pdf2docx import Converter
    except ImportError:
        print(
            "pdf2docx module not found. Install it with:\n  pip install pdf2docx",
            file=sys.stderr
        )
        sys.exit(2)

    try:
        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, end=None)
        cv.close()
        print("OK")
    except Exception as e:
        print(f"Conversion error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
