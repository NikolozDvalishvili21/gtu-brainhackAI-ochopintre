import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Interior AI Studio',
  description: 'Design your perfect interior in 2D and 3D',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
