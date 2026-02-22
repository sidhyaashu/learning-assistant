import {
    ProcessVideoResponse,
    ProcessPdfResponse,
    FlashcardsResponse,
    QuizResponse,
    ChatMessage,
    ChatStreamChunk,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Safely extract an error message from a failed fetch response. */
async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        try {
            const data = await res.json();
            return data?.detail || data?.message || fallback;
        } catch {
            return fallback;
        }
    }
    // Non-JSON body (e.g., HTML gateway error page)
    try {
        const text = await res.text();
        if (text.length < 200) return text; // short text is useful
    } catch { /* ignore */ }
    return `${fallback} (HTTP ${res.status})`;
}

// ─── Process Video ────────────────────────────────────────────────────

export async function processVideo(url: string): Promise<ProcessVideoResponse> {
    const res = await fetch(`${API_URL}/process-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, "Failed to process video"));
    return res.json();
}

// ─── Process PDF ──────────────────────────────────────────────────────

export async function processPdf(file: File): Promise<ProcessPdfResponse> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/process-pdf`, {
        method: "POST",
        body: formData,
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, "Failed to process PDF"));
    return res.json();
}

// ─── Generate Flashcards ──────────────────────────────────────────────

export async function generateFlashcards(documentId: string): Promise<FlashcardsResponse> {
    const res = await fetch(`${API_URL}/generate-flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId }),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, "Failed to generate flashcards"));
    return res.json();
}

// ─── Generate Quiz ────────────────────────────────────────────────────

export async function generateQuiz(documentId: string): Promise<QuizResponse> {
    const res = await fetch(`${API_URL}/generate-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId }),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, "Failed to generate quiz"));
    return res.json();
}

// ─── Chat (SSE Streaming) ─────────────────────────────────────────────

export async function* chatStream(
    documentId: string,
    message: string,
    history: ChatMessage[]
): AsyncGenerator<ChatStreamChunk> {
    const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            document_id: documentId,
            message,
            history: history.map((m) => ({ role: m.role, content: m.content })),
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || "Chat request failed");
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;
                try {
                    const chunk: ChatStreamChunk = JSON.parse(jsonStr);
                    yield chunk;
                    if (chunk.done) return;
                } catch {
                    // Skip malformed SSE chunks
                }
            }
        }
    }
}
