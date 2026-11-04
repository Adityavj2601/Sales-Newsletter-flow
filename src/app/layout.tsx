import './globals.css';
import '../styles/shell.css';
import '../styles/editor.css';
import '../styles/send.css';
import '../styles/content.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: { default: 'Brief Studio', template: '%s · Brief Studio' }, description: 'Weekly sales newsletter studio' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Apple devices use SF Pro via the system stack; Inter is the stand-in elsewhere. */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
