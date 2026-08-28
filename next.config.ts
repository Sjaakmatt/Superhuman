import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const config: NextConfig = {
  reactStrictMode: true,
  // typedRoutes staat uit: bijna elke link hier draagt een ?d=<datum>, en dan
  // levert het alleen casts op.
};

export default config;

// Maakt Cloudflare-bindings en -secrets beschikbaar tijdens `next dev`.
// Heeft geen effect op de productiebuild.
void initOpenNextCloudflareForDev();
