from fastapi import APIRouter, UploadFile, File, HTTPException
from services.pdf_extractor import extract_text_from_pdf
from services.categorization import assign_category
from services.embedding_service import generate_embeddings_batch
from utils.chunking import chunk_text
import tempfile, os

router = APIRouter()

@router.post("/process")
async def process_pdf(file: UploadFile = File(...)):
    """
    Stateless PDF processing: extract text, chunk, embed, categorize.
    Returns all data — stores nothing on the server.
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Write to a temp file for PyMuPDF
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    try:
        content = await file.read()
        tmp.write(content)
        tmp.close()

        text = extract_text_from_pdf(tmp.name)
        if not text:
            raise HTTPException(status_code=422, detail="Could not extract text from this PDF.")

        category = assign_category(text)
        summary = text[:500] + "..." if len(text) > 500 else text
        chunks = chunk_text(text)

        if chunks:
            embeddings = generate_embeddings_batch(chunks)
            chunk_data = [
                {
                    "chunkText": chunks[i],
                    "chunkIndex": i,
                    "embedding": embeddings[i].tolist(),
                }
                for i in range(len(chunks))
            ]
        else:
            chunk_data = []

        return {
            "fileName": file.filename,
            "summary": summary,
            "category": category,
            "chunks": chunk_data,
        }
    finally:
        os.unlink(tmp.name)
