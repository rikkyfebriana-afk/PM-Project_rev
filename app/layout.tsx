import type { Metadata } from 'next';
import { resolveMetadataUrl } from '@/lib/metadata-url';
import './globals.css';

const appUrl = resolveMetadataUrl({
  APP_URL: process.env.APP_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
});

export const metadata: Metadata = {
  metadataBase: appUrl,
  title: {
    default: 'Project Control Center',
    template: '%s | Project Control Center',
  },
  description:
    'Portfolio monitoring dashboard for project delivery, financials, milestones, and operational risk.',
  openGraph: {
    title: 'Project Control Center',
    description: 'Portfolio visibility. Delivery confidence.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Project Control Center',
    description: 'Portfolio visibility. Delivery confidence.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
