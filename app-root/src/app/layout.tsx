import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NestRecruit — AI Recruiter Co-pilot",
  description: "AI-powered conversational talent intelligence engine that understands intent, ranks candidates, and explains decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
