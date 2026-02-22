import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Flashcard, QuizQuestion, ChatMessage } from "./types";

interface DocumentInfo {
    id: string;
    title: string;
    source_type: "youtube" | "pdf";
}

interface LearningStore {
    currentDocument: DocumentInfo | null;
    setCurrentDocument: (doc: DocumentInfo | null) => void;

    flashcards: Flashcard[];
    setFlashcards: (cards: Flashcard[]) => void;
    clearFlashcards: () => void;

    quizQuestions: QuizQuestion[];
    setQuizQuestions: (questions: QuizQuestion[]) => void;
    clearQuiz: () => void;

    chatHistory: ChatMessage[];
    addChatMessage: (msg: ChatMessage) => void;
    updateLastAssistantMessage: (content: string) => void;
    clearChatHistory: () => void;

    resetAll: () => void;
}

export const useLearningStore = create<LearningStore>()(
    persist(
        (set) => ({
            currentDocument: null,
            setCurrentDocument: (doc) => set({ currentDocument: doc }),

            flashcards: [],
            setFlashcards: (cards) => set({ flashcards: cards }),
            clearFlashcards: () => set({ flashcards: [] }),

            quizQuestions: [],
            setQuizQuestions: (questions) => set({ quizQuestions: questions }),
            clearQuiz: () => set({ quizQuestions: [] }),

            chatHistory: [],
            addChatMessage: (msg) =>
                set((state) => ({ chatHistory: [...state.chatHistory, msg] })),
            updateLastAssistantMessage: (content) =>
                set((state) => {
                    const history = [...state.chatHistory];
                    for (let i = history.length - 1; i >= 0; i--) {
                        if (history[i].role === "assistant") {
                            history[i] = { ...history[i], content };
                            break;
                        }
                    }
                    return { chatHistory: history };
                }),
            clearChatHistory: () => set({ chatHistory: [] }),

            resetAll: () => set({ flashcards: [], quizQuestions: [], chatHistory: [] }),
        }),
        {
            name: "learning-assistant-store",
            partialize: (state) => ({ currentDocument: state.currentDocument }),
        }
    )
);
