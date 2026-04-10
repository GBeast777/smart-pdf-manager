import numpy as np
import requests
import os

HF_API_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"
HF_API_KEY = os.getenv("HF_API_KEY")

headers = {
    "Authorization": f"Bearer {HF_API_KEY}"
}

def generate_embedding(text: str) -> np.ndarray:
    response = requests.post(HF_API_URL, headers=headers, json=text)
    embedding = np.array(response.json()[0])
    
    # Normalize
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    
    return embedding.astype(np.float32)

def generate_embeddings_batch(texts: list[str]) -> np.ndarray:
    response = requests.post(HF_API_URL, headers=headers, json=texts)
    embeddings = np.array(response.json())
    
    # Normalize batch
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1e-12
    embeddings = embeddings / norms
    
    return embeddings.astype(np.float32)
