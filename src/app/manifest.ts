import type { MetadataRoute } from 'next';
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KouchParty",
    short_name: "Kouch",
    description: "couch player games for the insane.",
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/sample-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/sample-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}