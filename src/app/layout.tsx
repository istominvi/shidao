import type { Metadata } from 'next';
import { Noto_Sans, Noto_Sans_SC, Noto_Serif, Noto_Serif_SC } from 'next/font/google';
import { SessionViewProvider } from '@/components/session-view-provider';
import { readSessionViewServer } from '@/lib/server/session-view';
import './globals.css';

const notoSans = Noto_Sans({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-noto-sans'
});

const notoSansCjk = Noto_Sans_SC({
  subsets: ['latin'],
  variable: '--font-noto-sans-cjk'
});

const notoSerif = Noto_Serif({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-noto-serif'
});

const notoSerifCjk = Noto_Serif_SC({
  subsets: ['latin'],
  variable: '--font-noto-serif-cjk'
});

export const metadata: Metadata = {
  title: 'Shidao — обучение китайскому языку',
  description: 'Платформа для преподавателей, родителей и учеников.'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialSessionView = await readSessionViewServer();

  return (
    <html lang="ru">
      <body
        className={`${notoSans.variable} ${notoSansCjk.variable} ${notoSerif.variable} ${notoSerifCjk.variable}`}
      >
        <SessionViewProvider initialState={initialSessionView}>{children}</SessionViewProvider>
      </body>
    </html>
  );
}
