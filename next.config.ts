import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Dynamische pagina's 30s in de client-router-cache houden:
    // tab-switches zijn dan instant; Server Actions revalideren alsnog
    // direct via revalidatePath.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
