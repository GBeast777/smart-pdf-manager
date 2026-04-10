from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Document

router = APIRouter()

class RenameCategoryRequest(BaseModel):
    old_name: str
    new_name: str

@router.put("/rename-category")
def rename_category(payload: RenameCategoryRequest, db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.tags == payload.old_name).all()
    count = 0
    for doc in docs:
        doc.tags = payload.new_name
        count += 1
    
    db.commit()
    return {"message": f"Successfully renamed category '{payload.old_name}' to '{payload.new_name}' across {count} document(s)."}
