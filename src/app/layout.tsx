import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CineComic',
  description: 'Comic showcase presenter',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`${geist.className} bg-background text-foreground antialiased h-full`}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
