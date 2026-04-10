import faiss
import numpy as np
import json
import os
from sqlalchemy.orm import Session

from db.models import DocumentChunk
from services.embedding_service import generate_embedding

# Store the vector index and mapping locally
FAISS_INDEX_FILE = "faiss_index.bin"
CHUNK_MAPPING_FILE = "chunk_mapping.json"
DIMENSION = 384  # Size for all-MiniLM-L6-v2

def get_faiss_index():
    if os.path.exists(FAISS_INDEX_FILE):
        return faiss.read_index(FAISS_INDEX_FILE)
    # Using Inner Product for cosine similarity (vectors must be normalized)
    return faiss.IndexFlatIP(DIMENSION)

def save_faiss_index(index):
    faiss.write_index(index, FAISS_INDEX_FILE)

def load_mapping():
    if os.path.exists(CHUNK_MAPPING_FILE):
        with open(CHUNK_MAPPING_FILE, "r") as f:
            return json.load(f)
    return {}

def save_mapping(mapping):
    with open(CHUNK_MAPPING_FILE, "w") as f:
        json.dump(mapping, f)

def add_chunks_to_index(chunks: list[DocumentChunk], embeddings: np.ndarray):
    """
    Adds chunks to the FAISS index with normalized embeddings.
    """
    if len(chunks) == 0:
        return
        
    embeddings = np.ascontiguousarray(embeddings, dtype=np.float32)
    faiss.normalize_L2(embeddings)  # Double-check normalization
    index = get_faiss_index()
    mapping = load_mapping()
    
    start_id = index.ntotal
    index.add(embeddings)
    
    for i, chunk in enumerate(chunks):
        mapping[str(start_id + i)] = chunk.id
        
    save_faiss_index(index)
    save_mapping(mapping)

def search(query: str, db: Session, top_k: int = 5):
    """
    Semantic search for the most relevant chunks.
    """
    index = get_faiss_index()
    if index.ntotal == 0:
        return []
        
    q_emb = generate_embedding(query)
    q_emb = np.ascontiguousarray(q_emb.reshape(1, -1), dtype=np.float32)
    faiss.normalize_L2(q_emb)
    
    distances, indices = index.search(q_emb, top_k)
    mapping = load_mapping()
    results = []
    
    for i in range(len(indices[0])):
        idx = indices[0][i]
        if idx == -1:
            continue
            
        score = distances[0][i]
        chunk_id = mapping.get(str(idx))
        
        if chunk_id:
            chunk = db.query(DocumentChunk).filter(DocumentChunk.id == chunk_id).first()
            if chunk and chunk.document: # filter out deleted docs
                # Threshold filtering: Only return matches with a similarity >= 0.20
                if score >= 0.20:
                    results.append({
                        "score": float(score),
                        "chunk_text": chunk.chunk_text,
                        "document_id": chunk.document_id,
                        "document_name": chunk.document.file_name,
                        "tags": chunk.document.tags
                    })
                
    return results
