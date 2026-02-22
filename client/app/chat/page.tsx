"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare, Send, Loader2, Trash2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { chatStream } from "@/lib/api";
import { useLearningStore } from "@/lib/store";
import { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ChatPage() {
    const router = useRouter();
    const { currentDocument, chatHistory, addChatMessage, updateLastAssistantMessage, clearChatHistory } =
        useLearningStore();

    const [input, setInput] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    // Ref to the inner content div for scrolling (ScrollArea doesn't forward refs)
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    const handleSend = useCallback(async () => {
        if (!input.trim() || isStreaming || !currentDocument) return;

        const userMessage: ChatMessage = {
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        };

        // Capture the history BEFORE adding the new messages
        // (chatHistory at this point is the previous conversation)
        const historySnapshot = [...chatHistory];

        addChatMessage(userMessage);
        setInput("");
        setIsStreaming(true);

        // Add empty assistant placeholder
        const assistantPlaceholder: ChatMessage = {
            role: "assistant",
            content: "",
            timestamp: new Date(),
        };
        addChatMessage(assistantPlaceholder);

        try {
            let fullResponse = "";
            const stream = chatStream(
                currentDocument.id,
                userMessage.content,
                historySnapshot  // ✓ send only history BEFORE this turn
            );

            for await (const chunk of stream) {
                if (chunk.error) {
                    toast.error(chunk.error);
                    updateLastAssistantMessage("Sorry, I encountered an error. Please try again.");
                    break;
                }
                fullResponse += chunk.content;
                updateLastAssistantMessage(fullResponse);
            }

            // If the response came back empty, show a fallback
            if (!fullResponse) {
                updateLastAssistantMessage("I couldn't generate a response. Please try again.");
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Chat failed";
            toast.error(msg);
            updateLastAssistantMessage("Sorry, I encountered an error. Please try again.");
        } finally {
            setIsStreaming(false);
            textareaRef.current?.focus();
        }
    }, [input, isStreaming, currentDocument, chatHistory, addChatMessage, updateLastAssistantMessage]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

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
        <div className="flex h-screen flex-col">
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
                        <MessageSquare className="h-6 w-6 text-cyan-400" />
                        Chat
                    </h1>
                    <p className="mt-0.5 text-sm text-white/40">{currentDocument.title}</p>
                </div>
                <Button
                    onClick={() => {
                        clearChatHistory();
                        toast.success("Chat history cleared");
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-white/30 hover:text-white/60"
                    disabled={chatHistory.length === 0 || isStreaming}
                >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Clear
                </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-6 py-4">
                {chatHistory.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 py-24 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                            <MessageSquare className="h-8 w-8 text-cyan-400/50" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white/70">Start a conversation</h2>
                            <p className="mt-1 text-sm text-white/40">
                                Ask anything about your document. The AI uses RAG to find relevant context.
                            </p>
                        </div>
                        <div className="mt-2 flex flex-wrap justify-center gap-2">
                            {[
                                "Summarize the key points",
                                "What are the main concepts?",
                                "Explain this topic in simple terms",
                            ].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => setInput(suggestion)}
                                    className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 pb-4">
                        {chatHistory.map((msg, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "flex gap-3",
                                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                                )}
                            >
                                {/* Avatar */}
                                <div
                                    className={cn(
                                        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm",
                                        msg.role === "user"
                                            ? "bg-gradient-to-br from-violet-500 to-indigo-600"
                                            : "bg-gradient-to-br from-cyan-500 to-teal-600"
                                    )}
                                >
                                    {msg.role === "user" ? (
                                        <User className="h-4 w-4 text-white" />
                                    ) : (
                                        <Bot className="h-4 w-4 text-white" />
                                    )}
                                </div>

                                {/* Bubble */}
                                <div
                                    className={cn(
                                        "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                                        msg.role === "user"
                                            ? "bg-gradient-to-br from-violet-600/30 to-indigo-600/30 text-white"
                                            : "bg-white/5 text-white/80"
                                    )}
                                >
                                    {msg.content || (
                                        <span className="flex items-center gap-2 text-white/40">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Thinking…
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {/* Invisible anchor for auto-scroll */}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </ScrollArea>

            {/* Input bar */}
            <div className="flex-shrink-0 border-t border-white/10 px-6 py-4">
                <div className="flex gap-3">
                    <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask a question about your document… (Enter to send, Shift+Enter for newline)"
                        rows={2}
                        disabled={isStreaming}
                        className="flex-1 resize-none bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-cyan-500"
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!input.trim() || isStreaming}
                        className="h-auto bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 border-0 px-4 disabled:opacity-30"
                    >
                        {isStreaming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
                <p className="mt-2 text-center text-[10px] text-white/20">
                    Responses are grounded in your document using RAG
                </p>
            </div>
        </div>
    );
}
