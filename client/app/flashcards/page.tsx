"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Brain, ChevronLeft, ChevronRight, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateFlashcards } from "@/lib/api";
import { useLearningStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function FlashcardsPage() {
    const router = useRouter();
    const { currentDocument, flashcards, setFlashcards } = useLearningStore();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [viewed, setViewed] = useState<Set<number>>(new Set());

    const handleGenerate = async () => {
        if (!currentDocument) {
            router.push("/");
            return;
        }
        setIsLoading(true);
        try {
            const result = await generateFlashcards(currentDocument.id);
            setFlashcards(result.flashcards);
            setCurrentIndex(0);
            setIsFlipped(false);
            setViewed(new Set([0]));
            toast.success(`Generated ${result.count} flashcards!`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to generate flashcards";
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const goTo = (idx: number) => {
        // Clamp to valid range to prevent undefined access
        const safe = Math.max(0, Math.min(idx, flashcards.length - 1));
        setCurrentIndex(safe);
        setIsFlipped(false);
        setViewed((prev) => new Set(prev).add(safe));
    };

    const prev = () => goTo(Math.max(0, currentIndex - 1));
    const next = () => goTo(Math.min(flashcards.length - 1, currentIndex + 1));

    if (!currentDocument) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4">
                <p className="text-white/50">No document loaded.</p>
                <Button onClick={() => router.push("/")} variant="outline" className="border-white/10">
                    Go to Upload
                </Button>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col px-6 py-10">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
                        <Brain className="h-6 w-6 text-violet-400" />
                        Flashcards
                    </h1>
                    <p className="mt-1 text-sm text-white/40">{currentDocument.title}</p>
                </div>
                <div className="flex items-center gap-3">
                    {flashcards.length > 0 && (
                        <Badge variant="outline" className="border-white/10 text-white/60">
                            {viewed.size}/{flashcards.length} viewed
                        </Badge>
                    )}
                    <Button
                        onClick={handleGenerate}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                        className="border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
                    >
                        {isLoading ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                        )}
                        {flashcards.length > 0 ? "Regenerate" : "Generate"}
                    </Button>
                </div>
            </div>

            {/* Empty state */}
            {flashcards.length === 0 && !isLoading && (
                <div className="flex flex-1 flex-col items-center justify-center gap-6">
                    <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                        <Brain className="h-12 w-12 text-violet-400/50" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-white/80">No flashcards yet</h2>
                        <p className="mt-2 text-sm text-white/40">
                            Click &quot;Generate&quot; to create AI-powered flashcards from your document.
                        </p>
                    </div>
                    <Button
                        onClick={handleGenerate}
                        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0"
                    >
                        <Brain className="mr-2 h-4 w-4" />
                        Generate Flashcards
                    </Button>
                </div>
            )}

            {/* Loading state */}
            {isLoading && (
                <div className="flex flex-1 flex-col items-center justify-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
                    <p className="text-white/50">Generating flashcards with AI…</p>
                </div>
            )}

            {/* Flashcard display */}
            {flashcards.length > 0 && !isLoading && (
                <div className="flex flex-1 flex-col items-center justify-center gap-8">
                    {/* Flip card */}
                    <div
                        onClick={() => setIsFlipped(!isFlipped)}
                        className="perspective-1000 w-full max-w-2xl cursor-pointer"
                        style={{ perspective: "1000px" }}
                    >
                        <div
                            className="relative h-72 transition-transform duration-500"
                            style={{
                                transformStyle: "preserve-3d",
                                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                            }}
                        >
                            {/* Front */}
                            <div
                                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-900/40 to-indigo-900/40 p-8 text-center"
                                style={{ backfaceVisibility: "hidden" }}
                            >
                                <Badge className="mb-4 bg-violet-500/20 text-violet-300 border-violet-500/30">
                                    Question
                                </Badge>
                                <p className="text-xl font-medium leading-relaxed text-white">
                                    {flashcards[currentIndex].question}
                                </p>
                                <p className="mt-6 text-xs text-white/30">Click to reveal answer</p>
                            </div>

                            {/* Back */}
                            <div
                                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-900/40 to-teal-900/40 p-8 text-center"
                                style={{
                                    backfaceVisibility: "hidden",
                                    transform: "rotateY(180deg)",
                                }}
                            >
                                <Badge className="mb-4 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                    Answer
                                </Badge>
                                <p className="text-xl font-medium leading-relaxed text-white">
                                    {flashcards[currentIndex].answer}
                                </p>
                                <p className="mt-6 text-xs text-white/30">Click to flip back</p>
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-4">
                        <Button
                            onClick={prev}
                            disabled={currentIndex === 0}
                            variant="outline"
                            size="icon"
                            className="border-white/10 disabled:opacity-30"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <span className="min-w-[80px] text-center text-sm text-white/60">
                            {currentIndex + 1} / {flashcards.length}
                        </span>

                        <Button
                            onClick={next}
                            disabled={currentIndex === flashcards.length - 1}
                            variant="outline"
                            size="icon"
                            className="border-white/10 disabled:opacity-30"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Dot navigation */}
                    <div className="flex flex-wrap justify-center gap-2">
                        {flashcards.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => goTo(idx)}
                                className={cn(
                                    "h-2 w-2 rounded-full transition-all duration-200",
                                    idx === currentIndex
                                        ? "w-6 bg-violet-500"
                                        : viewed.has(idx)
                                            ? "bg-white/30"
                                            : "bg-white/10"
                                )}
                            />
                        ))}
                    </div>

                    {/* Reset */}
                    <Button
                        onClick={() => {
                            setCurrentIndex(0);
                            setIsFlipped(false);
                            setViewed(new Set([0]));
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-white/30 hover:text-white/60"
                    >
                        <RotateCcw className="mr-1.5 h-3 w-3" />
                        Reset
                    </Button>
                </div>
            )}
        </div>
    );
}
