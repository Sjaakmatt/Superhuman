import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // typedRoutes staat uit: bijna elke link hier draagt een ?d=<datum>, en dan
  // levert het alleen casts op.
  // Het plan wordt op de server uit supabase/seed gelezen wanneer er geen
  // database is; die bestanden moeten dus mee in de serverless bundel.
  outputFileTracingIncludes: {
    '/**': ['./supabase/seed/*.json'],
  },
};

export default config;
