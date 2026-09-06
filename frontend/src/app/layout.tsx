import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { CommandSpine } from '../components/layout/CommandSpine';
import { FinancialStatusStrip } from '../components/layout/FinancialStatusStrip';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://myca.in';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'MyCA — Private Personal Finance & ₹1 Crore Planning for India',
    template: '%s | MyCA',
  },
  description:
    'Understand your money, calculate your true monthly surplus, build your emergency buffer, and navigate the shortest path to ₹1 Crore with mathematical certainty.',
  keywords: [
    'personal finance India',
    'monthly surplus calculator',
    '1 crore path',
    'shortest path to 1 crore',
    'emergency fund calculator India',
    'Indian tax regime 2024-25',
    'Section 115BAC',
    'financial freedom India',
    'fiduciary personal finance',
  ],
  authors: [{ name: 'MyCA Engineering' }],
  creator: 'MyCA',
  publisher: 'MyCA Fiduciary Instruments',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'MyCA — Personal Financial Clarity & ₹1 Crore Planning',
    description:
      'A private financial intelligence desk that calculates where your money stands, models your emergency buffer, and tracks your shortest path to ₹1 Crore.',
    url: baseUrl,
    siteName: 'MyCA',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyCA — Personal Financial Clarity & ₹1 Crore Planning',
    description:
      'Calculated surplus, emergency buffer safety, and ₹1 Crore roadmap without selling financial products.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MyCA',
  url: baseUrl,
  description:
    'Private, evidence-grounded financial intelligence instrument for Indian personal finance, monthly surplus calculation, emergency fund modeling, and ₹1 Crore milestone planning.',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'All',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
  featureList: [
    'Deterministic Monthly Surplus Calculation',
    'Emergency Fund Buffer Allocation',
    '₹1 Crore Shortest Path Compound Interest Model',
    'Income Tax FY 2024-25 Section 115BAC Education',
    'Fiduciary Zero-Commission Policy',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <AuthProvider>
          <div className="app-viewport">
            <CommandSpine />
            <div className="main-stage">
              <FinancialStatusStrip />
              <main className="content-canvas" role="main">
                {children}
              </main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
