"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
  courseBuilderStats,
  courseFlow,
  faq,
  lessonProps,
  lessonStepsPreview,
  lessonWords,
  roleCards,
  studentScreenItems,
  workflowSteps,
} from "@/components/landing/content";

function AccessLink({
  locked,
  href,
  className,
  children,
}: {
  locked: boolean;
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  if (locked) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Доступ временно закрыт"
        className={`${className} nav-pill-unavailable`}
      >
        {children}
      </button>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

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

export function LandingPage({
  landingOnly = false,
}: {
  landingOnly?: boolean;
}) {
  const { state, sessionResolved } = useSessionView();
  const authCtaHref = resolveLandingAuthCtaHref(state);
  const marketingActiveId = useMarketingNavActive(
    PRIMARY_NAV_CONFIG.marketing.items.map((item) => item.href),
  );
  const navActions = (() => {
    if (landingOnly) {
      return (
        <>
          <AccessLink
            locked
            href={ROUTES.login}
            className="nav-pill nav-pill-inactive header-action-btn flex-1 sm:flex-none"
          >
            Войти
          </AccessLink>
          <AccessLink
            locked
            href={ROUTES.join}
            className="nav-pill nav-pill-accent header-action-btn flex-1 sm:flex-none"
          >
            Создать аккаунт
          </AccessLink>
        </>
      );
    }

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

        return <SessionNavActions state={state} variant="landing" />;
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
    <main className="landing-main landing-main-marketing pb-16">
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
          <div className="hero-copy">
            <p className="landing-chip bg-lime-100/90 text-sm">
              Конструктор курсов и уроков для преподавателя
            </p>
            <h1 className="mt-5 max-w-[16ch] text-4xl font-black leading-[1.02] tracking-[-0.03em] md:max-w-none md:text-7xl">
              Соберите курс, урок за уроком
            </h1>
            <p className="mt-5 max-w-[68ch] text-base leading-relaxed text-neutral-700 md:text-lg">
              Shidao хранит курс, уроки, материалы и компоненты в едином рабочем
              пространстве. Преподаватель собирает План урока, выбирает
              содержимое Экрана ученика и готовит Домашнее задание.
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <AccessLink
                locked={landingOnly}
                href={ROUTES.join}
                className="landing-btn landing-btn-primary min-h-12 w-full sm:w-auto"
              >
                Создать аккаунт
              </AccessLink>
              <AccessLink
                locked={landingOnly}
                href={authCtaHref}
                className="landing-btn landing-btn-muted min-h-12 w-full sm:w-auto"
              >
                У меня уже есть доступ
              </AccessLink>
            </div>
          </div>

          <article
            className="hero-product-shot"
            aria-label="Пример экранов продукта"
          >
            <Image
              src="/landing/screen_8.png"
              alt="Скриншоты интерфейса Shidao"
              width={1491}
              height={1491}
              className="hero-product-shot-image"
              priority
            />
          </article>
        </div>
      </section>

      <section id="course" className="container mt-14 md:mt-16">
        <div className="px-5 md:px-8">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Один курс — единое рабочее пространство
          </h2>
          <p className="mt-4 max-w-[74ch] text-sm leading-relaxed text-neutral-700 md:text-base">
            В курсе находятся уроки, а внутри каждого урока — упорядоченные
            компоненты. Материалы доступны на уровне всего курса, а приватные
            заметки преподавателя не попадают на Экран ученика.
          </p>
          <ol className="course-flow mt-6" aria-label="Структура курса">
            {courseFlow.map((item, index) => (
              <li key={item.label} className="course-node-wrap">
                <article className={`course-node course-node-${item.tone}`}>
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </article>
                {index < courseFlow.length - 1 ? (
                  <ArrowRight
                    className="course-flow-arrow size-4"
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container mt-14 md:mt-16">
        <div className="px-5 md:px-8">
          <div className="course-intro">
            <div>
              <h2 className="text-3xl font-black tracking-tight md:text-5xl">
                Начните с пустого урока или черновика курса
              </h2>
              <p className="mt-4 max-w-[72ch] text-sm leading-relaxed text-neutral-700 md:text-base">
                Ручная сборка всегда доступна без ИИ и без расхода токенов.
                Заголовок урока обязателен, а текст, изображения, файлы, опросы
                и игры добавляются как компоненты в нужном порядке.
              </p>
            </div>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courseBuilderStats.map((item) => (
              <article
                key={item.label}
                className={`landing-card course-stat-card stat-${item.tone} p-5`}
              >
                <div className="flex items-center gap-2">
                  <item.icon className="size-4.5" />
                  <p className="text-lg font-black tracking-tight">
                    {item.label}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="lesson" className="container mt-14 md:mt-16">
        <div className="px-5 md:px-8">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Как выглядит один урок внутри продукта
          </h2>
          <p className="mt-4 max-w-[74ch] text-sm leading-relaxed text-neutral-700 md:text-base">
            Урок 1 «Животные на ферме» показывает, как Shidao разделяет полный
            преподавательский план и learner-facing Экран ученика.
          </p>

          <div className="mt-8 grid gap-4 xl:grid-cols-2">
            <article className="landing-surface rounded-[1.6rem] bg-white/90 p-5 md:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                План урока преподавателя
              </p>
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

              <h3 className="mt-6 text-lg font-bold">
                Компоненты урока (фрагмент)
              </h3>
              <ol className="mt-2 space-y-2 text-sm text-neutral-700">
                {lessonStepsPreview.map((component, idx) => (
                  <li key={component} className="rounded-xl bg-white px-3 py-2">
                    <span className="mr-2 text-xs font-bold text-neutral-500">
                      {idx + 1}.
                    </span>
                    {component}
                  </li>
                ))}
              </ol>
            </article>

            <article className="landing-surface rounded-[1.6rem] bg-gradient-to-b from-sky-50/80 to-white p-5 md:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-900/70">
                Экран ученика
              </p>
              <div className="student-screen-preview mt-4">
                <p className="text-sm font-semibold">
                  Урок 1 · Животные на ферме
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {lessonWords.slice(0, 4).map((word) => (
                    <WordChip key={`student-${word.hanzi}`} {...word} />
                  ))}
                </div>
                <p className="mt-3 text-sm text-neutral-700">
                  Задание: нажми карточку, которую назвал преподаватель.
                </p>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                {studentScreenItems.map((item) => (
                  <li
                    key={item}
                    className="rounded-xl border border-sky-200/70 bg-white/90 px-3 py-2"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section id="roles" className="container mt-14 md:mt-16">
        <div className="px-5 md:px-8">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Три роли — один учебный контур
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {roleCards.map(
              ({ title, icon: Icon, tone, description, points }) => (
                <article
                  key={title}
                  className={`landing-surface role-card role-${tone} rounded-[1.6rem] p-5`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="size-5" />
                    <h3 className="text-xl font-black">{title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-700">
                    {description}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                    {points.map((point) => (
                      <li key={point}>• {point}</li>
                    ))}
                  </ul>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section id="workflow" className="container mt-14 md:mt-16">
        <div className="px-5 md:px-8">
          <div className="workflow-shell">
            <div className="workflow-head">
              <p className="workflow-chip">Продуктовый сценарий</p>
              <h2 className="text-3xl font-black tracking-tight md:text-5xl">
                Как работает Shidao в реальном процессе
              </h2>
              <p className="workflow-subtitle">
                От создания курса до проверки Экрана ученика — изменения
                сохраняются в базе и переживают обновление страницы.
              </p>
            </div>
            <ol className="workflow-steps mt-8 md:mt-10">
              {workflowSteps.map((step, idx) => (
                <li key={step} className="workflow-step-card">
                  <span className="workflow-index">{idx + 1}</span>
                  <div className="workflow-step-body">
                    <p className="workflow-step-label">Шаг {idx + 1}</p>
                    <p>{step}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="container mt-14 md:mt-16">
        <div className="px-5 md:px-8">
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="landing-surface rounded-[1.6rem] bg-white/85 p-5">
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-500">
                До
              </p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                {beforeAfter.before.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </article>
            <article className="landing-surface rounded-[1.6rem] bg-lime-50/70 p-5">
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-700">
                После
              </p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-800">
                {beforeAfter.after.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section id="faq" className="container mt-14 md:mt-16">
        <div className="px-5 md:px-8">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Вопросы о продукте
          </h2>
          <div className="mt-7 space-y-3">
            {faq.map(({ q, a }) => (
              <details
                key={q}
                className="landing-surface rounded-2xl bg-white/90 p-4 md:p-5"
              >
                <summary className="cursor-pointer text-base font-semibold">
                  {q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-neutral-700">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="container mt-14 md:mt-16">
        <div className="px-5 md:px-8">
          <div className="landing-surface rounded-[2rem] bg-white/85 px-4 py-8 text-center md:px-10 md:py-10">
            <h2 className="mx-auto max-w-[20ch] text-3xl font-black tracking-tight md:max-w-none md:text-5xl">
              Соберите первый курс в одном рабочем пространстве
            </h2>
            <p className="mx-auto mt-4 max-w-[62ch] text-sm leading-relaxed text-neutral-700 md:text-base">
              Shidao собирает курс, урок, материалы, домашнюю работу и обратную
              связь в один рабочий контур.
            </p>
            <div className="mt-6 grid gap-3 sm:flex sm:justify-center">
              <AccessLink
                locked={landingOnly}
                href={ROUTES.join}
                className="landing-btn landing-btn-primary min-h-12 w-full sm:w-auto"
              >
                Создать аккаунт
              </AccessLink>
              <AccessLink
                locked={landingOnly}
                href={ROUTES.login}
                className="landing-btn landing-btn-muted min-h-12 w-full sm:w-auto"
              >
                Войти
              </AccessLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
