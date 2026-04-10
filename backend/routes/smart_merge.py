from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google import genai
import os, json
from dotenv import load_dotenv

router = APIRouter()

class DocumentMeta(BaseModel):
    id: int
    fileName: str
    summary: str | None = None
    tags: str | None = None

class SmartMergeRequest(BaseModel):
    documents: list[DocumentMeta]

PLACEHOLDER_KEYS = {"your_gemini_api_key_here", "your_actual_api_key", "your_api_key", ""}

def _get_api_key():
    load_dotenv(override=True)
    return os.getenv("GOOGLE_API_KEY")

@router.post("/suggest-smart-merge")
def suggest_smart_merge(payload: SmartMergeRequest):
    """
    Uses Gemini to analyze document titles and summaries then returns
    suggested merge groups with ordering and reasoning.
    """
    api_key = _get_api_key()
    if not api_key or api_key.strip('"').strip("'") in PLACEHOLDER_KEYS:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured.")

    if len(payload.documents) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 documents for suggestions.")

    # Build the document catalog for the prompt
    doc_catalog = "\n".join([
        f"ID: {d.id} | Title: {d.fileName} | Tag: {d.tags or 'N/A'} | Summary: {(d.summary or 'No summary')[:200]}"
        for d in payload.documents
    ])

    prompt = f"""You are a document organization expert. Analyze these PDF documents and suggest logical merge groups.

DOCUMENTS:
{doc_catalog}

INSTRUCTIONS:
1. Study the titles, tags, and summaries to find contextually related documents.
2. Group documents that belong together (e.g., same subject, same series, related topics).
3. Within each group, order the documents in the most logical sequence (by chapter number, date, logical progression, alphabetical when uncertain).
4. Provide a short reasoning explaining why each group belongs together.
5. Only suggest groups with 2 or more documents. A document can appear in at most ONE group.
6. Create up to 5 groups maximum. If no clear groups exist, suggest the best 1-2 groupings you can find.

RESPOND WITH ONLY valid JSON in this exact format (no markdown, no code fences):
{{
  "groups": [
    {{
      "label": "Short group name (e.g. 'Physics Chapters')",
      "reasoning": "One-sentence explanation of why these belong together",
      "doc_ids": [1, 5, 3]
    }}
  ]
}}

The doc_ids array MUST contain valid IDs from the document list above, ordered in the suggested merge sequence.
"""

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        raw = response.text.strip()

        # Strip markdown fences if Gemini wraps in ```json ... ```
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3].strip()

        result = json.loads(raw)

        # Validate: remove any IDs that don't exist
        valid_ids = {d.id for d in payload.documents}
        for group in result.get("groups", []):
            group["doc_ids"] = [did for did in group["doc_ids"] if did in valid_ids]

        result["groups"] = [g for g in result["groups"] if len(g["doc_ids"]) >= 2]

        return result

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Gemini returned invalid JSON. Try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")
