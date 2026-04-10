from fastapi import APIRouter
from pydantic import BaseModel
from services.embedding_service import generate_embedding

router = APIRouter()

class EmbedRequest(BaseModel):
    text: str

@router.post("/embed-query")
def embed_query(payload: EmbedRequest):
    """
    Generate an embedding vector for a query string.
    Used by the frontend before local cosine similarity search.
    """
    embedding = generate_embedding(payload.text)
    return {"embedding": embedding.tolist()}
