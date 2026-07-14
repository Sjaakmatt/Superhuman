import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Superhuman OS",
    short_name: "Superhuman",
    description:
      "Persoonlijk become-superhuman dashboard: lichaam, geest, voeding, beweging en discipline in één gegamificeerd systeem.",
    start_url: "/vandaag",
    display: "standalone",
    background_color: "#0D0C16",
    theme_color: "#0D0C16",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
