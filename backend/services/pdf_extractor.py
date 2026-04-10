import fitz  # PyMuPDF
from typing import Optional

def extract_text_from_pdf(file_path: str) -> Optional[str]:
    """
    Extracts all text from a PDF file using PyMuPDF.
    """
    try:
        doc = fitz.open(file_path)
        full_text = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            full_text.append(text)
        return "\n".join(full_text)
    except Exception as e:
        print(f"Error extracting PDF {file_path}: {e}")
        return None
