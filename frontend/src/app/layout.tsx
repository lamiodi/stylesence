import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// The site URL is only used server-side (metadata/OG/sitemap) — accept both the
// private name (SITE_URL, Vercel "Config") and the classic public one.
const SITE_URL =
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";
/** Social preview — a real collection photo. */
const OG_IMAGE =
  "https://res.cloudinary.com/qaruxkhf/image/upload/w_1200,c_limit,ar_1.91,q_auto,f_jpg/v1790056402/stylesence/products/camille-duo-cafe.jpg";
/** Hero LCP — the poster frame of the homepage film. */
const HERO_POSTER =
  "https://res.cloudinary.com/qaruxkhf/video/upload/so_1,q_auto,f_jpg/v1790053166/stylesence/products/IMG_7612_yc1iae.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Style Sence by SKR — Made-to-Order Womenswear, Lagos",
    template: "%s — Style Sence by SKR",
  },
  description:
    "Style Sence by SKR — made-to-order womenswear from Lagos. Polka-dot silk coordinates, fluid draping gowns and hand-woven Aso Oke, cut to your measurements and delivered nationwide.",
  keywords: [
    "Style Sence", "SKR", "made to order", "womenswear", "Aso Oke", "luxury fashion",
    "Lagos", "Nigeria", "custom fit", "two-piece sets", "dresses", "African fashion",
  ],
  authors: [{ name: "SKR Studio" }],
  alternates: { canonical: "/" },
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Style Sence by SKR — Made-to-Order Womenswear",
    description:
      "Polka-dot silk coordinates, fluid gowns and hand-woven Aso Oke — cut to your measurements in Lagos, delivered worldwide.",
    siteName: "Style Sence by SKR",
    type: "website",
    url: "/",
    images: [{ url: OG_IMAGE, width: 1200, height: 628, alt: "Two models in Style Sence polka-dot silk sets" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Style Sence by SKR — Made-to-Order Womenswear",
    description: "Cut to your measurements in Lagos — silk coordinates, gowns and hand-woven Aso Oke.",
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#26231F",
  width: "device-width",
  initialScale: 1,
};

/** Structured data — the storefront as an online store with its real contact channel. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  name: "Style Sence by SKR",
  url: SITE_URL,
  description:
    "Made-to-order womenswear from Lagos — polka-dot silk coordinates, fluid gowns and hand-woven Aso Oke, cut to your measurements.",
  currenciesAccepted: "NGN",
  priceRange: "₦₦",
  address: {
    "@type": "PostalAddress",
    streetAddress: "14A Awolowo Road, Ikoyi",
    addressLocality: "Lagos",
    addressCountry: "NG",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    telephone: "+2348163022233",
    availableLanguage: ["English", "Yoruba"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* CDN warm-up + hero LCP — the storefront's imagery lives on Cloudinary */}
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
        <link rel="preload" as="image" fetchPriority="high" href={HERO_POSTER} />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger -- static structured data, no user input
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className="antialiased bg-background text-foreground font-sans">
        {children}
        <Toaster position="bottom-right" richColors={false} closeButton />
      </body>
    </html>
  );
}
