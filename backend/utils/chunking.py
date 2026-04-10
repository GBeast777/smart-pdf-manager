import re

def clean_text(text: str) -> str:
    # Remove extra spaces and newlines
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def chunk_text(text: str, chunk_size: int = 150, overlap: int = 30) -> list[str]:
    """
    Split text into chunks of roughly `chunk_size` words with `overlap` words.
    Reduced chunk length to ensure it strictly fits within the 256 token limit of MiniLM.
    """
    words = clean_text(text).split(' ')
    chunks = []
    
    # Avoid infinite loops or issues with small text
    if not words:
        return chunks
        
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        if i + chunk_size >= len(words):
            break
            
    return chunks
