import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
# from mangum import Mangum
from routers import process_video, process_pdf, flashcards, quiz, chat

# Rate limiter
# limiter = Limiter(key_func=get_remote_address, default_limits=["30/minute"])

app = FastAPI(
    title="AI Learning Assistant API",
    description="Process YouTube videos and PDFs, then generate flashcards, quizzes, and chat using RAG.",
    version="1.0.0",
)

# Attach rate limiter state and exception handler
# app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# CORS
# IMPORTANT: Wildcard subdomains (*.vercel.app) are NOT supported by browsers.
# Add your exact production Vercel URL to ADDITIONAL_ORIGINS in .env if needed.
# ---------------------------------------------------------------------------
_additional_origins = os.getenv("ADDITIONAL_ORIGINS", "")
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if _additional_origins:
    ALLOWED_ORIGINS.extend([o.strip() for o in _additional_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(process_video.router, tags=["Processing"])
app.include_router(process_pdf.router, tags=["Processing"])
app.include_router(flashcards.router, tags=["Generation"])
app.include_router(quiz.router, tags=["Generation"])
app.include_router(chat.router, tags=["Chat"])


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "message": "AI Learning Assistant API is running"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}



# handler = Mangum(app)