"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    HelpCircle,
    CheckCircle,
    XCircle,
    Loader2,
    RefreshCw,
    Trophy,
    ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { generateQuiz } from "@/lib/api";
import { useLearningStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { QuizQuestion } from "@/lib/types";

type UserAnswers = Record<number, string>;
type QuizState = "idle" | "taking" | "submitted";

export default function QuizPage() {
    const router = useRouter();
    const { currentDocument, quizQuestions, setQuizQuestions } = useLearningStore();

    const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
    const [quizState, setQuizState] = useState<QuizState>(
        quizQuestions.length > 0 ? "taking" : "idle"
    );
    const [isLoading, setIsLoading] = useState(false);
    const [expandedExplanations, setExpandedExplanations] = useState<Set<number>>(new Set());

    const handleGenerate = async () => {
        if (!currentDocument) {
            router.push("/");
            return;
        }
        setIsLoading(true);
        try {
            const result = await generateQuiz(currentDocument.id);
            setQuizQuestions(result.questions);
            setUserAnswers({});
            setQuizState("taking");
            setExpandedExplanations(new Set());
            toast.success(`Generated ${result.count} quiz questions!`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to generate quiz";
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = () => {
        if (Object.keys(userAnswers).length < quizQuestions.length) {
            toast.warning("Please answer all questions before submitting.");
            return;
        }
        setQuizState("submitted");
    };

    const score = quizQuestions.filter(
        (q, i) => userAnswers[i] === q.correct_answer
    ).length;

    const scorePercent = quizQuestions.length > 0 ? Math.round((score / quizQuestions.length) * 100) : 0;

    const toggleExplanation = (idx: number) => {
        setExpandedExplanations((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const optionKeys: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];

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
        <div className="min-h-screen px-6 py-10">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
                        <HelpCircle className="h-6 w-6 text-indigo-400" />
                        Quiz
                    </h1>
                    <p className="mt-1 text-sm text-white/40">{currentDocument.title}</p>
                </div>
                <div className="flex items-center gap-3">
                    {quizState === "submitted" && (
                        <Badge
                            className={cn(
                                "text-sm font-semibold",
                                scorePercent >= 80
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    : scorePercent >= 50
                                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                        : "bg-red-500/20 text-red-300 border-red-500/30"
                            )}
                        >
                            {score}/{quizQuestions.length} correct
                        </Badge>
                    )}
                    <Button
                        onClick={handleGenerate}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                        className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                    >
                        {isLoading ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                        )}
                        {quizQuestions.length > 0 ? "Regenerate" : "Generate"}
                    </Button>
                </div>
            </div>

            {/* Idle state */}
            {quizState === "idle" && !isLoading && (
                <div className="flex flex-col items-center justify-center gap-6 py-24">
                    <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                        <HelpCircle className="h-12 w-12 text-indigo-400/50" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-white/80">No quiz yet</h2>
                        <p className="mt-2 text-sm text-white/40">
                            Click &quot;Generate&quot; to create MCQ questions from your document.
                        </p>
                    </div>
                    <Button
                        onClick={handleGenerate}
                        className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border-0"
                    >
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Generate Quiz
                    </Button>
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center gap-4 py-24">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
                    <p className="text-white/50">Generating quiz questions with AI…</p>
                </div>
            )}

            {/* Score card (submitted) */}
            {quizState === "submitted" && (
                <div className="mb-8 rounded-2xl border border-white/10 bg-gradient-to-r from-violet-900/30 to-indigo-900/30 p-6">
                    <div className="flex items-center gap-4">
                        <Trophy
                            className={cn(
                                "h-10 w-10",
                                scorePercent >= 80
                                    ? "text-amber-400"
                                    : scorePercent >= 50
                                        ? "text-slate-400"
                                        : "text-red-400"
                            )}
                        />
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold text-white">
                                {scorePercent >= 80 ? "Excellent!" : scorePercent >= 50 ? "Good effort!" : "Keep practicing!"}
                            </h2>
                            <p className="text-sm text-white/50">
                                You scored {score} out of {quizQuestions.length} ({scorePercent}%)
                            </p>
                        </div>
                        <Button
                            onClick={() => {
                                setUserAnswers({});
                                setQuizState("taking");
                                setExpandedExplanations(new Set());
                            }}
                            variant="outline"
                            size="sm"
                            className="border-white/10"
                        >
                            Retry
                        </Button>
                    </div>
                    <Progress
                        value={scorePercent}
                        className="mt-4 h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-indigo-500"
                    />
                </div>
            )}

            {/* Questions */}
            {(quizState === "taking" || quizState === "submitted") && !isLoading && (
                <div className="space-y-6 pb-10">
                    {quizQuestions.map((question: QuizQuestion, idx: number) => {
                        const userAnswer = userAnswers[idx];
                        const isCorrect = userAnswer === question.correct_answer;
                        const showResult = quizState === "submitted";
                        const isExpandedExplanation = expandedExplanations.has(idx);

                        return (
                            <div
                                key={idx}
                                className={cn(
                                    "rounded-2xl border p-5 transition-colors",
                                    showResult
                                        ? isCorrect
                                            ? "border-emerald-500/20 bg-emerald-900/10"
                                            : "border-red-500/20 bg-red-900/10"
                                        : "border-white/10 bg-white/5"
                                )}
                            >
                                <div className="mb-4 flex items-start gap-3">
                                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/70">
                                        {idx + 1}
                                    </span>
                                    <p className="text-base font-medium text-white">{question.question}</p>
                                    {showResult && (
                                        <div className="ml-auto flex-shrink-0">
                                            {isCorrect ? (
                                                <CheckCircle className="h-5 w-5 text-emerald-400" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-400" />
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Options */}
                                <div className="space-y-2 pl-10">
                                    {optionKeys.map((key) => {
                                        const isSelected = userAnswer === key;
                                        const isCorrectOption = question.correct_answer === key;
                                        const optionText = question.options[key];

                                        return (
                                            <button
                                                key={key}
                                                onClick={() => {
                                                    if (quizState === "taking") {
                                                        setUserAnswers((prev) => ({ ...prev, [idx]: key }));
                                                    }
                                                }}
                                                disabled={quizState === "submitted"}
                                                className={cn(
                                                    "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-all",
                                                    showResult
                                                        ? isCorrectOption
                                                            ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
                                                            : isSelected && !isCorrectOption
                                                                ? "bg-red-500/20 text-red-200 border border-red-500/30"
                                                                : "bg-white/5 text-white/40 border border-white/5"
                                                        : isSelected
                                                            ? "bg-violet-500/20 text-violet-200 border border-violet-500/40"
                                                            : "bg-white/5 text-white/70 border border-white/5 hover:bg-white/10 hover:text-white"
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs font-bold",
                                                        showResult && isCorrectOption
                                                            ? "bg-emerald-500/30 text-emerald-300"
                                                            : showResult && isSelected && !isCorrectOption
                                                                ? "bg-red-500/30 text-red-300"
                                                                : isSelected
                                                                    ? "bg-violet-500/40 text-violet-200"
                                                                    : "bg-white/10 text-white/50"
                                                    )}
                                                >
                                                    {key}
                                                </span>
                                                {optionText}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Explanation (submitted only) */}
                                {showResult && (
                                    <div className="mt-3 pl-10">
                                        <button
                                            onClick={() => toggleExplanation(idx)}
                                            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70"
                                        >
                                            <ChevronDown
                                                className={cn(
                                                    "h-3 w-3 transition-transform",
                                                    isExpandedExplanation && "rotate-180"
                                                )}
                                            />
                                            {isExpandedExplanation ? "Hide" : "Show"} explanation
                                        </button>
                                        {isExpandedExplanation && (
                                            <p className="mt-2 rounded-lg border border-white/5 bg-white/5 px-4 py-3 text-sm text-white/60">
                                                {question.explanation}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Submit button */}
                    {quizState === "taking" && (
                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
                            <p className="text-sm text-white/50">
                                {Object.keys(userAnswers).length}/{quizQuestions.length} answered
                            </p>
                            <Button
                                onClick={handleSubmit}
                                disabled={Object.keys(userAnswers).length < quizQuestions.length}
                                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border-0 disabled:opacity-30"
                            >
                                Submit Quiz
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
