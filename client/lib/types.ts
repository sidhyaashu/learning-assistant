// ─── Core Domain Types ───────────────────────────────────────────────

export interface Document {
  id: string;
  title: string;
  source_type: "youtube" | "pdf";
  source_url?: string;
  created_at?: string;
}

export interface ProcessVideoResponse {
  document_id: string;
  chunk_count: number;
  title: string;
  message: string;
}

export interface ProcessPdfResponse {
  document_id: string;
  chunk_count: number;
  page_count: number;
  title: string;
  message: string;
}

// ─── Flashcard Types ─────────────────────────────────────────────────

export interface Flashcard {
  question: string;
  answer: string;
}

export interface FlashcardsResponse {
  document_id: string;
  document_title: string;
  flashcards: Flashcard[];
  count: number;
}

// ─── Quiz Types ───────────────────────────────────────────────────────

export interface QuizQuestion {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_answer: "A" | "B" | "C" | "D";
  explanation: string;
}

export interface QuizResponse {
  document_id: string;
  document_title: string;
  questions: QuizQuestion[];
  count: number;
}

// ─── Chat Types ───────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

export interface ChatStreamChunk {
  content: string;
  done: boolean;
  error?: string;
}

// ─── UI State Types ───────────────────────────────────────────────────

export type ProcessingStatus = "idle" | "processing" | "success" | "error";
