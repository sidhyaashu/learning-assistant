from typing import List
import asyncio
import time
from google.genai import types
from config import client, EMBEDDING_MODEL


# Maximum characters per text for embedding (Gemini limit is ~2048 tokens ≈ 8000 chars)
MAX_EMBED_CHARS = 8000


def _truncate(text: str) -> str:
    """Truncate text to avoid hitting Gemini embedding token limits."""
    return text[:MAX_EMBED_CHARS] if len(text) > MAX_EMBED_CHARS else text


def generate_embedding(text: str) -> List[float]:
    """Generate a single embedding vector for the given text (document task)."""
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=_truncate(text),
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=768,
        ),
    )
    return result.embeddings[0].values


def generate_query_embedding(text: str) -> List[float]:
    """Generate an embedding optimized for query/retrieval."""
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=_truncate(text),
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=768,
        ),
    )
    return result.embeddings[0].values


def _sequential_embeddings(texts: List[str], initial_delay: float = 2.0) -> List[List[float]]:
    """
    Fallback: generate embeddings one by one with retry on rate-limit errors.
    initial_delay: seconds to wait before starting (use when triggered by a prior 429).
    """
    if initial_delay > 0:
        time.sleep(initial_delay)

    embeddings = []
    for i, text in enumerate(texts):
        retries = 5
        for attempt in range(retries):
            try:
                emb = generate_embedding(text)
                embeddings.append(emb)
                # Pace calls to stay within free-tier RPM limits
                if i < len(texts) - 1:
                    time.sleep(1.0)  # 1s gap → ~60 RPM max
                break
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "quota" in err_str or "rate" in err_str or "resource_exhausted" in err_str:
                    wait = 10 * (2 ** attempt)  # 10, 20, 40, 80, 160 seconds
                    print(f"[embeddings] Rate limit hit on chunk {i}, waiting {wait}s (attempt {attempt+1}/{retries})")
                    time.sleep(wait)
                    if attempt == retries - 1:
                        raise RuntimeError(
                            f"Gemini embedding rate limit exceeded after {retries} retries. "
                            "The free tier has limited requests per minute. Please wait a few minutes and try again."
                        ) from e
                else:
                    raise
    return embeddings


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for a list of texts using Gemini batch API.
    Retries with backoff on rate limits, then falls back to sequential.
    """
    if not texts:
        return []

    truncated = [_truncate(t) for t in texts]
    retries = 3

    for attempt in range(retries):
        try:
            result = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=truncated,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=768,
                ),
            )
            embeddings = [e.values for e in result.embeddings]
            if len(embeddings) != len(texts):
                raise ValueError("Batch embedding count mismatch")
            return embeddings
        except Exception as e:
            err_str = str(e).lower()
            is_rate_limit = "429" in err_str or "quota" in err_str or "rate" in err_str or "resource_exhausted" in err_str
            if is_rate_limit and attempt < retries - 1:
                wait = 15 * (2 ** attempt)  # 15, 30 seconds
                print(f"[embeddings] Batch rate limit, waiting {wait}s (attempt {attempt+1}/{retries})")
                time.sleep(wait)
                continue
            # Non-rate-limit error or exhausted batch retries → fall back to sequential
            initial_delay = 15.0 if is_rate_limit else 0.0
            return _sequential_embeddings(truncated, initial_delay=initial_delay)



async def generate_embeddings_batch_async(texts: List[str]) -> List[List[float]]:
    """Async wrapper — runs batch embedding in a thread pool executor."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, generate_embeddings_batch, texts)


async def generate_query_embedding_async(text: str) -> List[float]:
    """Async wrapper — runs query embedding in a thread pool executor."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, generate_query_embedding, text)
