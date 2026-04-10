import numpy as np
import torch
from transformers import AutoTokenizer, AutoModel
import logging

# We use transformers directly to avoid sentence-transformers' dependency on scipy/scikit-learn 
# which crashes on Python 3.14 alpha builds.

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_tokenizer = None
_model = None

def get_model():
    global _tokenizer, _model
    if _model is None:
        logging.info(f"Loading base Transformers model '{MODEL_NAME}'...")
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        _model = AutoModel.from_pretrained(MODEL_NAME)
        _model.eval()
    return _tokenizer, _model

def generate_embedding(text: str) -> np.ndarray:
    """
    Generates a dense vector embedding for the given text using mean pooling.
    """
    tokenizer, model = get_model()
    inputs = tokenizer(text, padding=True, truncation=True, return_tensors="pt", max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
        
    # Mean pooling
    attention_mask = inputs['attention_mask']
    token_embeddings = outputs.last_hidden_state
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    
    sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
    sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
    
    embedding = (sum_embeddings / sum_mask).squeeze().numpy()
    
    # Explicitly do L2 normalization for cosine similarity
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    
    return np.ascontiguousarray(embedding, dtype=np.float32)

def generate_embeddings_batch(texts: list[str]) -> np.ndarray:
    """
    Generates embeddings for a batch of texts.
    """
    if not texts:
        return np.array([])
        
    tokenizer, model = get_model()
    inputs = tokenizer(texts, padding=True, truncation=True, return_tensors="pt", max_length=512)
    
    with torch.no_grad():
        outputs = model(**inputs)
        
    attention_mask = inputs['attention_mask']
    token_embeddings = outputs.last_hidden_state
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    
    sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
    sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
    
    embeddings = (sum_embeddings / sum_mask).numpy()
    
    # Explicitly do L2 normalization for cosine similarity on batch
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1e-12
    embeddings = embeddings / norms
    
    return np.ascontiguousarray(embeddings, dtype=np.float32)
