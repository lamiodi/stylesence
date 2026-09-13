import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Style Sence by SKR — Modern Womenswear",
  description:
    "Style Sence by SKR — considered womenswear in ivory and charcoal. Silk, cashmere and tailoring, cut in small batches. Development preview.",
  keywords: ["Style Sence", "SKR", "womenswear", "luxury fashion", "Lagos", "editorial", "ivory", "charcoal"],
  authors: [{ name: "SKR Studio" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Style Sence by SKR",
    description: "Considered womenswear in ivory and charcoal — silk, cashmere and tailoring, cut in small batches.",
    siteName: "Style Sence by SKR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="bottom-right" richColors={false} closeButton />
      </body>
    </html>
  );
}
