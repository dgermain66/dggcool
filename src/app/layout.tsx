import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DGGCOOL — Free AI Video & Creative Studio",
  description: "Generate stunning videos, images, and scripts from text. Free forever. The all-in-one AI creative studio for makers, marketers, and storytellers.",
  keywords: ["AI video generator","AI image generator","text to video","image to video","AI creative studio","DGGCOOL","free AI tools"],
  authors: [{ name: "DGGCOOL Labs" }],
  icons: { icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg" },
  openGraph: { title: "DGGCOOL — Free AI Video & Creative Studio", description: "Generate stunning videos, images, and scripts from text. Free forever.", siteName: "DGGCOOL", type: "website" },
  twitter: { card: "summary_large_image", title: "DGGCOOL — Free AI Video & Creative Studio", description: "Generate stunning videos, images, and scripts from text. Free forever." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
