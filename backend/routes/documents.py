from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Optional

from db.database import get_db
from db.models import Document
from services.merge_service import get_merge_suggestions

router = APIRouter()

@router.get("/documents")
def get_documents(tag: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Document)
    if tag:
        query = query.filter(Document.tags == tag)
    docs = query.order_by(Document.upload_date.desc()).all()
    return {"documents": docs}

@router.get("/suggest-merges")
def suggest_merges(db: Session = Depends(get_db)):
    suggestions = get_merge_suggestions(db)
    return {"suggestions": suggestions}

@router.put("/rename-document/{doc_id}")
def rename_document(doc_id: int, new_name: str = Body(..., embed=True), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    old_path = doc.file_path
    
    # Ensure .pdf extension
    if not new_name.endswith(".pdf"):
        new_name += ".pdf"
        
    # Prevent directory traversal hacks
    new_name = new_name.replace("/", "").replace("\\", "")
    new_path = f"uploads/{new_name}"
    
    import os
    if os.path.exists(new_path) and old_path != new_path:
        raise HTTPException(status_code=400, detail="A file with this name already exists.")
        
    try:
        # Rename on disk
        if os.path.exists(old_path) and old_path != new_path:
            os.rename(old_path, new_path)
            
        doc.file_name = new_name
        doc.file_path = new_path
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to rename file: {str(e)}")
        
    return {"message": "Document renamed successfully", "new_name": new_name}
