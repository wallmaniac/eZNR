from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response
import tempfile, os
from pdf2docx import Converter

app = FastAPI(title="eZNR PDF Converter")

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/convert/pdf-to-word")
async def pdf_to_word(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files accepted")

    pdf_bytes = await file.read()
    tmp_pdf = tmp_docx = None

    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(pdf_bytes)
            tmp_pdf = f.name

        tmp_docx = tmp_pdf.replace(".pdf", ".docx")

        cv = Converter(tmp_pdf)
        cv.convert(tmp_docx, start=0, end=None)
        cv.close()

        with open(tmp_docx, "rb") as f:
            docx_bytes = f.read()

        docx_name = file.filename.replace(".pdf", ".docx")
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{docx_name}"'},
        )
    finally:
        if tmp_pdf and os.path.exists(tmp_pdf):
            os.unlink(tmp_pdf)
        if tmp_docx and os.path.exists(tmp_docx):
            os.unlink(tmp_docx)
