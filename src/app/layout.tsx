import type { Metadata } from "next"
import { Geist_Mono } from "next/font/google"
import "./globals.css"
import "./animations.css"
import "../styles/globals.css"

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Koto Trainer — Your AI Trainer, Nutritionist, and Coach. 24/7.",
  description: "Tell it who you are. It builds your workouts, plans your meals, tracks your progress, and checks in with you daily. 15+ sports. Any goal. Always on.",
  icons: { icon: "/koto_icon.svg", apple: "/koto_icon.svg" },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Koto Trainer",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "Koto Trainer — Your AI Trainer. Always On.",
    description: "Custom workouts, meal plans, progress tracking, and an AI that knows your sport, your goals, and your life. Free to start.",
    type: "website",
    url: "https://hellokoto.com/train",
    siteName: "Koto Trainer",
  },
  twitter: {
    card: "summary_large_image",
    title: "Koto Trainer — Your AI Trainer. Always On.",
    description: "Custom workouts, meal plans, and a 24/7 AI coach. Free to start.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      <head>
        <meta name="theme-color" content="#ffffff" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}// Sun Apr  5 03:47:16 UTC 2026
// deploy Sun Apr  5 04:36:15 UTC 2026
