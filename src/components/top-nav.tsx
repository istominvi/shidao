import Link from 'next/link';

const navLinkStyle = 'rounded-full px-4 py-2 text-sm font-medium transition hover:bg-black/5';

export function TopNav() {
  return (
    <header className="container pt-6">
      <div className="glass flex items-center justify-between rounded-3xl px-5 py-4 shadow-sm">
        <Link href="/" className="text-xl font-black tracking-tight">
          ShiDao.ru
        </Link>
        <nav className="hidden gap-2 md:flex">
          <Link href="/" className={navLinkStyle}>
            Лэндинг
          </Link>
          <Link href="/auth" className={navLinkStyle}>
            Вход / Регистрация
          </Link>
          <Link href="/dashboard/teacher" className={navLinkStyle}>
            Кабинет преподавателя
          </Link>
          <Link href="/dashboard/parent" className={navLinkStyle}>
            Кабинет родителя
          </Link>
        </nav>
      </div>
    </header>
  );
}
