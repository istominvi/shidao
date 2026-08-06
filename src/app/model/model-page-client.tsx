"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Bot,
  ChevronRight,
  CircleUserRound,
  FileStack,
  GraduationCap,
  History,
  LockKeyhole,
  Menu,
  MessageSquareText,
  MousePointer2,
  Network,
  Play,
  Route,
  Sparkles,
  Target,
  WandSparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import { type ReactNode, useEffect, useLayoutEffect, useState } from "react";

const modelImagePlaceholders = {
  "/model/0_1_v2.png":
    "data:image/webp;base64,UklGRjYBAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSGkAAAARP6CgbRs2VCRnfxER4H/1DNzGtq0q+1n+PdYCDEkdUofYqYB/+x+0hIj+TwD/rJJ3m6GnX7KuVJCakywVEI7F+RAyEu1Dyemca0BtTkcfVovuYXy8p8ijUHhXkccAYFJmgeJt1uo3eBoAVlA4IKYAAADwAgCdASoQABAABABoJbACdDBICII0isxVsoDB4QEFAADNz8nzXzin3PTPYjTNp/nnAiX/WS0rXGKqrOfdeMofZ35AJSw8jg6xxAi8QVueghmfh7Ef11XORJyYhrBwMMB21/1HszYXbPPQqozt3+X66PiyUfVk0O811lsXVpog9cYAVn93/fU5bCLvAs9P5/5ydT/orgSnBtDlsg0BuB61lyUKluAA",
  "/model/1_1_v4.png":
    "data:image/webp;base64,UklGRiYBAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSGgAAAARP6CmkRQ4ej4+oKMiRETAP7xtuI1tW1X20/jer+n9twKclKEC6cCpAPoPrIWI/k8A/wcIBCSI+GwLOi12i+0kntweVUyj8xr5VDBNzrsi3i7sOYCansZNADiUG0jgHI8RYI9kPge+AlZQOCCYAAAAcAIAnQEqEAAQAAQAaCWwAI8A3g8iHCE1EV6jMAD+lwvQKOf9JnZ+7Iy4NL7/hR9lVHlJ+fue0vk1y/X+bB1ZL2XSHlEvvKfUKJv+J7w+1EdKKwdtPPR0XM8wj2W8R6iCnAJgfkMIANUEsBpgRioKGO71EgCFF6Zv11DBQEU8cJ81NTjLXTCQT9+sqc2yZ9Bdh4CpK1YgAAA=",
  "/model/02_1.png":
    "data:image/webp;base64,UklGRjYBAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSHQAAAARP6CgbSQUvxJmiIiARYkPhhvbtp1U4CHWGVqobLO0mdpsm7UH9Eb0PwCYG4BH9fdtvDyXfIfbrJRMuCWl1HPYOaX0JRuK8qUChmtz1BWG9C7JrMa0lC5WNbqlJIPJLaUr/J1SKvDkzKVrlH0Kqv/GwAvAA1ZQOCCcAAAAkAIAnQEqEAAQAAQAaCWwAnQ4jMeenm+3snPKVAAA4hSUATc3reXyzrKT75EY4cuO1OKkMxv6ZcQeZuV90CJCpncps942UxXhDV2o+rHInXc7QpH1/w/sfr8VYm6JUqa+bUTW5hOFj/DTZb991fLK8w1Hgp3Z9wAGebQJzvgpq6ed7eJnmxIKfn5hjR63TX88AMz5QgR46aEQRAAA",
  "/model/3_1_v1.png":
    "data:image/webp;base64,UklGRjABAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSG4AAAARP6CgbSM3dzj2vnsCHxEB/Ta+INzYtq00F60dWofWk157T+tJj935L2QMEf2fACzVBA2ABr/YScBDzgYmAhqlJf8C2pgkZTT3kZO1+1F6fB8m8Jxw0awHkipapSMpeQfvRQ6ids3172ED5AKWA1ZQOCCcAAAAEAMAnQEqEAAQAAQAaCWwAnR/A9jlvgMeMytqWyEG49AAAP6khM3nyqfWCV8T5bDQBZpIu9EmsvfM7GFPn8s9SngHw9hcrq2qqypnGE+TibnxAqHHzDSdoaNnVbRnuc+F8uyZ3pdBcS2RV7wzevv05pMpckp84vJbasKukJso6HupH9NZMklnnrLiqifFcz3Fs6kMTGZKGbXbAAAA",
  "/model/4_v3.png":
    "data:image/webp;base64,UklGRgYBAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSFsAAAARP6CmbSQ2eTC+t/X140dEQNf/aMAotq02n7Yndd0TARhIdZAoaA7g+x+qhIj+TwAkPHqlXg472gK05zKOBp314hof15xpRy1dojF4fj8KeTOQbGcW0A7kziEcAFZQOCCEAAAAkAIAnQEqEAAQAAQAaCWwAnRH/5dgi6SI1t+juIAA/uj8r5ayID1HvNXfPbbAu1bnMsStCBSV/8JdPM9hiCLEYswZAeNrOujmqG1RrhnCIV6ty9CPq9MXgGP/g05Tv99gWOwOkQ91Gw8J/P95rLLMfaAn4jZE/BHB/VDcDlKPGc2VEAAA",
  "/model/5_v2.png":
    "data:image/webp;base64,UklGRqQAAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSDEAAAARJ6AmAAHGKK6iVxk1IiLuNVDUtg00EEVQDcIIXPxR5TkAEf2fgD5UGTcD568ybh8KAFZQOCBMAAAAkAEAnQEqEAAQAAQAaCWVMAEygIsAAP7wlQ+WHt00lpLxJVS9m2iDeVMOL4UrxLsanPoRh9RduO/q6l+sGmb0KNfP2pAjUUXPELUAAA==",
  "/model/6_1.png":
    "data:image/webp;base64,UklGRiYBAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSGEAAAARP6CobSM2VCDrnjMiAu7q4cNtbdtKdL4UgDTguUPqkDoNyEwD03+kJUT0fwL4qyM/tOoNxo2hMgPxkoYewDkEUQlrCNNIfStwnvaaCYiC9NaGoJqf2hBwep0nLFgVhuCPAFZQOCCeAAAAsAIAnQEqEAAQAAQAaCWwAnQwSAiESxxIwhXZ9/iAAPsbLa3cmqFUA415gkv+V8j9b0elyei5i3Hmf/5/TorN3P1N7316Jo3JnfELkbzvVN+4SFkq5NWO8sgL7fGQ9vbdDgyGZKx+jf7BHr4HY6U31UMxGjcpeezFDW/OJ4uW7ExXRp+O1uah+5g00x+YY4691PU1hFrEYNHclqgAAAA=",
  "/model/7_1.png":
    "data:image/webp;base64,UklGRqIAAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSCAAAAARFyAQSBwS259mjYiIBQINCxNXCnW8qgIR/Y9BLPUzCFZQOCBcAAAAEAIAnQEqEAAQAAQAaCWMAA+OUG99HR0RFgD+82+/pPSPhkS5YOV1ATCzSwtgMd8THGiOcfD6HzQuXqoO7b3LOal7pX9/XUV2hho5sv3mK6Y0hsCeJZS09hDgAAA=",
} as const;

