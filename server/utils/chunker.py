from typing import List


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    """
    Split text into overlapping chunks by word count.
    
    Args:
        text: The full text to chunk
        chunk_size: Number of words per chunk
        overlap: Number of overlapping words between consecutive chunks
    
    Returns:
        List of text chunks
    """
    words = text.split()
    chunks = []
    start = 0
    total_words = len(words)

    if total_words == 0:
        return []

    while start < total_words:
        end = min(start + chunk_size, total_words)
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        if end == total_words:
            break
        start += chunk_size - overlap

    return chunks
