import type { Metadata } from 'next';
import PublicEmergencyFundCalculatorClient from './PublicEmergencyFundCalculatorClient';

export const metadata: Metadata = {
  title: 'Emergency Fund Calculator India | RBI & DICGC Aligned | MyCA',
  description:
    'Calculate your ideal emergency buffer based on monthly fixed commitments, EMI obligations, and career volatility. Verified Indian financial planning with DICGC deposit insurance guidelines.',
  alternates: {
    canonical: 'https://myca.in/calculators/emergency-fund',
  },
  openGraph: {
    title: 'Emergency Fund Calculator India | RBI & DICGC Aligned | MyCA',
    description:
      'Determine your exact financial safety cushion in Indian Rupees. Factor in housing, loan EMIs, and healthcare with authoritative DICGC coverage guidelines.',
    url: 'https://myca.in/calculators/emergency-fund',
    siteName: 'MyCA',
    locale: 'en_IN',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Indian Emergency Fund Calculator',
  url: 'https://myca.in/calculators/emergency-fund',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'All',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
  description:
    'Free Indian personal finance emergency fund calculator factoring in non-negotiable living expenses, debt EMIs, DICGC ₹5 Lakh deposit insurance limits, and liquidity horizons.',
};

export default function PublicEmergencyFundCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicEmergencyFundCalculatorClient />
    </>
  );
}
