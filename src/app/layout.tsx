import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chimera Core",
  description: "Core host app for Chimera benchmarks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="app-shell-header">
            <div className="app-shell-inner">
              <p className="app-shell-brand">Chimera Core</p>
              <nav aria-label="Primary" className="app-shell-nav">
                <Link href="/">Home</Link>
                <Link href="/readiness">Readiness</Link>
                <Link href="/contract">Contract</Link>
                <Link href="/registry">Registry</Link>
                <Link href="/sync">Sync</Link>
                <Link href="/cache">Cache</Link>
              </nav>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

