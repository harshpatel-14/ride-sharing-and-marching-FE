import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { MswProvider } from '@/mocks/provider'
import { QueryProvider } from '@/lib/query'
import { site } from '@/config/site'
import './globals.css'

export const metadata: Metadata = {
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <MswProvider>
          <QueryProvider>
            {children}
            <Toaster richColors closeButton position="top-center" />
          </QueryProvider>
        </MswProvider>
      </body>
    </html>
  )
}
