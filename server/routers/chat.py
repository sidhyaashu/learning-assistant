from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
import asyncio
import json

from config import client, GEMINI_MODEL_ID, openrouter_client, FALLBACK_MODELS
from utils.embeddings import generate_query_embedding_async
from utils.supabase_ops import similarity_search, get_document
from utils.error_helpers import gemini_error_to_http, extract_gemini_text

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    document_id: str
    message: str
    history: List[ChatMessage] = []


SYSTEM_PROMPT = """You are a helpful learning assistant. Your role is to help users understand and learn from the content they've provided.

Use the following context from the document to answer the user's question. If the answer is not in the context, say so honestly and offer related information if available.

Context from document:
{context}

Guidelines:
- Be educational and thorough in your explanations
- Use examples when helpful
- If something is unclear in the context, acknowledge it
- Stay focused on the document's content
- Format your response clearly with markdown when appropriate"""


def _sse(data: dict) -> str:
    """Format a dict as an SSE message."""
    return f"data: {json.dumps(data)}\n\n"


async def stream_chat_response(request: ChatRequest):
    """
    RAG chat with automatic provider fallback.
    Primary: OpenRouter (Streaming)
    Secondary: Gemini (Streaming)
    """
    loop = asyncio.get_event_loop()

    # 1. Generate query embedding (Gemini remains primary for this)
    try:
        query_embedding = await generate_query_embedding_async(request.message)
    except Exception as e:
        yield _sse({"content": "", "error": str(e), "done": True})
        return

    # 2. Retrieve relevant chunks
    try:
        chunks = await loop.run_in_executor(
            None, lambda: similarity_search(query_embedding, request.document_id, match_count=5)
        )
    except Exception as e:
        yield _sse({"content": "", "error": str(e), "done": True})
        return

    context = "\n\n".join([c["content"] for c in chunks]) if chunks else "No specific context found."
    system_message = SYSTEM_PROMPT.format(context=context)

    # 3. Try OpenRouter First
    if openrouter_client:
        print("[chat] Using OpenRouter as primary...")
        for model in FALLBACK_MODELS:
            print(f"[chat] Attempting OpenRouter model: {model}")
            try:
                # Build history for OpenAI format
                messages = [{"role": "system", "content": system_message}]
                for msg in request.history:
                    if msg.content.strip():
                        messages.append({"role": msg.role, "content": msg.content})
                messages.append({"role": "user", "content": request.message})

                # Stream from OpenRouter
                response = await loop.run_in_executor(
                    None,
                    lambda: openrouter_client.chat.completions.create(
                        model=model,
                        messages=messages,
                        stream=True,
                    ),
                )
                
                streamed_any = False
                for chunk in response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        text = chunk.choices[0].delta.content
                        streamed_any = True
                        yield _sse({"content": text, "done": False})
                
                if streamed_any:
                    yield _sse({"content": "", "done": True})
                    return
            except Exception as e:
                err_msg = str(e).lower()
                print(f"[chat] OpenRouter model {model} failed: {e}")
                if any(x in err_msg for x in ["429", "quota", "rate_limit"]):
                    continue
                break # Non-rate-limit error

    # 4. Final Fallback: Gemini
    print("[chat] Falling back to Gemini...")
    gemini_history = []
    for msg in request.history:
        if msg.content.strip():
            role = "user" if msg.role == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg.content]})

    try:
        chat_session = client.chats.create(
            model=GEMINI_MODEL_ID,
            history=gemini_history,
            config={"system_instruction": system_message, "temperature": 0.7}
        )
        
        chunks_it = await loop.run_in_executor(None, lambda: chat_session.send_message_stream(request.message))
        
        streamed_any = False
        while True:
            chunk = await loop.run_in_executor(None, lambda: next(chunks_it, None))
            if chunk is None: break
            try:
                text = chunk.text
                if text:
                    streamed_any = True
                    yield _sse({"content": text, "done": False})
            except: pass
        
        if not streamed_any:
            yield _sse({"content": "AI rejected the query (safety/empty).", "done": False})
        yield _sse({"content": "", "done": True})
    except Exception as e:
        raise_err = gemini_error_to_http(e, "Chat")
        yield _sse({"content": "", "error": raise_err.detail, "done": True})


@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """
    RAG-based chat with streaming SSE response.
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # Validate document exists (fail-fast before opening the stream)
    try:
        get_document(request.document_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Document not found.")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return StreamingResponse(
        stream_chat_response(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
