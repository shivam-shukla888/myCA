import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://myca.in';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/calculators/crore',
          '/calculators/emergency-fund',
          '/education/tax-regimes-india',
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/ledger/',
          '/vault/',
          '/statements/',
          '/plan/',
          '/intelligence/',
          '/onboarding/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
