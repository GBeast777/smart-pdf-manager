from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from services.semantic_search import search

router = APIRouter()

class SearchRequest(BaseModel):
    query: str

@router.post("/search")
def search_documents(payload: SearchRequest, db: Session = Depends(get_db)):
    results = search(payload.query, db, top_k=5)
    return {"results": results}
