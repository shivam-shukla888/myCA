import type { Metadata } from 'next';
import PublicCroreCalculatorClient from './PublicCroreCalculatorClient';

export const metadata: Metadata = {
  title: '₹1 Crore Wealth & SIP Milestone Calculator | MyCA',
  description:
    'Calculate the exact months required to reach ₹1 Crore (10 Million INR) based on your monthly surplus, expected CAGR, and step-up acceleration. Transparent, verified financial math with zero commissions.',
  alternates: {
    canonical: 'https://myca.in/calculators/crore',
  },
  openGraph: {
    title: '₹1 Crore Wealth & SIP Milestone Calculator | MyCA',
    description:
      'Deterministic ₹1 Crore milestone planner for Indian investors. Model surplus levers, step-up SIPs, and time to financial freedom without stock tips or product promotion.',
    url: 'https://myca.in/calculators/crore',
    siteName: 'MyCA',
    locale: 'en_IN',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: '₹1 Crore Milestone & SIP Acceleration Calculator',
  url: 'https://myca.in/calculators/crore',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'All',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
  description:
    'Free, educational Indian mutual fund and wealth milestone calculator modeling monthly SIPs, annual step-ups, and compounding horizon to reach ₹1 Crore.',
};

export default function PublicCroreCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicCroreCalculatorClient />
    </>
  );
}
