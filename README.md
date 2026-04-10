# AI Smart PDF Manager

A mobile-first intelligent document management system that processes PDFs, enables natural language search via embeddings, auto-categorizes content, provides smart merge suggestions, and allows date-based deletion.

## 🚀 Tech Stack

- **Frontend**: React (Vite), Tailwind CSS 3, Lucide Icons
- **Backend**: FastAPI, SQLAlchemy, SQLite, Python
- **AI/NLP**: Sentence Transformers (`all-MiniLM-L6-v2`), FAISS Vector Database, PyMuPDF (Fitz)

## ⚙️ How to Run Locally

### 1. Start the Backend API

```bash
cd backend
python -m venv venv

# Activate Environment (Windows)
.\venv\Scripts\activate
# Activate Environment (Mac/Linux)
source venv/bin/activate

# Install Dependencies
pip install fastapi uvicorn sqlalchemy pymupdf sentence-transformers faiss-cpu python-multipart

# Start Server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

*The backend will be available at http://localhost:8000. It manages SQLite & FAISS vector states automatically.*

### 2. Start the Frontend App

```bash
cd frontend

# Install Node Dependencies
npm install

# Start Vite Dev Server
npm run dev -- --host
```

*The frontend application will be available at http://localhost:5173. You can access it on your local network using your machine's IP address (e.g. http://192.168.x.x:5173).*
