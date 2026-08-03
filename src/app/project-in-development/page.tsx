import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Проект в разработке",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function ProjectInDevelopmentPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f6ef] px-5 py-12">
      <section className="w-full max-w-2xl rounded-[2rem] border border-black/5 bg-white/90 p-7 text-center shadow-[0_24px_70px_rgba(20,20,20,0.09)] md:p-12">
        <p className="mx-auto inline-flex rounded-full bg-lime-100 px-4 py-2 text-sm font-bold text-neutral-700">
          ShiDao V2
        </p>
        <h1 className="mt-6 text-4xl font-black tracking-[-0.035em] text-neutral-950 md:text-6xl">
          Проект в разработке
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-600 md:text-lg">
          Мы полностью перестраиваем платформу. Эта страница и личные кабинеты
          временно недоступны.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-neutral-950 px-6 text-sm font-bold text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neutral-300"
        >
          Вернуться на главную
        </Link>
      </section>
    </main>
  );
}
