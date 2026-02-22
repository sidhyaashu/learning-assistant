from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import asyncio
import json
import re

from config import client, GEMINI_MODEL_ID
from utils.embeddings import generate_query_embedding_async
from utils.supabase_ops import similarity_search, get_document
from utils.error_helpers import (
    gemini_error_to_http,
    extract_gemini_text,
    generate_content_with_retry,
)

router = APIRouter()

MIN_CHUNKS_REQUIRED = 3  # Need at least this many chunks to generate meaningful flashcards


class FlashcardsRequest(BaseModel):
    document_id: str


FLASHCARD_PROMPT = """You are an expert educator. Based on the following content, generate {count} high-quality flashcards.

Content:
{context}

Generate exactly {count} flashcards as a valid JSON array. Each flashcard must have:
- "question": A clear, specific question
- "answer": A concise, accurate answer

Rules:
- Cover the most important concepts, facts, and ideas from the content
- Questions should be specific and test real understanding
- Answers should be concise (1-3 sentences)
- Do NOT include any text outside the JSON array

Output ONLY valid JSON in this exact format:
[
  {{"question": "...", "answer": "..."}},
  {{"question": "...", "answer": "..."}}
]"""


def extract_json_array(text: str) -> list:
    """Robustly extract a JSON array from model response."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fallback: find the first JSON array anywhere in the text
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    raise json.JSONDecodeError("No valid JSON array found in response", text, 0)


@router.post("/generate-flashcards")
async def generate_flashcards(request: FlashcardsRequest):
    """
    Generate 10-15 flashcards for a processed document using RAG + Gemini.
    """
    # Verify document exists
    try:
        doc = get_document(request.document_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Document not found.")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Retrieve relevant chunks
    query = "key concepts, important facts, main ideas, definitions, and core topics"
    try:
        query_embedding = await generate_query_embedding_async(query)
    except Exception as e:
        raise gemini_error_to_http(e, "Embedding generation")

    loop = asyncio.get_event_loop()
    try:
        chunks = await loop.run_in_executor(
            None,
            lambda: similarity_search(
                query_embedding=query_embedding,
                document_id=request.document_id,
                match_count=20,
            ),
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail=(
                "No content found for this document. "
                "The document may not have been processed correctly."
            ),
        )

    # Adjust flashcard count based on available content
    flashcard_count = min(12, max(3, len(chunks) // 2))

    if len(chunks) < MIN_CHUNKS_REQUIRED:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Document is too short to generate flashcards "
                f"(found {len(chunks)} content chunk(s), need at least {MIN_CHUNKS_REQUIRED}). "
                "Please upload a longer document."
            ),
        )

    context = "\n\n".join([c["content"] for c in chunks])
    prompt = FLASHCARD_PROMPT.format(context=context, count=flashcard_count)

    try:
        response = await loop.run_in_executor(
            None,
            lambda: generate_content_with_retry(
                client, model_id=GEMINI_MODEL_ID, contents=prompt
            ),
        )
    except Exception as e:
        raise gemini_error_to_http(e, "Flashcard generation")

    # Safely extract text (handles safety blocks, empty responses)
    raw_text = extract_gemini_text(response)

    try:
        flashcards = extract_json_array(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail=(
                "AI returned an unparseable response. This is rare — please try again. "
                "If it keeps happening, the document content may be too complex."
            ),
        )

    # Validate and sanitize structure
    validated = []
    for card in flashcards:
        if isinstance(card, dict) and card.get("question") and card.get("answer"):
            validated.append({
                "question": str(card["question"]).strip(),
                "answer": str(card["answer"]).strip(),
            })

    if not validated:
        raise HTTPException(
            status_code=500,
            detail="AI generated flashcards with invalid structure. Please try again.",
        )

    return {
        "document_id": request.document_id,
        "document_title": doc.get("title", ""),
        "flashcards": validated,
        "count": len(validated),
    }
