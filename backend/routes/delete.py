from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
import os

from db.database import get_db
from db.models import Document

router = APIRouter()

@router.delete("/delete/{doc_id}")
def delete_single_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            print(f"File delete err: {e}")
            
    db.delete(doc)
    db.commit()
    
    return {"message": "Document deleted successfully"}

@router.delete("/delete-by-date")
def delete_by_date(
    start_date: str = Query(..., description="Start Date (YYYY-MM-DD)"), 
    end_date: str = Query(..., description="End Date (YYYY-MM-DD)"), 
    db: Session = Depends(get_db)
):
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        end_dt = end_dt.replace(hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
    docs = db.query(Document).filter(Document.upload_date >= start_dt, Document.upload_date <= end_dt).all()
    deleted_count = 0
    
    for doc in docs:
        if doc.file_path and os.path.exists(doc.file_path):
            try:
                os.remove(doc.file_path)
            except Exception as e:
                print(f"File delete err: {e}")
        db.delete(doc)
        deleted_count += 1
        
    db.commit()
    
    return {"message": f"Successfully deleted {deleted_count} documents"}
