from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import google.generativeai as genai
import os
from dotenv import load_dotenv

router = APIRouter()

class ChatRequest(BaseModel):
    query: str
    context_chunks: list[str] = []

def _get_api_key():
    """Load API key fresh each time so .env edits are picked up without restart."""
    load_dotenv(override=True)
    return os.getenv("GOOGLE_API_KEY")

PLACEHOLDER_KEYS = {"your_gemini_api_key_here", "your_actual_api_key", "your_api_key", ""}

@router.post("/chat")
def chat_with_documents(payload: ChatRequest):
    """
    Stateless chat: receives query + pre-retrieved context chunks from the frontend.
    Calls Gemini and returns the answer. No database access.
    """
    api_key = _get_api_key()
    if not api_key or api_key.strip('"').strip("'") in PLACEHOLDER_KEYS:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured. Please set GOOGLE_API_KEY in the .env file.")

    if not payload.context_chunks:
        context_string = "No relevant context found in the uploaded PDFs."
    else:
        context_string = "\n\n".join(payload.context_chunks)

    prompt = f"""
You are a highly intelligent PDF assistant.
Use ONLY the provided context from the user's documents to answer the question.
If the context does not contain the information needed to answer the query, state honestly that you do not know based on the provided documents.
Do not hallucinate external knowledge.

--- CONTEXT ---
{context_string}
--- END CONTEXT ---

USER QUERY: {payload.query}
"""

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return {"answer": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")
