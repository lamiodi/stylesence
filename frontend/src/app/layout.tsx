import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

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
      <body className="antialiased bg-background text-foreground font-sans">
        {children}
        <Toaster position="bottom-right" richColors={false} closeButton />
      </body>
    </html>
  );
}
