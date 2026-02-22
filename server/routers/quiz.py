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

MIN_CHUNKS_REQUIRED = 3  # Need at least this many chunks to generate meaningful quiz


class QuizRequest(BaseModel):
    document_id: str


QUIZ_PROMPT = """You are an expert educator. Based on the following content, create {count} multiple-choice quiz questions.

Content:
{context}

Generate exactly {count} quiz questions as a valid JSON array. Each question must have:
- "question": A clear, specific question
- "options": An object with keys "A", "B", "C", "D" — four plausible answer choices
- "correct_answer": The key of the correct option (e.g., "A", "B", "C", or "D")
- "explanation": A brief explanation of why the answer is correct

Rules:
- Test understanding of key concepts from the content
- All four options must be plausible (avoid obviously wrong distractors)
- Mix easy, medium, and hard questions
- Do NOT include any text outside the JSON array

Output ONLY valid JSON in this exact format:
[
  {{
    "question": "...",
    "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
    "correct_answer": "A",
    "explanation": "..."
  }}
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

    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    raise json.JSONDecodeError("No valid JSON array found in response", text, 0)


@router.post("/generate-quiz")
async def generate_quiz(request: QuizRequest):
    """
    Generate 5-10 MCQ quiz questions for a processed document using RAG + Gemini.
    """
    # Verify document exists
    try:
        doc = get_document(request.document_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Document not found.")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Retrieve relevant chunks
    query = "key concepts, important topics, facts, definitions, and core ideas"
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

    if len(chunks) < MIN_CHUNKS_REQUIRED:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Document is too short to generate a quiz "
                f"(found {len(chunks)} content chunk(s), need at least {MIN_CHUNKS_REQUIRED}). "
                "Please upload a longer document."
            ),
        )

    # Adjust quiz count based on available content
    quiz_count = min(8, max(3, len(chunks) // 3))
    context = "\n\n".join([c["content"] for c in chunks])
    prompt = QUIZ_PROMPT.format(context=context, count=quiz_count)

    try:
        response = await loop.run_in_executor(
            None,
            lambda: generate_content_with_retry(
                client, model_id=GEMINI_MODEL_ID, contents=prompt
            ),
        )
    except Exception as e:
        raise gemini_error_to_http(e, "Quiz generation")

    raw_text = extract_gemini_text(response)

    try:
        questions = extract_json_array(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail=(
                "AI returned an unparseable response. Please try again. "
                "If it persists, the document content may be too complex."
            ),
        )

    # Validate and sanitize structure
    validated = []
    for q in questions:
        if not isinstance(q, dict):
            continue
        required = {"question", "options", "correct_answer", "explanation"}
        if not required.issubset(q.keys()):
            continue
        if not isinstance(q["options"], dict):
            continue
        # Ensure all four option keys present
        if not all(k in q["options"] for k in ("A", "B", "C", "D")):
            continue
        correct = str(q["correct_answer"]).strip().upper()
        if correct not in ("A", "B", "C", "D"):
            continue
        validated.append({
            "question": str(q["question"]).strip(),
            "options": {k: str(q["options"].get(k, "")).strip() for k in ("A", "B", "C", "D")},
            "correct_answer": correct,
            "explanation": str(q["explanation"]).strip(),
        })

    if not validated:
        raise HTTPException(
            status_code=500,
            detail="AI generated quiz questions with invalid structure. Please try again.",
        )

    return {
        "document_id": request.document_id,
        "document_title": doc.get("title", ""),
        "questions": validated,
        "count": len(validated),
    }
