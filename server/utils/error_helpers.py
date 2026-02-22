"""
Shared error handling utilities for all routers.
"""
from fastapi import HTTPException


def gemini_error_to_http(e: Exception, operation: str = "AI operation") -> HTTPException:
    """
    Convert a Gemini API exception into a user-friendly HTTPException.
    Handles: rate limits, quota exceeded, invalid API key, safety blocks.
    """
    err = str(e).lower()
    if "429" in err or "quota" in err or "rate_limit" in err or "resource_exhausted" in err:
        return HTTPException(
            status_code=429,
            detail=(
                "Gemini API rate limit reached. You are on the free tier — "
                "please wait 60 seconds and try again."
            ),
        )
    if "api_key" in err or "api key" in err or "permission" in err or "401" in err:
        return HTTPException(
            status_code=500,
            detail="Gemini API key is invalid or missing. Check your server/.env file.",
        )
    if "safety" in err or "blocked" in err or "harm" in err:
        return HTTPException(
            status_code=422,
            detail=(
                "The content was blocked by Gemini's safety filters. "
                "Try with different content."
            ),
        )
    if "candidate" in err or "finish_reason" in err:
        return HTTPException(
            status_code=500,
            detail=f"{operation} was rejected by the AI model. Please try again.",
        )
    return HTTPException(
        status_code=500,
        detail=f"{operation} failed: {str(e)}",
    )


def generate_content_with_retry(
    client, model_id: str, contents: str, max_retries: int = 1
):
    """
    Primary: OpenRouter (with rotation through FALLBACK_MODELS).
    Fallback: Gemini (with limited retries to avoid long waits).
    """
    import time
    from config import openrouter_client, FALLBACK_MODELS

    # 1. Try OpenRouter First (if configured)
    if openrouter_client:
        print(f"[content] Using OpenRouter as primary...")
        last_fb_err = None
        for model in FALLBACK_MODELS:
            try:
                print(f"[content] Trying OpenRouter model: {model}")
                response = openrouter_client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": contents}]
                )
                class SimpleResponse:
                    def __init__(self, text):
                        self.text = text
                return SimpleResponse(response.choices[0].message.content)
            except Exception as fb_err:
                err_msg = str(fb_err).lower()
                print(f"[content] OpenRouter model {model} failed: {fb_err}")
                last_fb_err = fb_err
                if any(x in err_msg for x in ["429", "quota", "rate_limit"]):
                    continue
                else:
                    break # non-rate-limit error
        
        print("[content] OpenRouter exhausted or failed. Falling back to Gemini...")

    # 2. Try Gemini as fallback (or primary if OpenRouter not set)
    for attempt in range(max_retries):
        try:
            return client.models.generate_content(model=model_id, contents=contents)
        except Exception as e:
            err = str(e).lower()
            is_rate_limit = any(x in err for x in ["429", "quota", "rate_limit", "resource_exhausted"])
            
            if is_rate_limit:
                if attempt == max_retries - 1:
                    raise e
                
                wait_time = 10 * (attempt + 1)
                print(f"[content] Gemini rate limit. Waiting {wait_time}s (attempt {attempt+1}/{max_retries})...")
                time.sleep(wait_time)
            else:
                raise e


def extract_gemini_text(response) -> str:
    """
    Safely extract text from a Gemini response.
    Raises HTTPException if response has no valid text (e.g., safety block).
    """
    try:
        text = response.text
    except Exception:
        text = None

    if not text or not text.strip():
        # Try to extract finish reason for better error message
        try:
            candidate = response.candidates[0]
            finish_reason = str(candidate.finish_reason)
        except Exception:
            finish_reason = "unknown"
        raise HTTPException(
            status_code=500,
            detail=(
                f"AI returned an empty response (finish_reason={finish_reason}). "
                "This can happen due to safety filters or very short content. "
                "Please try again with different content."
            ),
        )
    return text
