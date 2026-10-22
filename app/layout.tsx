import type { Metadata, Viewport } from 'next';
import './globals.css';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata: Metadata = {
  title: 'Social Lens — Your own social space',
  description:
    'Your own TikTok and Instagram profiles, saved content, and social perspective. A private workspace that starts with you.',
  manifest: base + '/manifest.webmanifest',
  applicationName: 'Social Lens',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Social Lens' },
  icons: { icon: base + '/social-lens.svg', apple: base + '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#080d18',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme=localStorage.getItem('social-lens-theme')==='light'?'light':'dark'}catch{}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
