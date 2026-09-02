import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { CommandSpine } from '../components/layout/CommandSpine';
import { FinancialStatusStrip } from '../components/layout/FinancialStatusStrip';

export const metadata: Metadata = {
  title: 'Personal AI CA — Private Financial Intelligence Instrument',
  description: 'An editorial, evidence-grounded private financial intelligence desk and accounting instrument.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="app-viewport">
            <CommandSpine />
            <div className="main-stage">
              <FinancialStatusStrip />
              <main className="content-canvas">
                {children}
              </main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
