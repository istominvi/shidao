import Link from "next/link";
import Image from "next/image";
import { Check, ChevronRight } from "lucide-react";
import { ROUTES } from "@/lib/auth";
import {
  comparisonAfter,
  comparisonBefore,
  faq,
  firstMethodStats,
  roleCards,
  valueStrip,
  workflowSteps,
} from "@/components/landing/content";
import { SectionTitle } from "@/components/landing/section-title";
import { Reveal } from "@/components/landing/reveal";

export function LandingHero({ authCtaHref }: { authCtaHref: string }) {
  return (
    <section className="container mt-6">
      <div className="rounded-3xl border border-neutral-200 bg-white p-5 md:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1.04fr_0.96fr]">
          <div>
            <p className="landing-chip bg-neutral-100">Методика внутри платформы</p>
            <h1 className="mt-5 max-w-[16ch] text-4xl font-black leading-tight tracking-tight md:max-w-none md:text-6xl">
              Китайский по готовой методике — через группы, уроки и домашние задания
            </h1>
            <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-neutral-700">
              Shidao собирает обучение вокруг методики: преподаватель ведёт группы и уроки,
              назначает задания и оставляет комментарии по занятию, а родитель и ученик
              видят всё в своём контексте.
            </p>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <Link href={ROUTES.join} className="landing-btn landing-btn-primary min-h-12 w-full gap-2 sm:w-auto">
                Создать аккаунт <ChevronRight className="size-4" />
              </Link>
              <Link href={authCtaHref} className="landing-btn landing-btn-muted min-h-12 w-full sm:w-auto">
                У меня уже есть доступ
              </Link>
            </div>
          </div>

          <article className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 md:p-6">
            <div className="relative min-h-64 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              <Image
                src="/landing/hero-method-workspace.webp"
                alt="Рабочий экран платформы"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-contain object-right-bottom p-2"
              />
            </div>
            <ul className="mt-4 grid gap-2 text-sm text-neutral-700">
              {valueStrip.slice(0, 4).map((item) => (
                <li key={item} className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}

export function WhySection() {
  return (
    <section id="why" className="container mt-14">
      <SectionTitle
        eyebrow="Почему Shidao"
        title="Единый учебный контур вместо разрозненных инструментов"
        description="Shidao собирает всё вокруг урока: методику, группу, материалы, домашнее задание и коммуникацию по занятию."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-neutral-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">До Shidao</p>
          <ul className="mt-4 space-y-2.5 text-sm text-neutral-700">
            {comparisonBefore.map((point) => (
              <li key={point} className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-neutral-400" />
                {point}
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-700">В Shidao</p>
          <ul className="mt-4 space-y-2.5 text-sm text-neutral-800">
            {comparisonAfter.map((point) => (
              <li key={point} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                {point}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

export function MethodSection() {
  return (
    <section id="method-core" className="container mt-14">
      <SectionTitle
        eyebrow="Методика как основа"
        title="Методика задаёт рабочую структуру, а не просто хранится файлами"
        description="Преподаватель работает по понятной последовательности: урок, задание, комментарий, ответ ученика."
      />
      <Reveal className="mt-8 rounded-3xl border border-neutral-200 bg-white p-5 md:p-7">
        <div className="grid gap-3 md:grid-cols-3">
          {firstMethodStats.slice(0, 6).map((item) => (
            <article key={item} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-lg font-bold tracking-tight text-neutral-900">{item}</p>
            </article>
          ))}
        </div>
      </Reveal>
      <div id="method" className="mt-4 rounded-3xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700 md:p-6">
        «Мир вокруг меня» — первая методика в платформе: годовой курс китайского для детей
        5–6 лет с готовым сценарием уроков и учебных активностей.
      </div>
    </section>
  );
}

export function WorkflowSection() {
  return (
    <section id="workflow" className="container mt-14">
      <SectionTitle
        eyebrow="Как работает"
        title="Простой рабочий цикл без лишних переходов"
        description="От методики к группе, от урока к домашнему заданию и коммуникации — в одной системе."
      />
      <ol className="mt-8 grid gap-3 md:grid-cols-2">
        {workflowSteps.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Шаг {index + 1}</p>
            <p className="mt-1 font-semibold text-neutral-900">{step.title}</p>
            <p className="mt-2 text-sm text-neutral-700">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RolesAndFaqSection() {
  return (
    <>
      <section id="roles" className="container mt-14">
        <SectionTitle
          eyebrow="Для кого"
          title="Три кабинета с разными границами доступа"
          description="Преподаватель, родитель и ученик работают в собственном контексте без смешения ролей."
        />
        <div className="mt-8 grid gap-3 lg:grid-cols-3">
          {roleCards.map((card) => (
            <article key={card.title} className="rounded-3xl border border-neutral-200 bg-white p-5">
              <h3 className="text-lg font-bold text-neutral-900">{card.title}</h3>
              <p className="mt-2 text-sm text-neutral-700">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="container mt-14">
        <SectionTitle
          eyebrow="Вопросы"
          title="Коротко о ключевых сценариях"
          description="Ответы на вопросы о старте, ролях и рабочем контуре обучения."
        />
        <div className="mt-8 space-y-3">
          {faq.slice(0, 5).map((item) => (
            <article key={item.q} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <h3 className="font-semibold text-neutral-900">{item.q}</h3>
              <p className="mt-2 text-sm text-neutral-700">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container mt-14 pb-12">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 text-center md:p-8">
          <h2 className="text-2xl font-black tracking-tight md:text-4xl">Готовы начать работу в Shidao?</h2>
          <p className="mt-3 text-sm text-neutral-700 md:text-base">
            Подключите роль и начните вести обучение в структурированном рабочем контуре.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={ROUTES.join} className="landing-btn landing-btn-primary">Создать аккаунт</Link>
            <Link href={ROUTES.login} className="landing-btn landing-btn-muted">Войти</Link>
          </div>
        </div>
      </section>
    </>
  );
}
