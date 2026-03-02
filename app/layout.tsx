import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HeliosPrimer — AI Orchestration Hub',
  description: 'Connect all your AI subscriptions in one place. Let multiple AI agents collaborate to deliver superior answers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
