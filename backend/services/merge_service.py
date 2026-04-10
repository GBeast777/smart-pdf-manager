import numpy as np
from sqlalchemy.orm import Session
from db.models import Document, DocumentChunk
from services.embedding_service import generate_embedding

# Threshold for Smart Merge similarity
SIMILARITY_THRESHOLD = 0.55

def get_merge_suggestions(db: Session):
    """
    Compare document embeddings to find pairs with high similarity.
    Instead of using the summary embedding, let's use the first chunk's embedding which has more flesh.
    """
    documents = db.query(Document).all()
    if len(documents) < 2:
        return []
        
    embeddings = []
    valid_docs = []
    
    for doc in documents:
        # Get the first chunk of the document
        first_chunk = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).order_by(DocumentChunk.chunk_index).first()
        if first_chunk:
            emb = generate_embedding(first_chunk.chunk_text)
            embeddings.append(emb)
            valid_docs.append(doc)
            
    if len(valid_docs) < 2:
        return []
        
    # Normalize
    embeddings = np.array(embeddings, dtype='float32')
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1 # avoid division by zero
    embeddings = embeddings / norms
    
    # Compute similarity matrix (Cosine similarity)
    similarity_matrix = np.dot(embeddings, embeddings.T)
    
    suggestions = []
    num_docs = len(valid_docs)
    
    for i in range(num_docs):
        for j in range(i + 1, num_docs):
            sim = similarity_matrix[i, j]
            if sim > SIMILARITY_THRESHOLD:
                suggestions.append({
                    "doc1": {
                        "id": valid_docs[i].id,
                        "file_name": valid_docs[i].file_name
                    },
                    "doc2": {
                        "id": valid_docs[j].id,
                        "file_name": valid_docs[j].file_name
                    },
                    "similarity": float(sim)
                })
                
    # Sort by descending similarity
    suggestions.sort(key=lambda x: x["similarity"], reverse=True)
    return suggestions
