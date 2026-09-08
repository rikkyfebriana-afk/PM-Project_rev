import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Project Control Center',
  description: 'Portfolio monitoring dashboard for project delivery, financials, milestones, and operational risk.',
  openGraph: {
    title: 'Project Control Center',
    description: 'Portfolio visibility. Delivery confidence.',
    images: ['https://project-control-center-indonesia.rikky-febriana.chatgpt.site/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Project Control Center',
    description: 'Portfolio visibility. Delivery confidence.',
    images: ['https://project-control-center-indonesia.rikky-febriana.chatgpt.site/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
