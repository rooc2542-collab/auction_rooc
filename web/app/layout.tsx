import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"
import QueryProvider from "@/components/QueryProvider"
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister"
import PWAInstallPrompt from "@/components/PWAInstallPrompt"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f766e" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: "ระบบประมูล",
  description: "ระบบจัดคิว สล็อต และประมูลไอเทมกิลด์ Geffen-Rooc",
  applicationName: "ระบบประมูล",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ระบบประมูล",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
        <ThemeProvider>
          <QueryProvider>
            <ServiceWorkerRegister />
            <PWAInstallPrompt />
            {children}
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

