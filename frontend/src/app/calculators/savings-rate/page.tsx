import type { Metadata } from 'next';
import PublicSavingsRateCalculatorClient from './PublicSavingsRateCalculatorClient';

export const metadata: Metadata = {
  title: 'Savings Rate & 50/30/20 Calculator India | Financial Freedom | MyCA',
  description:
    'Calculate your true monthly surplus, 50/30/20 budget ratio, and years to financial independence in Indian Rupees. 100% deterministic compound calculations without sales pitches.',
  alternates: {
    canonical: 'https://myca.in/calculators/savings-rate',
  },
  openGraph: {
    title: 'Savings Rate & 50/30/20 Calculator India | Financial Freedom | MyCA',
    description:
      'Determine your true monthly savings rate, compare against the 50/30/20 benchmark, and project your years to financial freedom.',
    url: 'https://myca.in/calculators/savings-rate',
    siteName: 'MyCA',
    locale: 'en_IN',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Indian Savings Rate & 50/30/20 Calculator',
  url: 'https://myca.in/calculators/savings-rate',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'All',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
  description:
    'Free Indian personal finance savings rate calculator computing true monthly cash surplus, 50/30/20 budget compliance, and years to complete financial independence.',
};

export default function PublicSavingsRateCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicSavingsRateCalculatorClient />
    </>
  );
}
