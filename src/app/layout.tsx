import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Raster — SVG Pill Grid Generator',
  description: 'Design parametric pill-grid patterns from SVG paths',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="overflow-hidden h-screen">{children}</body>
    </html>
  )
}