type ModelImageSource = keyof typeof modelImagePlaceholders;

function ProgressiveModelImage({
  src,
  alt,
  width,
  height,
  sizes,
  priority = false,
}: {
  src: ModelImageSource;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Image
      className={`model-progressive-image${loaded ? " is-loaded" : ""}`}
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      placeholder="blur"
      blurDataURL={modelImagePlaceholders[src]}
      onLoad={() => setLoaded(true)}
      style={{ objectFit: "contain", objectPosition: "right center" }}
    />
  );
}

const aiRoles = [
  {
    number: "01",
    title: "Автор",
    text: "Создаёт структуру курса, первые уроки, материалы и задания.",
    Icon: FileStack,
  },
  {
    number: "02",
    title: "Редактор",
    text: "Меняет существующий продукт по обычной человеческой просьбе.",
    Icon: MousePointer2,
  },
  {
    number: "03",
    title: "Помощник",
    text: "Подсказывает преподавателю следующий вопрос, материал или объяснение.",
    Icon: Sparkles,
  },
  {
    number: "04",
    title: "Преподаватель",
    text: "Ведёт экранный урок, проверяет ответы и меняет темп.",
    Icon: GraduationCap,
  },
  {
    number: "05",
    title: "Аналитик",
    text: "Фиксирует поведенческие паттерны ученика в его профиле",
    Icon: Network,
  },
];

const roadmap = [
  {
    stage: "01",
    tag: "Сейчас",
    title: "Инструмент преподавателя",
    text: "Конструктор курсов, Экран ученика, материалы, расписание, ДЗ и образовательный профиль.",
    Icon: FileStack,
  },
  {
    stage: "02",
    tag: "Подключения",
    title: "Внешняя экосистема",
    text: (
      <>
        <a
          className="model-mcp-link"
          href="https://ru.wikipedia.org/wiki/Model_Context_Protocol"
          rel="noopener noreferrer"
          target="_blank"
        >
          MCP
        </a>{" "}
        и API превращают Shidao в образовательный backend для ChatGPT, Claude,
        Gemini, DeepSeek, Grok и других агентов.
      </>
    ),
    Icon: Network,
  },
  {
    stage: "03",
    tag: "Следующий этап",
    title: "ИИ-преподаватель",
    text: "Занятия ведёт ИИ-преподаватель: объясняет материал, задаёт вопросы, проверяет ответы, меняет темп и сохраняет результаты в образовательный профиль.",
    Icon: Bot,
  },
  {
    stage: "04",
    tag: "Будущее",
    title: "B2C-обучение",
    text: "Человек приходит в Shidao с целью и получает готовый персональный образовательный путь, а не набор отдельных инструментов.",
    Icon: CircleUserRound,
  },
];

function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`model-wordmark ${className}`.trim()}>Shidao</span>;
}

function SectionIntro({
  index,
  eyebrow,
  title,
  text,
  detail,
  illustration,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  text: string;
  detail?: ReactNode;
  illustration?: { src: ModelImageSource; alt: string };
}) {
  return (
    <div
      className={`model-section-intro${illustration ? " model-section-intro-with-illustration" : ""}`}
    >
      <div className="model-section-heading">
        <p className="model-eyebrow">
          <span className="model-section-index">{index}</span> {eyebrow}
        </p>
        {illustration ? (
          <div className="model-section-illustration">
            <ProgressiveModelImage
              src={illustration.src}
              alt={illustration.alt}
              width={1254}
              height={1254}
              sizes="(max-width: 960px) 100vw, 50vw"
            />
          </div>
        ) : null}
        <div className="model-section-copy">
          <h2>{title}</h2>
          <p className="model-copy-lead">{text}</p>
        </div>
      </div>
      {detail ? <div className="model-section-detail">{detail}</div> : null}
    </div>
  );
}

