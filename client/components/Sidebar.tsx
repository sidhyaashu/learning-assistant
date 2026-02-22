"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Brain, HelpCircle, MessageSquare, Upload, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLearningStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";

const navItems = [
    { href: "/", label: "Upload", icon: Upload },
    { href: "/flashcards", label: "Flashcards", icon: Brain },
    { href: "/quiz", label: "Quiz", icon: HelpCircle },
    { href: "/chat", label: "Chat", icon: MessageSquare },
];

export function Sidebar() {
    const pathname = usePathname();
    const { currentDocument } = useLearningStore();

    return (
        <aside className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-white/10 bg-[#0a0a0f] px-4 py-6">
            {/* Logo */}
            <div className="mb-8 flex items-center gap-2 px-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
                    <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-semibold text-white">LearnAI</span>
            </div>

            {/* Current Document */}
            {currentDocument && (
                <div className="mb-6 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-3">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-violet-400">
                        Active Document
                    </p>
                    <div className="flex items-start gap-2">
                        <BookOpen className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-300" />
                        <p className="line-clamp-2 text-sm text-violet-100">{currentDocument.title}</p>
                    </div>
                    <Badge
                        variant="outline"
                        className="mt-2 border-violet-500/30 bg-violet-500/20 text-[10px] text-violet-300"
                    >
                        {currentDocument.source_type === "youtube" ? "YouTube" : "PDF"}
                    </Badge>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex flex-1 flex-col gap-1">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href;
                    const isDisabled = href !== "/" && !currentDocument;
                    return (
                        <Link
                            key={href}
                            href={isDisabled ? "/" : href}
                            className={cn(
                                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-gradient-to-r from-violet-500/30 to-indigo-500/20 text-white shadow-sm shadow-violet-500/10"
                                    : isDisabled
                                        ? "cursor-not-allowed text-white/20"
                                        : "text-white/60 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                            {isDisabled && (
                                <span className="ml-auto text-[10px] text-white/20">Upload first</span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="mt-4 rounded-xl border border-white/5 bg-white/5 px-3 py-3 text-center">
                <p className="text-[10px] text-white/40">Powered by Gemini AI</p>
                <p className="text-[10px] text-white/25">+ Supabase pgvector</p>
            </div>
        </aside>
    );
}
