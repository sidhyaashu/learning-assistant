import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LearnAI – AI Learning Assistant",
  description:
    "Transform YouTube videos and PDFs into flashcards, quizzes, and interactive AI chat sessions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex h-screen overflow-hidden bg-[#06060a] antialiased`}
      >
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