export function ModelPageClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lessonMode, setLessonMode] = useState<"live" | "review">("live");
  const [scrollProgress, setScrollProgress] = useState(0);

  useLayoutEffect(() => {
    const isTelegramBrowser = "TelegramWebviewProxy" in window;
    document.documentElement.classList.toggle(
      "model-telegram-browser",
      isTelegramBrowser,
    );

    return () => {
      document.documentElement.classList.remove("model-telegram-browser");
    };
  }, []);

  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".model-page");
    const scrollContainer = document.documentElement.classList.contains(
      "model-telegram-browser",
    )
      ? page
      : null;

    const updateProgress = () => {
      const scrollTop = scrollContainer?.scrollTop ?? window.scrollY;
      const scrollable = scrollContainer
        ? scrollContainer.scrollHeight - scrollContainer.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(
        scrollable > 0 ? Math.min(100, (scrollTop / scrollable) * 100) : 0,
      );
    };

    updateProgress();
    const scrollTarget = scrollContainer ?? window;
    scrollTarget.addEventListener("scroll", updateProgress, { passive: true });
    return () => scrollTarget.removeEventListener("scroll", updateProgress);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="model-page">
      <div
        className="model-scroll-progress"
        style={{ width: `${scrollProgress}%` }}
        aria-hidden="true"
      />

      <header className="model-header">
        <a className="model-logo" href="#top" aria-label="Shidao, наверх">
          <Wordmark />
        </a>

        <nav
          className={`model-nav ${menuOpen ? "is-open" : ""}`}
          aria-label="Навигация по странице"
        >
          <a href="#model" onClick={closeMenu}>
            Модель
          </a>
          <a href="#ai" onClick={closeMenu}>
            ИИ
          </a>
          <a href="#profile" onClick={closeMenu}>
            Профиль
          </a>
          <a href="#scenarios" onClick={closeMenu}>
            Аккаунт
          </a>
          <a href="#experience" onClick={closeMenu}>
            Интерфейс
          </a>
          <a href="#strategy" onClick={closeMenu}>
            Стратегия
          </a>
        </nav>

        <a
          className="model-header-cta"
          href="https://demo.shidao.ru/?restored=1"
          target="_blank"
          rel="noopener noreferrer"
        >
          Демо <ArrowRight size={15} />
        </a>

        <button
          className="model-menu-button"
          type="button"
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      <section className="model-hero" id="top">
        <div className="model-hero-heading">
          <div className="model-hero-kicker">
            <span>Внутренняя продуктовая модель</span>
            <span>26 / 07 / 2026</span>
          </div>

          <div className="model-hero-illustration" aria-hidden="true">
            <ProgressiveModelImage
              src="/model/0_1_v2.png"
              alt=""
              width={1080}
              height={1080}
              sizes="(max-width: 960px) 100vw, 50vw"
              priority
            />
          </div>

          <div className="model-hero-copy">
            <h1>
              Shidao —{" "}
              <em className="model-hero-accent">образование будущего,</em>
              <br />
              где ИИ — ассистент,
              <br />
              аналитик и автор контента
            </h1>
            <p className="model-hero-lead model-copy-lead">
              Умная образовательная система, в которой человек может создать
              курс, учить другого, учиться сам и передать процесс AI, не теряя
              историю, структуру и контроль.
            </p>
          </div>

          <div className="model-hero-actions">
            <a className="model-button model-button-primary" href="#model">
              Понять модель <ArrowDown size={17} />
            </a>
          </div>
        </div>
      </section>

      <section className="model-section model-foundation" id="model">
        <SectionIntro
          index="01"
          eyebrow="Продуктовая модель"
          title={
            <>
              Shidao —{" "}
              <em className="model-section-title-accent">
                адаптивная
                <br />
                образовательная
                <br />
                экосистема с ИИ
              </em>
              ,
              <br />
              сопровождающая человека на протяжении всей жизни.
            </>
          }
          text="Три фундаментальных технологических и гуманитарных принципа, которые превращают процесс получения знаний в увлекательный жизненный путь:"
          illustration={{
            src: "/model/1_1_v4.png",
            alt: "Ребёнок с разноцветными обручами",
          }}
          detail={
            <div className="model-principles">
              <div className="model-principle">
                <div className="model-principle-number">1</div>
                <div className="model-principle-content">
                  <h3>Интеллектуальный слой: ИИ работает в контексте Shidao</h3>
                  <p className="model-copy-body">
                    Shidao не строится вокруг одной ИИ-модели. Система
                    предоставляет искусственному интеллекту образовательный
                    контекст, данные профиля и набор разрешённых инструментов,
                    благодаря которым он может выступать автором, аналитиком,
                    помощником или преподавателем. Для каждой задачи может
                    использоваться наиболее подходящая модель, при этом
                    структура обучения, история пользователя и управление
                    процессом остаются независимыми от конкретной технологии.
                  </p>
                </div>
              </div>
              <div className="model-principle">
                <div className="model-principle-number">2</div>
                <div className="model-principle-content">
                  <h3>Образовательная память: Учебный профиль как фундамент</h3>
                  <p className="model-copy-body">
                    Курсы могут заканчиваться, а преподаватели меняться, но ваш
                    опыт в Shidao остается с вами навсегда. Учебный профиль —
                    это «умное зеркало» учащегося, которое накапливает
                    аналитику, метрики и каждое действие пользователя.
                    Искусственный интеллект обрабатывает эти данные в реальном
                    времени, используя накопленную «память» для того, чтобы
                    делать каждый следующий урок точнее предыдущего.
                  </p>
                </div>
              </div>
              <div className="model-principle">
                <div className="model-principle-number">3</div>
                <div className="model-principle-content">
                  <h3>Единый путь: Один аккаунт на всю жизнь</h3>
                  <p className="model-copy-body">
                    Мы верим, что образование — это не этап, а неотъемлемая
                    часть жизни человека. В Shidao мы стерли границы между
                    ролями: теперь для нас нет разделения на учеников, учителей
                    и родителей. Наша система спроектирована так, чтобы вести
                    ребенка от первого слова до момента, когда он сам станет
                    экспертом, преподавателем или родителем, следящим за
                    успехами своих детей. Мы не просто предлагаем инструмент —
                    мы предлагаем систему, которая будет рядом от рождения до
                    глубокой старости, потому что в Shidao вы всегда остаетесь
                    исследователем, в какой бы роли ни находились сегодня.
                  </p>
                </div>
              </div>
            </div>
          }
        />
      </section>

      <section className="model-ai-section" id="ai">
        <div className="model-ai-section-inner">
          <SectionIntro
            index="02"
            eyebrow="Искусственный интеллект"
            title={
              <>
                ИИ <em className="model-section-title-white">— как основа</em>
                <br />
                <em className="model-section-title-accent">
                  адаптивного
                  <br />
                  образовательного
                  <br />
                  процесса
                </em>
              </>
            }
            text="Shidao не конкурирует с моделью. Система даёт любой подходящей модели контекст, инструменты и безопасное место в реальном образовательном процессе, чтобы ИИ мог исполнять следующие роли:"
            illustration={{
              src: "/model/02_1.png",
              alt: "Ребёнок взаимодействует с роботом через цифровой экран",
            }}
          />

          <div className="model-ai-roles">
            {aiRoles.map((role) => (
              <article key={role.number}>
                <span>{role.number}</span>
                <div className="model-ai-role-icon">
                  <role.Icon size={24} />
                </div>
                <h3>{role.title}</h3>
                <p className="model-copy-body">{role.text}</p>
              </article>
            ))}
          </div>

          <div className="model-ai-architecture">
            <h2 className="model-card-label model-card-label-dark">
              ЕДИНАЯ АРХИТЕКТУРА ИИ
            </h2>
            <div className="model-ai-architecture-story">
              <div className="model-ai-architecture-text">
                {[
                  {
                    Icon: Network,
                    text: "Shidao строится не вокруг одной конкретной ИИ-модели, а вокруг независимого слоя оркестрации. Образовательная логика, данные учебного профиля и продуктовые сценарии отделены от поставщика искусственного интеллекта. Благодаря этому система сможет выбирать модель в зависимости от задачи, требований к точности, скорости, стоимости и конфиденциальности. Например, более мощная модель может использоваться для проектирования курса и сложного анализа, а более быстрая и экономичная — для проверки ответов, классификации данных или подготовки коротких подсказок.",
                  },
                  {
                    Icon: Route,
                    text: "По мере развития технологий новые модели можно будет подключать, тестировать и заменять без перестройки всей платформы, остановки образовательного процесса или потери накопленной истории. При необходимости Shidao сможет перенаправить задачу на резервную модель, сравнить результаты нескольких моделей или постепенно перевести отдельный сценарий на более эффективное решение. При этом для пользователя ничего не меняется: курсы, занятия, учебный профиль и правила работы остаются едиными.",
                  },
                  {
                    Icon: WandSparkles,
                    text: "Связующим слоем между искусственным интеллектом и продуктом станет собственный MCP-сервер Shidao. Он предоставит моделям стандартный набор разрешённых инструментов: получить доступный пользователю контекст, найти курс или материал, создать или изменить урок, назначить домашнее задание, сохранить результат занятия или запросить аналитику. Модель не будет обращаться напрямую к базе данных и внутренним сервисам Shidao — все действия будут выполняться через стабильные и контролируемые интерфейсы.",
                  },
                  {
                    Icon: LockKeyhole,
                    text: "В этом контуре Shidao централизованно проверяет пользователя и его права, валидирует запросы, ограничивает доступные операции, запрашивает подтверждение для важных изменений и сохраняет историю действий. Поэтому разные модели работают с продуктом по одинаковым правилам, а их подключение, обновление или замена не требуют заново проектировать интеграцию. Такой подход также упрощает тестирование, мониторинг качества, управление расходами и безопасный откат изменений.",
                  },
                  {
                    Icon: Bot,
                    text: "MCP-сервер откроет Shidao и для внешних ИИ-приложений. Поддерживающие этот стандарт чаты и агенты смогут подключаться к платформе как к образовательному сервису: показывать человеку его прогресс, анализировать трудности, находить материалы, готовить занятия или продолжать обучение прямо в привычном интерфейсе. Это могут быть ChatGPT, Claude и другие MCP-совместимые клиенты, включая решения на базе моделей DeepSeek. Доступ будет предоставляться только после авторизации и в пределах разрешений конкретного пользователя.",
                  },
                ].map(({ Icon, text }) => (
                  <article key={text}>
                    <div className="model-ai-architecture-icon">
                      <Icon size={21} />
                    </div>
                    <p className="model-copy-body">{text}</p>
                  </article>
                ))}
              </div>

              <aside className="model-ai-architecture-principle">
                <div>
                  <History size={18} />
                  <span>ГЛАВНЫЙ АРХИТЕКТУРНЫЙ ПРИНЦИП</span>
                </div>
                <h3>Модели меняются. Образовательная память остаётся</h3>
                <p className="model-copy-body">
                  Shidao хранит у себя главное: образовательный профиль
                  человека, структуру курсов и уроков, права доступа, историю
                  обучения и правила работы. ИИ-модели подключаются к этой
                  системе как сменяемые исполнители — для каждой задачи можно
                  выбрать наиболее подходящую, заменить её или использовать
                  несколько моделей, не перестраивая продукт и не теряя
                  накопленные данные. Поэтому развитие искусственного интеллекта
                  усиливает Shidao, но не делает образовательный процесс
                  зависимым от одной технологии или компании.
                </p>
              </aside>
            </div>
          </div>

          <div className="model-loop-copy">
            <span className="model-card-label model-card-label-dark">
              ПРОДУКТОВЫЙ ЦИКЛ
            </span>
            <h2>ИИ превращает результаты занятия в следующий урок</h2>
            <p className="model-ai-topic-lead model-copy-body">
              Человек задаёт образовательную цель. Shidao превращает её в курс,
              уроки и отдельные занятия, а после каждого проведения сохраняет в
              образовательном профиле ответы, ошибки, темп, прогресс и
              наблюдения. ИИ анализирует эту историю и предлагает, что
              повторить, как изменить сложность и каким сделать следующий урок.
              Поэтому обучение не обрывается после занятия: каждый результат
              становится контекстом для следующего решения.
            </p>
          </div>
          <div
            className="model-loop"
            aria-label="Цикл персонализации обучения с ИИ в Shidao"
          >
            {[
              [
                "Цель",
                "Человек задаёт, чему нужно научиться и какие есть ограничения.",
                Target,
              ],
              [
                "Курс",
                "ИИ связывает цель с профилем и предлагает программу обучения.",
                Route,
              ],
              [
                "Урок",
                "ИИ готовит сценарий, материалы, задания и экран ученика.",
                BookOpen,
              ],
              [
                "Сессия",
                "Человек или ИИ проводит конкретное занятие по готовому уроку.",
                Play,
              ],
              [
                "Данные",
                "Ответы, ошибки, темп и наблюдения сохраняются в профиле.",
                Network,
              ],
              [
                "Адаптация",
                "ИИ предлагает, что повторить и как изменить следующий урок.",
                WandSparkles,
              ],
            ].map(([label, description, Icon], index) => (
              <div className="model-loop-item" key={String(label)}>
                <div>
                  <span>0{index + 1}</span>
                  <Icon size={23} />
                </div>
                <strong>{String(label)}</strong>
                <p className="model-copy-body">{String(description)}</p>
                {index < 5 && (
                  <ChevronRight className="model-loop-arrow" size={20} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="model-section model-profile" id="profile">
        <SectionIntro
          index="03"
          eyebrow="Образовательный профиль"
          title={
            <>
              Всё, что ученик изучил,
              <br />
              понял и преодолел,
              <br />
              <em className="model-section-title-accent">становится основой</em>
              <br />
              следующего урока
            </>
          }
          text="Курсы заканчиваются, преподаватели и технологии меняются, но образовательная история человека остаётся. Shidao сохраняет накопленный опыт и превращает его в основу дальнейшего обучения."
          illustration={{
            src: "/model/3_1_v1.png",
            alt: "Ученица рядом с визуализацией образовательного профиля",
          }}
          detail={
            <div className="model-profile-story">
              <div className="model-profile-overview">
                <div className="model-profile-points">
                  <article>
                    <div className="model-profile-point-icon">
                      <CircleUserRound size={29} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3>Обучение строится вокруг человека</h3>
                      <p className="model-copy-body">
                        В новой модели Shidao обучение организовано не вокруг
                        школы, каталога контента или отдельного курса, а вокруг
                        человека и его образовательной цели. Для каждого
                        учащегося ведётся единый учебный профиль: в нём
                        накапливаются проведённые занятия, ответы, ошибки,
                        освоенные знания, интересы, темп и подтверждённые
                        наблюдения о том, как человеку лучше учиться.
                      </p>
                    </div>
                  </article>

                  <article>
                    <div className="model-profile-point-icon">
                      <Route size={27} strokeWidth={1.6} />
                    </div>
                    <div>
                      <h3>Курс становится управляемым маршрутом</h3>
                      <p className="model-copy-body">
                        Курс объединяет последовательность уроков, аудиторию и
                        настройки, может быть создан вручную или вместе с AI и
                        назначен одному учащемуся либо группе. Когда курс
                        заканчивается, его результат не пропадает: важные данные
                        переходят в учебный профиль и становятся контекстом для
                        следующего решения.
                      </p>
                    </div>
                  </article>

                  <article>
                    <div className="model-profile-point-icon">
                      <MessageSquareText size={27} strokeWidth={1.6} />
                    </div>
                    <div>
                      <h3>
                        Наблюдения преподавателя становятся частью
                        образовательной памяти
                      </h3>
                      <p className="model-copy-body">
                        После урока или в любой момент обучения преподаватель
                        может отметить, как работал ученик, что давалось ему
                        легко, где возникли трудности, как прошло занятие и к
                        каким результатам привёл курс. ИИ связывает эти
                        комментарии с ответами, ошибками и прогрессом, выделяет
                        значимые наблюдения и превращает их в новые элементы
                        образовательного профиля — контекст, который помогает
                        точнее выстраивать следующие занятия.
                      </p>
                    </div>
                  </article>
                </div>

                <aside className="model-profile-difference">
                  <div>
                    <Sparkles size={18} />
                    <span>Главное отличие</span>
                  </div>
                  <p className="model-copy-body">
                    Не просто показать следующий урок, а понять, каким он должен
                    быть именно для этого человека. Обычная платформа помнит
                    прогресс внутри курса, а Shidao продолжает образовательный
                    путь между курсами, преподавателями и AI-моделями.
                  </p>
                </aside>
              </div>

              <div className="model-profile-signals">
                <article>
                  <span>01</span>
                  <History size={23} />
                  <h3>Помнит</h3>
                  <p className="model-copy-body">
                    Весь подтверждённый учебный опыт человека.
                  </p>
                </article>
                <article>
                  <span>02</span>
                  <Network size={23} />
                  <h3>Связывает</h3>
                  <p className="model-copy-body">
                    Цель, курс, уроки и полученные результаты.
                  </p>
                </article>
                <article>
                  <span>03</span>
                  <WandSparkles size={23} />
                  <h3>Адаптирует</h3>
                  <p className="model-copy-body">
                    Следующий шаг на основе накопленной истории.
                  </p>
                </article>
              </div>
            </div>
          }
        />
      </section>

      <section
        className="model-section model-scenarios model-scenarios-dark"
        id="scenarios"
      >
        <SectionIntro
          index="04"
          eyebrow="Аккаунт"
          title={
            <>
              Аккаунт принадлежит человеку,
              <br />
              <em className="model-section-title-accent">
                а не его текущей роли
              </em>
            </>
          }
          text="Человек может одновременно учиться, преподавать и отвечать за обучение ребёнка. Shidao не требует создавать для этого отдельные учётные записи: аккаунт остаётся один, а права и возможности возникают из реальных связей с курсами, группами и образовательными профилями."
          illustration={{
            src: "/model/4_v3.png",
            alt: "Один человек в разных образовательных контекстах",
          }}
        />

        <div className="model-account-story">
          <div className="model-account-points">
            <article>
              <div className="model-account-point-icon">
                <CircleUserRound size={28} strokeWidth={1.5} />
              </div>
              <div>
                <h3>Не нужно создавать несколько версий одного человека</h3>
                <p className="model-copy-body">
                  Во многих образовательных сервисах новая роль означает ещё
                  один кабинет, адрес электронной почты, номер телефона и
                  пароль. Не у каждого есть дополнительный номер, а заводить
                  отдельную почту себе или ребёнку только ради второго способа
                  использования платформы — искусственное и неудобное
                  требование. В Shidao человек использует одни учётные данные
                  независимо от того, учится он сам, проводит занятия или
                  помогает своему ребёнку. Взрослый может входить по электронной
                  почте или номеру телефона с паролем. Для ребёнка
                  образовательный профиль может существовать без полноценного
                  взрослого аккаунта: достаточно уникального логина и короткого
                  PIN-кода, которым управляет родитель или другой доверенный
                  взрослый. Позднее к этому профилю можно подключить собственный
                  аккаунт ребёнка, не теряя накопленную историю.
                </p>
              </div>
            </article>

            <article>
              <div className="model-account-point-icon">
                <Network size={27} strokeWidth={1.5} />
              </div>
              <div>
                <h3>Роль не выбирается — она возникает из действий и связей</h3>
                <p className="model-copy-body">
                  В Shidao нет глобального типа аккаунта «учитель», «родитель»
                  или «ученик». Если человек создаёт курс и проводит занятия,
                  ему доступны возможности преподавателя. Если он связан с
                  образовательным профилем ребёнка, он получает разрешённые
                  родительские действия. Если у него есть собственный
                  образовательный профиль, он может учиться сам. Эти возможности
                  могут существовать одновременно и дополнять друг друга.
                  Человеку не нужно регистрироваться заново или решать, какую
                  роль выбрать навсегда: меняются его задачи и связи внутри
                  системы, но сам аккаунт остаётся прежним.
                </p>
              </div>
            </article>

            <article>
              <div className="model-account-point-icon">
                <History size={27} strokeWidth={1.5} />
              </div>
              <div>
                <h3>Аккаунт подтверждает личность, профиль хранит обучение</h3>
                <p className="model-copy-body">
                  Аккаунт отвечает на вопрос: кто этот человек и какие действия
                  ему разрешены. Образовательный профиль отвечает на другой
                  вопрос: чему человек учился, какие занятия проходил, что уже
                  знает, где испытывает трудности и как развивается его
                  образовательный путь. Поэтому один аккаунт может быть
                  владельцем курсов, проводить занятия, управлять профилем
                  ребёнка и одновременно иметь собственный образовательный
                  профиль. Данные не дублируются между ролями, а учебная история
                  остаётся связанной с конкретным человеком и сохраняется
                  независимо от того, как со временем меняется его участие в
                  образовании.
                </p>
              </div>
            </article>
          </div>

          <aside className="model-account-case">
            <div className="model-account-case-label">
              <CircleUserRound size={18} />
              <span>ОДИН АККАУНТ — ТРИ КОНТЕКСТА</span>
            </div>
            <p className="model-copy-body">
              Агата — преподаватель английского, мама девятилетней Лизы и
              ученица на курсе китайского языка. Для этого ей не нужны три
              аккаунта.
            </p>

            <div className="model-account-contexts">
              <div>
                <span>Учитель · English B1</span>
                <p className="model-copy-body">
                  Проводит занятие для группы подростков: открывает план,
                  управляет Экраном ученика и получает подсказки ИИ.
                </p>
              </div>
              <div>
                <span>Родитель · профиль Лизы</span>
                <p className="model-copy-body">
                  Выбирает курс по математике, видит расписание, домашние
                  задания, результаты и подтверждённые выводы.
                </p>
              </div>
              <div>
                <span>Ученик · китайский язык</span>
                <p className="model-copy-body">
                  Учится с ИИ-преподавателем в своём темпе, а ответы, ошибки и
                  прогресс пополняют её собственный профиль.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="model-section model-experience" id="experience">
        <SectionIntro
          index="05"
          eyebrow="UI / UX"
          title={
            <>
              Один интерфейс,
              <br />
              который{" "}
              <em className="model-section-title-accent">
                растёт
                <br />
                вместе с человеком
                <br />
              </em>
              и его образовательными
              <br />
              задачами
            </>
          }
          text="Shidao показывает только то, что нужно человеку сейчас. Простая навигация остаётся знакомой, а новые разделы и инструменты появляются постепенно — по мере того, как возникают новые образовательные задачи."
          illustration={{
            src: "/model/5_v2.png",
            alt: "Ученица взаимодействует с образовательным интерфейсом Shidao",
          }}
        />

        <div className="model-experience-story">
          <div className="model-experience-points">
            <article>
              <div className="model-principle-number">1</div>
              <div>
                <h3>Простота снаружи, глубина внутри</h3>
                <p className="model-copy-body">
                  Интерфейс показывает только те разделы и действия, которые
                  нужны человеку сейчас. Ребёнок может видеть только расписание
                  и ближайший урок, а у преподавателя появляются ученики и
                  курсы. По мере возникновения новых образовательных задач
                  система аккуратно раскрывает дополнительные возможности, но
                  сохраняет знакомую навигацию и не превращается в сложную
                  административную панель.
                </p>
              </div>
            </article>

            <article>
              <div className="model-principle-number">2</div>
              <div>
                <h3>От образовательной цели — к готовому курсу</h3>
                <p className="model-copy-body">
                  Курс можно создать с нуля, собрать из шаблона или скопировать
                  из существующего, а собственную программу — сохранить как
                  новый шаблон. При создании с ИИ автор указывает цель, ученика
                  или группу, продолжительность занятий, количество уроков и
                  период обучения, а также при необходимости прикладывает
                  учебные программы, книги, конспекты, документы, аудио, видео и
                  ссылки. ИИ может подготовить весь маршрут сразу или создать
                  только первый урок, чтобы каждый следующий формировался с
                  учётом реальных результатов ученика.
                </p>
              </div>
            </article>

            <article>
              <div className="model-principle-number">3</div>
              <div>
                <h3>Урок одновременно является содержанием и событием</h3>
                <p className="model-copy-body">
                  Вместо двух похожих сущностей — методического урока и
                  назначенного занятия — Shidao использует один урок внутри
                  персонального курса. В нём одновременно находятся план,
                  материалы и активности, а также дата, время и статус
                  проведения. Преподаватель может поставить урок в расписание
                  прямо из курса или выбрать курс и нужный урок при создании
                  события в календаре — в обоих случаях он работает с одним
                  конкретным занятием для конкретного ученика или группы.
                </p>
              </div>
            </article>

            <article>
              <div className="model-principle-number">4</div>
              <div>
                <h3>ИИ создаёт, человек сохраняет контроль</h3>
                <p className="model-copy-body">
                  Сгенерированный курс или урок остаётся обычным редактируемым
                  документом: его можно продолжить вручную, перестроить вместе с
                  ИИ или полностью собрать без его участия. Автор может обычными
                  словами попросить сократить занятие, изменить сложность,
                  заменить тему, добавить практику или подготовить отдельный
                  вариант для конкретного ученика. ИИ вносит изменения
                  непосредственно в структуру курса, а человек видит результат и
                  сохраняет контроль над окончательным решением.
                </p>
              </div>
            </article>

            <article>
              <div className="model-principle-number">5</div>
              <div>
                <h3>Урок собирается из понятных элементов</h3>
                <p className="model-copy-body">
                  Каждый урок объединяет План урока, Экран ученика и Домашнее
                  задание, а для наполнения используется единый Каталог текстов,
                  изображений, аудио, видео, карточек, опросов, игр, головоломок
                  и других активностей. Элементы можно добавлять вручную или
                  поручить их подбор ИИ, а один и тот же компонент адаптируется
                  под конкретную задачу: меняются содержание, сложность,
                  количество элементов, оформление и механика с учётом возраста,
                  уровня и интересов ученика.
                </p>
              </div>
            </article>

            <article>
              <div className="model-principle-number">6</div>
              <div>
                <h3>Преподаватель управляет уроком, ученик видит главное</h3>
                <p className="model-copy-body">
                  Для каждого компонента преподаватель или ИИ определяет, должен
                  ли он появиться на Экране ученика. Внутренние заметки остаются
                  только в Плане урока. Экран ученика показывает выбранные
                  материалы в том же порядке, в котором преподаватель расположил
                  их в уроке, а Домашнее задание остаётся отдельной поверхностью
                  этого урока.
                </p>
              </div>
            </article>
          </div>

          <aside className="model-experience-principle">
            <div>
              <Sparkles size={18} />
              <span>ГЛАВНЫЙ UX-ПРИНЦИП</span>
            </div>
            <h3>
              Не нужно знать, где находится функция, — достаточно сказать, что
              нужно сделать
            </h3>
            <p className="model-copy-body">
              ИИ-ассистент доступен в любом разделе Shidao и понимает контекст
              открытой страницы. К нему можно обратиться текстом или голосом,
              чтобы найти нужное действие, изменить урок, перестроить курс,
              добавить активность, назначить занятие или разобраться в
              результатах ученика. Через MCP-сервер ассистент выполняет
              разрешённые действия внутри продукта, поэтому человеку не
              требуется заранее изучать всю систему — достаточно сформулировать
              задачу обычными словами.
            </p>
          </aside>
        </div>

        <div className="model-ui-story model-ui-story-student">
          <div className="model-student-experience-copy">
            <span className="model-card-label model-card-label-dark">
              ЭКРАН УЧЕНИКА
            </span>
            <h3>Один экран. Два режима доступа.</h3>
            <p className="model-copy-body">
              Во время live-урока преподаватель управляет показом материалов.
              После завершения тот же экран становится пространством повторения.
            </p>
            <div
              className="model-mode-switch"
              role="tablist"
              aria-label="Режим Экрана ученика"
            >
              <button
                type="button"
                role="tab"
                aria-selected={lessonMode === "live"}
                className={lessonMode === "live" ? "is-active" : ""}
                onClick={() => setLessonMode("live")}
              >
                Live-урок
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={lessonMode === "review"}
                className={lessonMode === "review" ? "is-active" : ""}
                onClick={() => setLessonMode("review")}
              >
                Повторение
              </button>
            </div>
            <div className="model-mode-note">
              {lessonMode === "live" ? (
                <>
                  <LockKeyhole size={18} />
                  <span>
                    Навигация ученика заблокирована. Все участники видят
                    материал, выбранный преподавателем.
                  </span>
                </>
              ) : (
                <>
                  <MousePointer2 size={18} />
                  <span>
                    Ученик свободно просматривает уже открытые материалы и
                    повторяет урок.
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="model-tablet-frame">
            <div className="model-tablet-camera" />
            <div className="model-student-screen">
              <div className="model-student-topline">
                <span>Китайский для Миши</span>
                <div>
                  <span className="model-live-dot" />{" "}
                  {lessonMode === "live" ? "Урок идёт" : "Повторение"}
                </div>
              </div>
              <div className="model-student-contentmeta">
                <span>МАТЕРИАЛ УРОКА</span>
                <strong>Как тебя зовут?</strong>
              </div>
              <div className="model-dialog-card">
                <div className="model-dialog-person">李</div>
                <div>
                  <b>你叫什么名字？</b>
                  <span>Nǐ jiào shénme míngzi?</span>
                  <small>Как тебя зовут?</small>
                </div>
                <button type="button" aria-label="Прослушать диалог">
                  <Play size={16} fill="currentColor" />
                </button>
              </div>
              <p className="model-student-instruction">
                Прослушай фразу и ответь, назвав своё имя.
              </p>
              <button className="model-answer-button" type="button">
                <span className="model-mic-wave">•••</span> Ответить голосом
              </button>
              <div className="model-student-controls">
                <button type="button" disabled={lessonMode === "live"}>
                  ← Назад
                </button>
                <div className="model-content-dots">
                  {[0, 1, 2, 3, 4, 5].map((dot) => (
                    <span className={dot === 1 ? "is-active" : ""} key={dot} />
                  ))}
                </div>
                <button type="button" disabled={lessonMode === "live"}>
                  Дальше →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="model-strategy" id="strategy">
        <div className="model-section model-strategy-main">
          <SectionIntro
            index="06"
            eyebrow="Стратегия"
            title={
              <>
                От рабочего инструмента
                <br />
                преподавателя
                <br />
                к универсальной
                <br />
                системе{" "}
                <em className="model-section-title-accent">
                  персонального
                  <br />
                  обучения с ИИ
                </em>
              </>
            }
            text="Мы не строим всё будущее одновременно. Первая версия решает конкретную ежедневную работу преподавателя — и закладывает модель, которая масштабируется до персонального обучения с ИИ."
            illustration={{
              src: "/model/6_1.png",
              alt: "Ученик поднимается по ступеням образовательного маршрута",
            }}
          />

          <div
            className="model-strategy-path"
            aria-label="Этапы развития Shidao"
          >
            {roadmap.map((item, index) => (
              <article className="model-strategy-path-item" key={item.stage}>
                <div>
                  <span>{item.stage}</span>
                  <item.Icon size={23} />
                </div>
                <small>{item.tag}</small>
                <strong>{item.title}</strong>
                <p className="model-copy-body">{item.text}</p>
                {index < roadmap.length - 1 && (
                  <ChevronRight
                    className="model-strategy-path-arrow"
                    size={20}
                  />
                )}
              </article>
            ))}
          </div>

          <div className="model-strategy-story">
            <div className="model-strategy-future-copy">
              <span>ВЗГЛЯД В БУДУЩЕЕ · НЕ ОБЕЩАНИЕ, А НАПРАВЛЕНИЕ</span>
              <h2>
                Школа может перестать быть единственным источником образования.
              </h2>
              <p className="model-copy-body">
                По мере развития искусственного интеллекта качественное
                персональное обучение будет становиться доступнее. Значительная
                часть стоимости образования сегодня связана не только с самим
                преподаванием, но и с помещениями, управлением, расписанием,
                поиском специалистов и множеством организационных звеньев. ИИ
                способен выполнять часть этой работы одновременно для большого
                количества людей: объяснять материал, подбирать задания,
                проверять ответы, менять сложность и учитывать историю
                конкретного ученика. Поэтому рынок, скорее всего, будет
                постепенно двигаться к более дешёвым и персональным форматам
                обучения.
              </p>
              <p className="model-copy-body">
                Для семей, которые могут организовать занятия дома, это откроет
                полноценную альтернативу ежедневному посещению образовательного
                учреждения. Ребёнок сможет учиться самостоятельно, вместе с
                родителем, другим близким взрослым или дистанционным
                наставником, а ИИ будет помогать выстраивать программу,
                проводить занятия и отслеживать прогресс. Это особенно важно для
                семейного обучения, жителей удалённых регионов, детей с
                ограниченной мобильностью и всех, кому стандартное расписание
                или единый темп школы не подходят. Формальная аттестация и
                экзамены при этом могут оставаться внешней функцией, а сам
                образовательный процесс — становиться более гибким и
                индивидуальным.
              </p>
              <p className="model-copy-body">
                Тем, кому по-прежнему необходимо физическое пространство для
                ребёнка, школы и другие учреждения продолжат быть нужны. Однако
                их главная ценность может сместиться от передачи одинакового
                материала всему классу к безопасности, социализации, режиму,
                совместным проектам и живому участию взрослых. ИИ-система сможет
                вести индивидуальные или групповые занятия, адаптировать
                объяснения под возраст, язык, уровень, интересы и текущую
                ситуацию, а педагог постепенно станет наставником, куратором и
                организатором среды, который замечает состояние детей, помогает
                им взаимодействовать и включается там, где необходим
                человеческий контакт.
              </p>
              <p className="model-copy-body">
                Такой формат потребует не отдельного чат-бота, а полноценной
                образовательной инфраструктуры. Необходимо связывать учебную
                цель с программой, расписанием и конкретными занятиями,
                управлять доступом детей и взрослых, хранить историю обучения,
                показывать материалы на разных устройствах, учитывать
                посещаемость и результаты, поддерживать групповые сценарии и
                передавать контекст между человеком и ИИ. Именно таким слоем
                может стать Shidao: экосистемой, внутри которой школа подключает
                ИИ-преподавателей, а каждый ребёнок получает собственный
                образовательный профиль и адаптивный маршрут.
              </p>
              <p className="model-copy-body">
                Этот рынок ещё только формируется, поэтому Shidao не начинает с
                попытки сразу заменить существующую систему образования. Первый
                практический шаг — продукт для преподавателей, репетиторов и
                школ, где занятия по-прежнему проводят люди, но уже используют
                ИИ для создания курсов, подготовки уроков, проведения
                активностей и анализа результатов. Поддержка онлайн- и
                офлайн-форматов позволяет проверять технологию в реальном
                образовательном процессе сегодня и постепенно двигаться к
                модели, в которой человек, образовательное учреждение и ИИ
                работают как единая система.
              </p>
            </div>

            <aside className="model-strategy-quote">
              <div>
                <MessageSquareText size={18} />
                <span>ВЗГЛЯД В БУДУЩЕЕ</span>
              </div>
              <blockquote>
                «Образование изменится. Учить с помощью ИИ гораздо легче
                масштабировать, чем с помощью учителей».
              </blockquote>
              <cite>
                <strong>Луис фон Ан</strong>
                <span>основатель и CEO Duolingo, 2025</span>
              </cite>
            </aside>
          </div>
        </div>
      </section>

      <section className="model-north-star" id="north-star">
        <div className="model-north-star-visual">
          <ProgressiveModelImage
            src="/model/7_1.png"
            alt="Дети и ИИ-ассистент собирают общий образовательный маршрут Shidao"
            width={1254}
            height={1254}
            sizes="(max-width: 960px) 100vw, 50vw"
          />
        </div>

        <div className="model-north-star-copy">
          <h2>
            Сегодня Shidao продаёт
            <br />
            <span>
              систему для создания
              <br />
              и проведения обучения.
              <br />
            </span>
            Завтра — само
            <br />
            персональное
            <br />
            образование с ИИ.
          </h2>
          <p className="model-copy-lead">
            У каждого человека должен быть собственный образовательный путь, а
            не только доступ к учебным материалам.
          </p>
          <a href="#top" className="model-button model-button-primary">
            Вернуться к началу <ArrowUp size={17} />
          </a>
        </div>
      </section>
    </main>
  );
}
