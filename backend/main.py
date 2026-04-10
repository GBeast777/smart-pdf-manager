from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import process, embed, chat, merge, smart_merge

app = FastAPI(title="AI Smart PDF Manager")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Page-Count"],
)

app.include_router(process.router, tags=["Process"])
app.include_router(embed.router, tags=["Embed"])
app.include_router(chat.router, tags=["Chat"])
app.include_router(merge.router, tags=["Merge"])
app.include_router(smart_merge.router, tags=["Smart Merge"])

@app.get("/")
def root():
    return {"message": "AI Smart PDF Manager API is running (stateless mode)"}
