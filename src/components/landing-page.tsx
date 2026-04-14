"use client";

import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/lib/auth";
import { SessionNavActions } from "@/components/session-nav-actions";
import { useSessionView } from "@/components/use-session-view";
import {
  canRenderSessionNavActions,
  resolveLandingAuthCtaHref,
  resolveLandingNavAction,
} from "@/lib/navigation-contract";
import { Check, ChevronRight, CircleHelp, NotebookText } from "lucide-react";
import { PRIMARY_NAV_CONFIG } from "@/lib/navigation/primary-nav";
import { SiteHeader } from "@/components/site-header";
import { useMarketingNavActive } from "@/components/navigation/use-marketing-nav-active";
import {
  comparisonAfter,
  comparisonBefore,
  faq,
  firstMethodStats,
  lessonComposition,
  methodFlowSteps,
  roleCards,
  valueStrip,
  workflowSteps,
} from "@/components/landing/content";
import { Reveal } from "@/components/landing/reveal";
import { SectionTitle } from "@/components/landing/section-title";

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
    <main className="pb-16">
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
        <div className="relative rounded-[1.8rem] border border-white/70 bg-white/80 p-4 shadow-[0_20px_80px_rgba(20,20,20,0.08)] backdrop-blur-xl md:rounded-[2.2rem] md:p-7">
          <div
            className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-fuchsia-200/40 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-sky-200/45 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative grid items-center gap-8 lg:grid-cols-[1.04fr_0.96fr]">
            <div>
              <p className="landing-chip bg-lime-200/90">
                Методика внутри платформы
              </p>
              <h1 className="mt-5 max-w-[15ch] text-[2rem] font-black leading-[1.02] tracking-[-0.03em] sm:text-[2.35rem] md:mt-6 md:max-w-none md:text-7xl">
                Китайский по готовой методике — через группы, уроки и домашние
                задания
              </h1>
              <p className="mt-4 max-w-[60ch] text-[0.97rem] leading-relaxed text-neutral-700 md:mt-6 md:text-lg">
                Shidao собирает обучение вокруг методики: преподаватель ведёт
                группы и уроки, назначает задания и оставляет комментарии по
                занятию, а родитель и ученик видят всё в своём контексте.
              </p>
              <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
                <Link
                  href={ROUTES.join}
                  className="landing-btn landing-btn-primary min-h-12 w-full gap-2 sm:w-auto"
                >
                  Создать аккаунт <ChevronRight className="size-4" />
                </Link>
                <Link
                  href={authCtaHref}
                  className="landing-btn landing-btn-muted min-h-12 w-full sm:w-auto"
                >
                  У меня уже есть доступ
                </Link>
              </div>
              <p className="mt-3 text-sm text-neutral-600">
                Для частного преподавателя и для школы. Один продукт — разные
                контуры работы.
              </p>
            </div>

            <Reveal>
              <article className="hero-mockup relative rounded-[1.8rem] border border-black/10 bg-[linear-gradient(145deg,rgba(242,249,255,0.95),rgba(255,255,255,0.95),rgba(255,241,250,0.95))] p-4 shadow-[0_30px_80px_rgba(17,24,39,0.18)] md:p-6">
                <div className="hero-illustration-layer" aria-hidden="true">
                  <Image
                    src="/landing/hero-method-workspace.webp"
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    className="object-contain object-right-bottom"
                  />
                </div>
                <span className="landing-chip floating-chip absolute -left-3 top-5 hidden bg-sky-100/95 text-sm md:inline-flex">
                  Группа по методике
                </span>
                <span className="landing-chip floating-chip absolute -right-4 top-9 hidden bg-fuchsia-100/95 text-sm md:inline-flex">
                  Отдельный вход ученика
                </span>
                <span className="landing-chip floating-chip absolute -left-4 bottom-8 hidden bg-lime-100/95 text-sm md:inline-flex">
                  Видно родителю
                </span>
                <span className="landing-chip floating-chip absolute right-6 bottom-3 hidden bg-white/95 text-sm md:inline-flex">
                  Урок в расписании
                </span>
                <div className="grid gap-3.5">
                  <div className="landing-card border-sky-200/80 bg-sky-100/85 p-4 md:p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-900/70">
                        Методика
                      </p>
                      <span className="landing-chip bg-white/90 px-2 py-1 text-[0.65rem]">
                        активна
                      </span>
                    </div>
                    <p className="mt-2 text-base font-black text-neutral-900">
                      «Мир вокруг меня»
                    </p>
                    <p className="mt-1 text-sm text-neutral-700">
                      Годовой курс • 5–6 лет
                    </p>
                    <p className="mt-3 border-t border-sky-300/60 pt-2 text-xs text-neutral-700">
                      21 песня • 21 видео • 45 минут урок
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="landing-card bg-white/92 md:-rotate-1">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                        Ближайший урок
                      </p>
                      <p className="mt-2 text-sm font-semibold">
                        «Животные на ферме»
                      </p>
                      <p className="mt-1 text-sm text-neutral-700">
                        Четверг • 17:00
                      </p>
                      <p className="mt-1 text-xs text-neutral-600">
                        Группа: 6 учеников
                      </p>
                    </div>
                    <div className="landing-card bg-fuchsia-100/75 md:translate-y-3">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                        После занятия
                      </p>
                      <p className="mt-2 text-sm font-semibold">
                        Домашнее задание назначено
                      </p>
                      <p className="mt-1 text-sm text-neutral-700">
                        Комментарий преподавателя оставлен
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="container mt-5 md:mt-6">
        <div className="flex flex-wrap gap-2 rounded-[1.8rem] border border-black/5 bg-white/60 p-4 backdrop-blur-xl">
          {valueStrip.map((item, idx) => (
            <span
              key={item}
              className={`landing-chip text-sm transition hover:-translate-y-0.5 ${
                idx % 4 === 0
                  ? "bg-sky-100/85"
                  : idx % 4 === 1
                    ? "bg-lime-100/85"
                    : idx % 4 === 2
                      ? "bg-fuchsia-100/80"
                      : "bg-violet-100/80"
              }`}
            >
              {idx < 3 ? <NotebookText className="size-3.5" /> : null}
              {item}
            </span>
          ))}
        </div>
      </section>

      <section id="why" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Почему Shidao"
          title="Не собирать обучение вручную, а вести его по готовой логике"
          description="Обычно преподавателю приходится держать методику в одном месте, расписание — в другом, задания — в третьем, а переписку — в чатах. Shidao собирает всё вокруг урока: методику, группу, материалы, домашнее задание и коммуникацию по занятию."
        />
        <p className="mt-6 text-sm font-semibold text-neutral-800 md:text-base">
          Не PDF + чат + заметки, а единый учебный контур.
        </p>
        <div className="why-connector mt-8 grid gap-4 md:grid-cols-2">
          <article className="landing-surface pattern-chaos rounded-[1.6rem] border border-black/10 bg-white/75 p-5">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-500">
              До Shidao
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-neutral-700">
              {comparisonBefore.map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-neutral-400" />
                  {point}
                </li>
              ))}
            </ul>
          </article>
          <article className="landing-surface pattern-structured rounded-[1.6rem] border border-black/10 bg-gradient-to-br from-lime-100/80 to-sky-100/60 p-5">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-700">
              В Shidao
            </p>
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

      <section id="method-core" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Методика как основа"
          title="В Shidao методика — не приложение к курсу, а его рабочая структура"
          description="Методика в Shidao — это не просто набор файлов. Она задаёт ход обучения: какие уроки идут по порядку, какие материалы использует преподаватель, какое домашнее задание назначается и в каком контексте идёт коммуникация по занятию."
        />
        <Reveal className="mt-8 rounded-[1.8rem] border border-black/10 bg-white/75 p-5 md:p-7">
          <div className="method-flow relative grid gap-3 md:grid-cols-6 md:gap-4">
            {methodFlowSteps.map(({ title, icon: Icon }, idx) => (
              <article
                key={title}
                className={`method-node rounded-2xl border border-black/10 p-3 text-sm font-semibold ${
                  idx === 0
                    ? "bg-sky-200/85 shadow-[0_14px_26px_rgba(14,116,144,0.15)]"
                    : idx % 2 === 0
                      ? "bg-fuchsia-100/70"
                      : "bg-lime-100/75"
                }`}
              >
                {idx === 0 ? (
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-800">
                    Старт
                  </p>
                ) : null}
                <div className="mt-1 flex items-center gap-2">
                  <Icon className="size-4" />
                  <span>{title}</span>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-4 text-sm font-medium text-neutral-700">
            Пример: Урок 1 → материалы → задание группе → комментарий
            преподавателя → ответ ученика.
          </p>
          <p className="mt-5 text-sm leading-relaxed text-neutral-700 md:text-base">
            Преподаватель не собирает курс вручную. Он ведёт группу по уже
            заданной логике и видит весь учебный контекст в одном месте.
          </p>
        </Reveal>
      </section>

      <section id="method" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Первая методика в Shidao"
          title="«Мир вокруг меня» — готовый годовой курс китайского для детей 5–6 лет"
          description="Первая методика в платформе рассчитана на учебный год и помогает преподавателю вести детскую группу последовательно: от темы к теме, от урока к уроку, с готовыми песнями, видео, активностями и подробными сценариями работы."
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {firstMethodStats.map((item, idx) => (
            <article
              key={item}
              className={`landing-surface rounded-3xl border border-black/10 p-5 ${idx % 3 === 0 ? "bg-sky-100/75" : idx % 3 === 1 ? "bg-white/85" : "bg-fuchsia-100/65"}`}
            >
              <p className="text-lg font-black tracking-tight">{item}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 max-w-[74ch] text-sm leading-relaxed text-neutral-700 md:text-base">
          Каждый урок в методике — это не абстрактная тема, а конкретный план
          работы преподавателя: слова и фразы, карточки, реквизит, материалы,
          игровые активности, движение, повторение и чёткий сценарий занятия.
        </p>

        <Reveal className="mt-6 rounded-[1.5rem] border border-black/10 bg-white/80 p-4 md:p-5">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-600">
            Ритм одного занятия
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-[0.9fr_1.1fr] md:items-start">
            <div className="lesson-rhythm-visual relative min-h-44 overflow-hidden rounded-2xl border border-black/10 bg-white/70">
              <Image
                src="/landing/lesson-rhythm.webp"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
                className="object-contain object-center p-3"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {lessonComposition.map(({ title, subtitle, icon: Icon }, idx) => (
                <article
                  key={title}
                  className={`rounded-2xl border border-black/10 p-3 text-sm ${idx % 2 === 0 ? "bg-sky-50/60" : "bg-white"}`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <Icon className="size-4 text-neutral-700" />
                    {title}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                    {subtitle}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-6 rounded-[1.5rem] border border-black/10 bg-white/80 p-4 md:p-5">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-neutral-600">
            Что получает преподаватель внутри методики
          </p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {[
              "готовый план урока",
              "слова и фразы по занятию",
              "карточки, реквизит и материалы",
              "игровые активности и сценарий работы",
            ].map((item, idx) => (
              <div
                key={item}
                className={`rounded-2xl border border-black/10 p-3 text-sm font-medium ${
                  idx === 0
                    ? "bg-sky-50/75"
                    : idx === 1
                      ? "bg-lime-50/80"
                      : idx === 2
                        ? "bg-fuchsia-50/80"
                        : "bg-violet-50/75"
                }`}
              >
                <span className="mb-2 block h-0.5 w-10 rounded-full bg-black/15" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 max-w-[74ch] text-sm leading-relaxed text-neutral-700 md:text-base">
          Урок начинается и заканчивается песней, а преподаватель работает не по
          памяти и не по заметкам, а по готовой структуре.
        </p>
      </section>

      <section id="workflow" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Как это работает"
          title="Преподаватель начинает не с пустой формы, а с понятного учебного контура"
          description="Shidao помогает выстроить обучение вокруг методики, группы и урока. Сначала преподаватель выбирает методику, затем запускает группу, добавляет учеников и уже после этого планирует занятия и выдаёт задания."
        />
        <Reveal className="workflow-rail mt-8 grid gap-3 md:grid-cols-5">
          {workflowSteps.map(({ title, description }, idx) => (
            <li
              key={title}
              className={`workflow-step list-none rounded-3xl border border-black/10 p-5 ${
                idx === 0 || idx === 3
                  ? "bg-sky-200/85 shadow-[0_18px_30px_rgba(56,189,248,0.2)]"
                  : idx % 3 === 1
                    ? "bg-white/85"
                    : "bg-violet-100/75"
              }`}
            >
              <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-neutral-600">
                <span className="inline-flex size-6 items-center justify-center rounded-full border border-black/15 bg-white/80 text-[11px]">
                  {idx + 1}
                </span>
                ШАГ
              </p>
              <p className="mt-3 text-base font-bold">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                {description}
              </p>
            </li>
          ))}
        </Reveal>
      </section>

      <section id="roles" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Для кого платформа"
          title="У каждого участника — свой контекст, но учебный процесс один"
          description="Shidao разделяет роли так, чтобы каждый видел только то, что нужно ему в реальной работе или обучении."
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {roleCards.map(({ title, icon: Icon, tone, description, points }) => (
            <article
              key={title}
              className={`landing-surface rounded-[1.6rem] border border-black/10 p-5 role-card role-${tone}`}
            >
              <p className="landing-chip bg-white/75 text-[0.68rem] uppercase">
                {tone === "teacher"
                  ? "Роль: преподаватель"
                  : tone === "parent"
                    ? "Роль: родитель"
                    : "Роль: ученик"}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Icon className="size-5" />
                <h3 className="text-xl font-black">{title}</h3>
              </div>
              <div className="my-3 h-px w-full bg-black/10" />
              <p className="text-sm leading-relaxed text-neutral-700">
                {description}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-neutral-700">
                {points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Два режима работы"
          title="Shidao подходит и частному преподавателю, и команде школы"
          description="Платформа поддерживает личный контур преподавателя и контур организации. Это позволяет работать самостоятельно или в составе школы, не смешивая доступы и данные."
        />
        <p className="mt-6 text-sm font-medium text-neutral-700 md:text-base">
          Личный и организационный контур разделены: преподаватель работает там,
          где были созданы группы, уроки и данные.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="mode-card mode-private rounded-[1.6rem] border border-black/10 bg-white/90 p-5 shadow-[0_18px_36px_rgba(20,20,20,0.08)]">
            <p className="landing-chip bg-sky-100/85 text-xs">Личный контур</p>
            <h3 className="mt-3 text-xl font-black">Частный преподаватель</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-700">
              Можно вести группы самостоятельно, без лишней административной
              сложности, сохраняя весь учебный процесс в одном месте.
            </p>
          </article>
          <article className="mode-card mode-school rounded-[1.6rem] border border-black/10 bg-gradient-to-br from-fuchsia-100/50 to-white p-5 shadow-[0_18px_36px_rgba(20,20,20,0.08)]">
            <p className="landing-chip bg-fuchsia-100/85 text-xs">
              Организационный контур
            </p>
            <h3 className="mt-3 text-xl font-black">Школа / организация</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-700">
              Можно работать в организационном контуре: приглашать
              преподавателей, разделять доступы и вести обучение в рамках общей
              структуры.
            </p>
          </article>
        </div>
        <p className="mt-4 text-sm text-neutral-700 md:text-base">
          Один и тот же продукт остаётся понятным в обоих сценариях: личном и
          организационном.
        </p>
      </section>

      <section id="faq" className="container mt-14 md:mt-16">
        <SectionTitle
          eyebrow="Частые вопросы"
          title="Коротко о самом важном"
          description="Ответы на вопросы, которые помогают быстро понять логику Shidao."
        />
        <div className="mt-8 space-y-3 rounded-[1.4rem] border border-black/5 bg-white/45 p-2 md:space-y-4 md:p-3">
          {faq.map(({ q, a }) => (
            <details
              key={q}
              className="group landing-surface rounded-[1.2rem] border border-black/10 bg-white/80 p-4 transition hover:bg-white open:bg-white md:rounded-3xl md:p-6"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[0.98rem] font-semibold leading-snug md:text-base">
                <span>{q}</span>
                <CircleHelp className="size-4 shrink-0 text-neutral-500 transition duration-300 group-open:rotate-12 group-hover:-translate-y-0.5" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700 md:mt-3.5">
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="container mt-14 md:mt-16">
        <div className="cta-finale relative overflow-hidden rounded-[1.6rem] border border-black/10 bg-[linear-gradient(150deg,rgba(240,247,255,0.92),rgba(255,255,255,0.92),rgba(255,241,250,0.92))] px-4 py-8 text-center shadow-[0_24px_70px_rgba(20,20,20,0.16)] sm:px-6 md:rounded-[2rem] md:px-12 md:py-10">
          <span className="landing-chip absolute left-8 top-6 hidden bg-white/85 text-xs md:inline-flex">
            Методика
          </span>
          <span className="landing-chip absolute right-8 top-8 hidden bg-sky-100/85 text-xs md:inline-flex">
            Группа
          </span>
          <span className="landing-chip absolute bottom-6 left-10 hidden bg-lime-100/85 text-xs md:inline-flex">
            Урок
          </span>
          <span className="landing-chip absolute bottom-8 right-10 hidden bg-fuchsia-100/85 text-xs md:inline-flex">
            Домашнее задание
          </span>
          <p className="landing-chip mx-auto bg-lime-100/85">
            Запустить обучение в единой рабочей среде
          </p>
          <h2 className="mx-auto mt-5 max-w-[22ch] text-2xl font-black leading-tight md:mt-6 md:max-w-none md:text-5xl">
            Запустите первую группу по готовой методике в Shidao
          </h2>
          <p className="mx-auto mt-3 max-w-[56ch] text-sm leading-relaxed text-neutral-700 md:text-base">
            От группы и расписания до задания и комментариев по уроку — Shidao
            собирает учебный процесс в одном рабочем контуре.
          </p>
          <div className="mt-6 grid gap-3 sm:flex sm:justify-center">
            <Link
              href={ROUTES.join}
              className="landing-btn min-h-12 w-full bg-lime-200 !text-black hover:bg-lime-300 sm:w-auto"
            >
              Создать аккаунт
            </Link>
            <Link
              href={authCtaHref}
              className="landing-btn min-h-12 w-full border border-black/20 bg-white/80 text-neutral-900 hover:bg-white sm:w-auto"
            >
              Войти
            </Link>
          </div>
          <p className="mt-3 text-sm text-neutral-600">
            Для частного преподавателя и для школы. Начать можно с первой
            готовой методики.
          </p>
        </div>
      </section>
    </main>
  );
}
