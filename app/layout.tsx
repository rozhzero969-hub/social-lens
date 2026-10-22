import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Social Lens — Your social world, in focus',
  description:
    'A quieter way to keep up with your TikTok and Instagram. Evidence-backed reports, saved profiles, and thoughtful notifications.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
