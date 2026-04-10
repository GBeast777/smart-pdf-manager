from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path
import os
import shutil

from db.database import get_db, SessionLocal
from db.models import Document, DocumentChunk
from services.pdf_extractor import extract_text_from_pdf
from services.categorization import assign_category
from services.embedding_service import generate_embeddings_batch
from services.semantic_search import add_chunks_to_index
from utils.chunking import chunk_text

router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

def process_pdf(doc_id: int, file_path: str):
    db = SessionLocal()
    try:
        text = extract_text_from_pdf(file_path)
        if not text:
            return
        
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return
            
        doc.tags = assign_category(text)
        # Simple summary for the document
        doc.summary = text[:500] + "..." if len(text) > 500 else text
        db.commit()
        
        chunks = chunk_text(text)
        if not chunks:
            return
            
        embeddings = generate_embeddings_batch(chunks)
        
        db_chunks = []
        for i, chunk_txt in enumerate(chunks):
            db_chunk = DocumentChunk(document_id=doc_id, chunk_text=chunk_txt, chunk_index=i)
            db.add(db_chunk)
            db_chunks.append(db_chunk)
            
        db.commit()
        for chunk in db_chunks:
            db.refresh(chunk)
            
        # Add to FAISS index
        add_chunks_to_index(db_chunks, embeddings)
    except Exception as e:
        print(f"Error processing PDF: {e}")
    finally:
        db.close()


@router.post("/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    file_path = UPLOAD_DIR / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_size_bytes = file_path.stat().st_size
        
    new_doc = Document(file_name=file.filename, file_path=str(file_path), file_size=file_size_bytes)
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    
    background_tasks.add_task(process_pdf, new_doc.id, str(file_path))
    
    return {"message": "PDF uploaded and processing started", "document": new_doc}
