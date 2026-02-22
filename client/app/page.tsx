"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Link, FileText, Loader2, CheckCircle, Youtube } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { processVideo, processPdf } from "@/lib/api";
import { useLearningStore } from "@/lib/store";

type Status = "idle" | "processing" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const { setCurrentDocument, resetAll } = useLearningStore();

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const simulateProgress = (messages: string[]) => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < messages.length) {
        setStatusText(messages[i]);
        setProgress(Math.round(((i + 1) / messages.length) * 90));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 800);
    return interval;
  };

  const handleVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setStatus("processing");
    const interval = simulateProgress([
      "Fetching video transcript…",
      "Chunking text…",
      "Generating embeddings…",
      "Storing in vector database…",
    ]);

    try {
      const result = await processVideo(youtubeUrl.trim());
      clearInterval(interval);
      setProgress(100);
      setStatusText("Done!");
      resetAll();
      setCurrentDocument({ id: result.document_id, title: result.title, source_type: "youtube" });
      setStatus("done");
      toast.success("Video processed successfully!", { description: result.title });
      setTimeout(() => router.push("/flashcards"), 1000);
    } catch (err: unknown) {
      clearInterval(interval);
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Failed to process video";
      toast.error(msg);
    }
  };

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".pdf")) {
        toast.error("Please upload a PDF file.");
        return;
      }

      setStatus("processing");
      const interval = simulateProgress([
        "Reading PDF…",
        "Extracting text…",
        "Chunking content…",
        "Generating embeddings…",
        "Storing in vector database…",
      ]);

      try {
        const result = await processPdf(file);
        clearInterval(interval);
        setProgress(100);
        setStatusText("Done!");
        resetAll();
        setCurrentDocument({ id: result.document_id, title: result.title, source_type: "pdf" });
        setStatus("done");
        toast.success("PDF processed successfully!", {
          description: `${result.page_count} pages · ${result.chunk_count} chunks`,
        });
        setTimeout(() => router.push("/flashcards"), 1000);
      } catch (err: unknown) {
        clearInterval(interval);
        setStatus("error");
        const msg = err instanceof Error ? err.message : "Failed to process PDF";
        toast.error(msg);
      }
    },
    [setCurrentDocument, resetAll, router]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const isProcessing = status === "processing";

  const resetStatus = () => {
    setStatus("idle");
    setProgress(0);
    setStatusText("");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="mb-3 bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
            AI Learning Assistant
          </h1>
          <p className="text-white/50">
            Upload a YouTube video or PDF, then generate flashcards, quizzes, and chat with your
            content using AI.
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <Tabs defaultValue="youtube">
            <TabsList className="mb-6 grid w-full grid-cols-2 bg-white/5">
              <TabsTrigger value="youtube" className="gap-2">
                <Youtube className="h-4 w-4" />
                YouTube URL
              </TabsTrigger>
              <TabsTrigger value="pdf" className="gap-2">
                <FileText className="h-4 w-4" />
                Upload PDF
              </TabsTrigger>
            </TabsList>

            {/* YouTube Tab */}
            <TabsContent value="youtube">
              <form onSubmit={handleVideoSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white/70">YouTube Video URL</label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <Input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500"
                      disabled={isProcessing}
                    />
                  </div>
                  <p className="text-xs text-white/30">
                    The video must have captions/subtitles enabled.
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={isProcessing || !youtubeUrl.trim()}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0"
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {isProcessing ? "Processing…" : "Process Video"}
                </Button>
              </form>
            </TabsContent>

            {/* PDF Tab */}
            <TabsContent value="pdf">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                className={`group relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-8 py-12 transition-all duration-200 ${dragOver
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-white/10 hover:border-violet-500/50 hover:bg-white/5"
                  }`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5">
                  <FileText className="h-7 w-7 text-violet-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white/80">
                    Drag & drop your PDF here
                  </p>
                  <p className="mt-1 text-xs text-white/40">or click to browse (max 20MB)</p>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  disabled={isProcessing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Progress Bar */}
          {(status === "processing" || status === "done") && (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-white/70">{statusText}</p>
                {status === "done" && (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                )}
              </div>
              <Progress
                value={progress}
                className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-indigo-500"
              />
            </div>
          )}

          {/* Error State — let the user retry without refreshing */}
          {status === "error" && (
            <div className="mt-6 flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-300">Processing failed. Check the error toast above and try again.</p>
              <Button
                onClick={resetStatus}
                variant="ghost"
                size="sm"
                className="ml-4 shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Feature Pills */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {[
            { icon: "🃏", label: "Flashcards" },
            { icon: "🧠", label: "Quiz" },
            { icon: "💬", label: "AI Chat" },
            { icon: "⚡", label: "RAG-Powered" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/60"
            >
              <span>{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
