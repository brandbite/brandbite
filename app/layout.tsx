import type { Metadata } from 'next'
import './globals.css'

import { Josefin_Sans } from "next/font/google";

const josefin = Josefin_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"], // istediğin ağırlıklar
  display: "swap",
});


export const metadata: Metadata = {
  title: 'Brandbite',
  description: 'Design Subscription Portal',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${josefin.className} min-h-screen bg-slate-950 text-slate-100 antialiased`}>
        {children}
      </body>
    </html>
  )
}
