import type { Metadata } from 'next';
import { SessionViewProvider } from '@/components/session-view-provider';
import { readSessionViewServer } from '@/lib/server/session-view';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shidao — обучение китайскому языку',
  description: 'Платформа для преподавателей, родителей и учеников.'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialSessionView = await readSessionViewServer();

  return (
    <html lang="ru">
      <body>
        <SessionViewProvider initialState={initialSessionView}>{children}</SessionViewProvider>
      </body>
    </html>
  );
}
