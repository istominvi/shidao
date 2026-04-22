"use client";

import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/lib/auth";
import { SessionNavActions } from "@/components/session-nav-actions";
import { useSessionView } from "@/components/use-session-view";
import {
  canRenderSessionNavActions,
  resolveLandingAuthCtaHref,
  resolveLandingNavAction,
} from "@/lib/navigation-contract";
import { PRIMARY_NAV_CONFIG } from "@/lib/navigation/primary-nav";
import { SiteHeader } from "@/components/site-header";
import { useMarketingNavActive } from "@/components/navigation/use-marketing-nav-active";
import {
  beforeAfter,
  faq,
  lessonProps,
  lessonStepsPreview,
  lessonWords,
  methodologyFlow,
  methodologyStats,
  roleCards,
  studentScreenItems,
  workflowSteps,
} from "@/components/landing/content";

function WordChip({
  hanzi,
  pinyin,
  translation,
}: {
  hanzi: string;
  pinyin: string;
  translation: string;
}) {
  return (
    <article className="word-chip" title={`${translation} (${pinyin})`}>
      <p className="word-chip-hanzi">{hanzi}</p>
      <p className="word-chip-meta">
        {pinyin} · {translation}
      </p>
    </article>
  );
}

export function LandingPage() {
  const { state, sessionResolved } = useSessionView();
  const authCtaHref = resolveLandingAuthCtaHref(state);
  const marketingActiveId = useMarketingNavActive(
    PRIMARY_NAV_CONFIG.marketing.items.map((item) => item.href),
  );
  const navActions = (() => {
    const action = resolveLandingNavAction(state, sessionResolved);

    switch (action) {
      case "guest-cta-pair":
        return (
          <>
            <Link
              href={ROUTES.login}
              className="nav-pill nav-pill-inactive header-action-btn flex-1 sm:flex-none"
            >
              Войти
            </Link>
            <Link
              href={ROUTES.join}
              className="nav-pill nav-pill-accent header-action-btn flex-1 sm:flex-none"
            >
              Создать аккаунт
            </Link>
          </>
        );
      case "session-actions":
        if (!canRenderSessionNavActions(state)) {
          return null;
        }

        return <SessionNavActions state={state} variant="landing" portalMenu />;
      case "skeleton":
        return (
          <div
            className="nav-pill nav-pill-inactive header-action-btn flex-1 sm:flex-none sm:min-w-[148px]"
            aria-hidden="true"
          >
            <span className="block h-4 w-24 animate-pulse rounded-full bg-neutral-300/70" />
          </div>
        );
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
  })();

  return (
    <main className="landing-main pb-16">
      <div className="landing-noise" aria-hidden="true" />
      <div className="fixed inset-x-0 top-0 z-[140]">
        <div className="container pt-4 md:pt-5">
          <SiteHeader
            variant="product"
            brandHref={ROUTES.home}
            navAriaLabel={PRIMARY_NAV_CONFIG.marketing.ariaLabel}
            navItems={PRIMARY_NAV_CONFIG.marketing.items.map((item) => ({
              id: item.id,
              label: item.label,
              href: item.href,
              active: marketingActiveId === item.id,
              scroll: true,
            }))}
            actions={
              <div className="flex w-full gap-2 sm:w-auto">{navActions}</div>
            }
            smoothAnchorScroll
            anchorOffset={112}
          />
        </div>
      </div>

      <div className="h-24 md:h-28" aria-hidden="true" />

      <section className="container mt-4 md:mt-6">
        <div className="landing-surface premium-hero-grid rounded-[2rem] bg-white/80 p-5 md:p-8">
          <div>
            <p className="landing-chip bg-lime-100/90 text-sm">
              Методико-ориентированная платформа для китайского
            </p>
            <h1 className="mt-5 max-w-[16ch] text-4xl font-black leading-[1.02] tracking-[-0.03em] md:max-w-none md:text-7xl">
              Китайский для детей — урок за уроком по готовой методике
            </h1>
            <p className="mt-5 max-w-[68ch] text-base leading-relaxed text-neutral-700 md:text-lg">
              Shidao превращает методику в рабочий цифровой контур, где преподаватель ведёт группу по Плану
              урока, ученик работает через Экран ученика, родитель видит домашнюю работу, комментарий и статус
              после каждого занятия.
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <Link
                href={ROUTES.join}
                className="landing-btn landing-btn-primary min-h-12 w-full sm:w-auto"
              >
                Создать аккаунт
              </Link>
              <Link
                href={authCtaHref}
                className="landing-btn landing-btn-muted min-h-12 w-full sm:w-auto"
              >
                У меня уже есть доступ
              </Link>
            </div>
          </div>

          <article className="hero-product-shot" aria-label="Пример экранов продукта">
            <Image
              src="/landing/screen_1.png"
              alt="Скриншоты интерфейса ShiDao"
              width={1491}
              height={1491}
              className="hero-product-shot-image"
              priority
            />
          </article>
        </div>
      </section>

      <section id="methodology" className="container mt-14 md:mt-16">
        <h2 className="text-3xl font-black tracking-tight md:text-5xl">
          В ShiDao методика — не папка с файлами, а сценарий работы
        </h2>
        <p className="mt-4 max-w-[74ch] text-sm leading-relaxed text-neutral-700 md:text-base">
          Методика задаёт курс, уроки, Материалы, Домашнее задание, teacher-side
          guidance и learner-facing Экран ученика. Runtime-слой добавляет
          расписание, конкретное занятие и коммуникацию в контексте урока — без
          ручной сборки процесса преподавателем.
        </p>
        <ol className="methodology-flow mt-6">
          {methodologyFlow.map((item) => (
            <li key={item} className="methodology-node">
              {item}
            </li>
          ))}
        </ol>
      </section>

      <section className="container mt-14 md:mt-16">
        <h2 className="text-3xl font-black tracking-tight md:text-5xl">
          «Мир вокруг меня» — первая методика в ShiDao
        </h2>
        <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-neutral-700 md:text-base">
          Курс построен вокруг героев Сяо Лон и Сяо Мей: они помогают ребёнку
          5–6 лет входить в китайский через песни, видео и игровые активности,
          сохраняя ритм урока и предсказуемый сценарий для преподавателя.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {methodologyStats.map((item) => (
            <article key={item} className="landing-card bg-white/90 p-5">
              <p className="text-lg font-black tracking-tight">{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="lesson" className="container mt-14 md:mt-16">
        <h2 className="text-3xl font-black tracking-tight md:text-5xl">
          Как выглядит один урок внутри продукта
        </h2>
        <p className="mt-4 max-w-[74ch] text-sm leading-relaxed text-neutral-700 md:text-base">
          Урок 1 «Животные на ферме» показывает, как ShiDao разделяет
          преподавательскую методическую опору и learner-facing Экран ученика,
          сохраняя единые шаги занятия.
        </p>

        <div className="mt-8 grid gap-4 xl:grid-cols-2">
          <article className="landing-surface rounded-[1.6rem] bg-white/90 p-5 md:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">План урока преподавателя</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {lessonWords.slice(0, 8).map((word) => (
                <WordChip key={`${word.hanzi}-${word.pinyin}`} {...word} />
              ))}
            </div>

            <h3 className="mt-6 text-lg font-bold">Реквизит и материалы</h3>
            <ul className="mt-2 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
              {lessonProps.map((item) => (
                <li key={item} className="rounded-xl bg-neutral-50 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>

            <h3 className="mt-6 text-lg font-bold">Шаги занятия (фрагмент)</h3>
            <ol className="mt-2 space-y-2 text-sm text-neutral-700">
              {lessonStepsPreview.map((step, idx) => (
                <li key={step} className="rounded-xl bg-white px-3 py-2">
                  <span className="mr-2 text-xs font-bold text-neutral-500">Шаг {idx + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </article>

          <article className="landing-surface rounded-[1.6rem] bg-gradient-to-b from-sky-50/80 to-white p-5 md:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-900/70">Экран ученика</p>
            <div className="student-screen-preview mt-4">
              <p className="text-sm font-semibold">Урок 1 · Шаг 3 «Карточки животных»</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {lessonWords.slice(0, 4).map((word) => (
                  <WordChip key={`student-${word.hanzi}`} {...word} />
                ))}
              </div>
              <p className="mt-3 text-sm text-neutral-700">Задание шага: нажми карточку, которую назвал преподаватель.</p>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-neutral-700">
              {studentScreenItems.map((item) => (
                <li key={item} className="rounded-xl border border-sky-200/70 bg-white/90 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section id="roles" className="container mt-14 md:mt-16">
        <h2 className="text-3xl font-black tracking-tight md:text-5xl">Три роли — один учебный контур</h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {roleCards.map(({ title, icon: Icon, tone, description, points }) => (
            <article key={title} className={`landing-surface role-card role-${tone} rounded-[1.6rem] p-5`}>
              <div className="flex items-center gap-2">
                <Icon className="size-5" />
                <h3 className="text-xl font-black">{title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700">{description}</p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                {points.map((point) => (
                  <li key={point}>• {point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="container mt-14 md:mt-16">
        <h2 className="text-3xl font-black tracking-tight md:text-5xl">Как работает ShiDao в реальном процессе</h2>
        <ol className="workflow-steps mt-7">
          {workflowSteps.map((step, idx) => (
            <li key={step} className="workflow-step-card">
              <span className="workflow-index">{idx + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container mt-14 md:mt-16">
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="landing-surface rounded-[1.6rem] bg-white/85 p-5">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-500">До</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700">
              {beforeAfter.before.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </article>
          <article className="landing-surface rounded-[1.6rem] bg-lime-50/70 p-5">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-700">После</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-800">
              {beforeAfter.after.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section id="faq" className="container mt-14 md:mt-16">
        <h2 className="text-3xl font-black tracking-tight md:text-5xl">Вопросы о продукте</h2>
        <div className="mt-7 space-y-3">
          {faq.map(({ q, a }) => (
            <details key={q} className="landing-surface rounded-2xl bg-white/90 p-4 md:p-5">
              <summary className="cursor-pointer text-base font-semibold">{q}</summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container mt-14 md:mt-16">
        <div className="landing-surface rounded-[2rem] bg-white/85 px-4 py-8 text-center md:px-10 md:py-10">
          <h2 className="mx-auto max-w-[20ch] text-3xl font-black tracking-tight md:max-w-none md:text-5xl">
            Запустите первую группу по методике, а не с пустой страницы
          </h2>
          <p className="mx-auto mt-4 max-w-[62ch] text-sm leading-relaxed text-neutral-700 md:text-base">
            ShiDao собирает курс, урок, материалы, домашнюю работу и обратную
            связь в один рабочий контур.
          </p>
          <div className="mt-6 grid gap-3 sm:flex sm:justify-center">
            <Link href={ROUTES.join} className="landing-btn landing-btn-primary min-h-12 w-full sm:w-auto">
              Создать аккаунт
            </Link>
            <Link href={ROUTES.login} className="landing-btn landing-btn-muted min-h-12 w-full sm:w-auto">
              Войти
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
