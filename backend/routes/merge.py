from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import fitz  # PyMuPDF
import tempfile, os, base64

router = APIRouter()

@router.post("/merge")
async def merge_pdfs(
    file1: UploadFile = File(...),
    file2: UploadFile = File(...),
):
    """
    Stateless merge: receives two PDF blobs, merges them with PyMuPDF,
    returns JSON with base64-encoded PDF, page count, and file size.
    """
    tmp1 = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp2 = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")

    try:
        content1 = await file1.read()
        content2 = await file2.read()
        tmp1.write(content1)
        tmp2.write(content2)
        tmp1.close()
        tmp2.close()

        # Merge using PyMuPDF
        merged = fitz.open()
        merged.insert_pdf(fitz.open(tmp1.name))
        merged.insert_pdf(fitz.open(tmp2.name))

        page_count = len(merged)
        merged_bytes = merged.tobytes()
        merged.close()

        return JSONResponse(content={
            "pdf_base64": base64.b64encode(merged_bytes).decode("utf-8"),
            "page_count": page_count,
            "file_size": len(merged_bytes),
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to merge PDFs: {str(e)}")
    finally:
        os.unlink(tmp1.name)
        os.unlink(tmp2.name)
