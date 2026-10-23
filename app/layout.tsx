import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = { title: '健身社團簽到', description: '公司健身社團活動簽到與統計' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
