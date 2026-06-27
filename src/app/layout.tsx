import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Interior AI Studio',
  description: 'Design your perfect interior in 2D and 3D',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka" className={`${inter.variable} h-full`}>
      <body className={`${inter.className} min-h-full bg-surface text-gray-900 antialiased`}>
        {children}
      </body>
    </html>
  )
}
