"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Bot,
  ChevronRight,
  CircleUserRound,
  Clock3,
  FileStack,
  GraduationCap,
  Heart,
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
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import { type ReactNode, useEffect, useState } from "react";

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
  },
  {
    stage: "03",
    tag: "Следующий этап",
    title: "ИИ-преподаватель",
    text: "Занятия ведёт ИИ-преподаватель: объясняет материал, задаёт вопросы, проверяет ответы, меняет темп и сохраняет результаты в образовательный профиль.",
  },
  {
    stage: "04",
    tag: "Будущее",
    title: "B2C-обучение",
    text: "Человек приходит в Shidao с целью и получает готовый персональный образовательный путь, а не набор отдельных инструментов.",
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
  illustration?: { src: string; alt: string };
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
            <Image
              src={illustration.src}
              alt={illustration.alt}
              width={1254}
              height={1254}
              sizes="(max-width: 960px) 100vw, 50vw"
              unoptimized
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

  useEffect(() => {
    const updateProgress = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(
        scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0,
      );
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    return () => window.removeEventListener("scroll", updateProgress);
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
          href="https://demo.shidao.ru"
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
            <Image
              src="/model/0_1_v2.png"
              alt=""
              width={1080}
              height={1080}
              sizes="(max-width: 960px) 100vw, 50vw"
              priority
              unoptimized
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
            <a
              className="model-button model-button-ghost"
              href="https://demo.shidao.ru"
              target="_blank"
              rel="noopener noreferrer"
            >
              Увидеть в работе <ArrowRight size={17} />
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
                {
                  Icon: History,
                  text: "Таким образом, Shidao сохраняет у себя главное — образовательную память, структуру процесса, данные и правила работы. Модели, пользовательские интерфейсы и внешние сервисы могут меняться, а сама система остаётся стабильной, безопасной и готовой к развитию экосистемы ИИ.",
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
              Один человек –
              <br />
              <em className="model-section-title-accent">один аккаунт</em>
            </>
          }
          text="Один человек может одновременно создавать курсы, учиться сам, проводить занятия и помогать ребёнку. Поэтому в Shidao нет отдельных типов аккаунта «учитель», «родитель» и «ученик»: возможности определяются владением и связями с конкретными курсами, группами и образовательными профилями. Интерфейс показывает нужный контекст для текущей задачи, а все три сценария продолжают единый образовательный профиль человека."
          illustration={{
            src: "/model/4_v3.png",
            alt: "Один человек в разных образовательных контекстах",
          }}
        />

        <div className="model-account-story">
          <div className="model-account-points">
            <article>
              <div className="model-account-point-icon">
                <GraduationCap size={28} strokeWidth={1.5} />
              </div>
              <div>
                <span>ПЕРВЫЙ РЫНОК · ПРЕПОДАВАТЕЛЬ</span>
                <h3>Из цели ученика — в готовое занятие</h3>
                <p className="model-copy-body">
                  Преподаватель создаёт курс вручную, из шаблона или вместе с
                  ИИ, готовит план урока, Экран ученика и материалы, а затем
                  проводит занятие сам, с ИИ-помощником или повторно использует
                  готовый урок. Он может попросить: «Сделай урок короче, добавь
                  практику на эти слова и отдельный вариант для Миши». После
                  занятия ошибки, новые слова и наблюдения сохраняются в
                  образовательном профиле. Меньше времени уходит на подготовку и
                  администрирование, больше — на само обучение.
                </p>
              </div>
            </article>

            <article>
              <div className="model-account-point-icon">
                <Heart size={27} strokeWidth={1.5} />
              </div>
              <div>
                <span>СЛЕДУЮЩИЙ РЫНОК · РОДИТЕЛЬ</span>
                <h3>Обучение ребёнка без сборки из пяти сервисов</h3>
                <p className="model-copy-body">
                  Родитель создаёт отдельный образовательный профиль ребёнка,
                  выбирает готовый путь или персональную программу и определяет,
                  как будет проходить обучение: самостоятельно, с
                  преподавателем или с ИИ. Запрос может звучать просто: «Хочу
                  программу чтения на три месяца: короткие занятия, динозавры и
                  без перегруза». Shidao связывает цель и ограничения с
                  расписанием, домашними заданиями, результатами и
                  подтверждёнными выводами, сохраняя историю ребёнка независимо
                  от отдельных курсов.
                </p>
              </div>
            </article>

            <article>
              <div className="model-account-point-icon">
                <BookOpen size={27} strokeWidth={1.5} />
              </div>
              <div>
                <span>ЛИЧНЫЙ ПУТЬ · УЧЕНИК</span>
                <h3>Простой экран сегодня — память на годы</h3>
                <p className="model-copy-body">
                  Ученик видит ближайшее занятие без административного шума,
                  проходит доступные шаги на Экране ученика и выполняет общее
                  или персональное домашнее задание. Он может попросить:
                  «Покажи, что у меня сегодня, помоги пройти и напомни, что
                  повторить». Следующий урок учитывает прошлый опыт: курсы и
                  преподаватели меняются, а образовательная память человека
                  остаётся.
                </p>
              </div>
            </article>
          </div>

          <aside className="model-account-case">
            <div className="model-account-case-label">
              <CircleUserRound size={18} />
              <span>ОДИН ЧЕЛОВЕК · ТРИ КОНТЕКСТА</span>
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
          text="Shidao не заставляет выбирать и переключать роли. Расписание, ученики, курсы и новые возможности появляются естественно — тогда, когда они действительно нужны человеку."
          illustration={{
            src: "/model/5_v2.png",
            alt: "Ученица взаимодействует с образовательным интерфейсом Shidao",
          }}
        />

        <div className="model-experience-narrative">
          <article>
            <div className="model-principle-number">1</div>
            <div>
              <h3>Один человек — одно знакомое пространство</h3>
              <p className="model-copy-body">
                Ученик, преподаватель и родитель не входят в разные кабинеты и
                не ищут переключатель ролей. Создание нескольких аккаунтов
                потребовало бы дополнительных номеров телефона и адресов
                электронной почты, а также новых паролей, которые нужно хранить
                и запоминать. Поэтому у человека остаются одни учётные данные и
                один интерфейс, а доступные действия определяются его курсами,
                образовательными профилями и связями с другими людьми.
              </p>
              <p className="model-copy-body">
                Войти можно по электронной почте или номеру телефона с паролем,
                а для ребёнка — по короткому PIN-коду. Позднее могут появиться и
                более наглядные способы входа, например через последовательность
                знакомых изображений. Способ авторизации может меняться, но
                человек всегда попадает в одно и то же образовательное
                пространство.
              </p>
            </div>
          </article>

          <article>
            <div className="model-principle-number">2</div>
            <div>
              <h3>Простота снаружи, глубина внутри</h3>
              <p className="model-copy-body">
                Интерфейс показывает только те разделы, которые нужны человеку
                сейчас. У ребёнка это может быть одно расписание. Когда человек
                создаёт курс или начинает преподавать, появляются ученики и
                курсы. Когда он связывает свой аккаунт с профилем ребёнка,
                открываются родительские возможности.
              </p>
              <p className="model-copy-body">
                Даже преподавателю не нужна сложная административная панель:
                основные задачи собраны внутри нескольких понятных разделов.
                Интерфейс не меняется целиком при появлении новых возможностей —
                он лишь постепенно раскрывается, сохраняя привычную логику
                работы.
              </p>
            </div>
          </article>

          <article>
            <div className="model-principle-number">3</div>
            <div>
              <h3>От образовательной цели — к готовому курсу</h3>
              <p className="model-copy-body">
                Курс можно создать с нуля, собрать из шаблона или скопировать из
                существующего. Любой собственный курс можно сохранить как новый
                шаблон и использовать повторно.
              </p>
              <p className="model-copy-body">
                При создании курса с ИИ человек указывает цель, выбирает ученика
                или группу, задаёт длительность занятий, количество уроков и
                период обучения. К курсу можно приложить методики, книги, старые
                конспекты, документы, аудио, видео и ссылки. Все параметры
                остаются опциональными, но каждый из них помогает точнее
                передать замысел автора и адаптировать программу к конкретной
                аудитории.
              </p>
              <p className="model-copy-body">
                ИИ может создать весь маршрут сразу или подготовить только
                первый урок. Во втором случае каждый следующий урок формируется
                с учётом того, как ученик справился с предыдущим: что понял, где
                ошибся, что вызвало интерес и что необходимо повторить.
              </p>
            </div>
          </article>

          <article>
            <div className="model-principle-number">4</div>
            <div>
              <h3>Урок одновременно является содержанием и событием</h3>
              <p className="model-copy-body">
                Раньше методический урок и его проведение по расписанию
                существовали как две отдельные сущности, из-за чего пользователю
                приходилось разбираться, где находится содержание, а где —
                назначенное занятие. В новой модели урок внутри персонального
                курса объединяет оба смысла: в нём одновременно хранятся план,
                материалы и активности, а также дата, время и статус проведения.
              </p>
              <p className="model-copy-body">
                Преподаватель может назначить урок прямо из курса или добавить
                его через расписание, выбрав нужный курс и занятие. В обоих
                случаях он работает с одной и той же сущностью — конкретным
                уроком для конкретного ученика или группы, который можно
                подготовить, поставить в расписание, провести и затем
                использовать для адаптации дальнейшего обучения.
              </p>
            </div>
          </article>

          <article>
            <div className="model-principle-number">5</div>
            <div>
              <h3>ИИ создаёт, человек сохраняет контроль</h3>
              <p className="model-copy-body">
                Сгенерированный курс не становится закрытым результатом. Его
                можно полностью редактировать вручную, перестраивать вместе с ИИ
                или продолжать собирать без участия искусственного интеллекта.
              </p>
              <p className="model-copy-body">
                Автор может попросить сократить урок, заменить тему, добавить
                практику, изменить сложность или подготовить отдельный вариант
                для конкретного ученика. ИИ предлагает изменения непосредственно
                внутри курса, а не выдаёт текст, который затем приходится
                переносить в другие инструменты.
              </p>
            </div>
          </article>

          <article>
            <div className="model-principle-number">6</div>
            <div>
              <h3>Урок собирается из понятных элементов</h3>
              <p className="model-copy-body">
                Каждый урок состоит из Плана урока, Экрана ученика и Домашнего
                задания; Материалы остаются отдельной библиотекой ресурсов. Для
                наполнения автор работает с единым Каталогом: текстами,
                изображениями, видео, аудио, карточками, опросами, играми,
                головоломками и другими активностями.
              </p>
              <p className="model-copy-body">
                Элементы можно добавлять вручную или поручить их подбор ИИ. Один
                и тот же тип активности настраивается под конкретную задачу:
                меняются содержание, сложность, количество элементов, оформление
                и механика. Например, головоломка для маленького ребёнка может
                быть проще, а её сюжет — учитывать его интересы.
              </p>
            </div>
          </article>

          <article>
            <div className="model-principle-number">7</div>
            <div>
              <h3>Ученик видит только то, что нужно ему сейчас</h3>
              <p className="model-copy-body">
                Для каждого шага преподаватель или ИИ определяет, какие элементы
                должны появиться на Экране ученика. Сам методический план
                остаётся скрытым: ученик видит только понятное задание, материал
                или активность, с которой работает в этот момент.
              </p>
              <p className="model-copy-body">
                Во время занятия переходами управляет преподаватель. После урока
                тот же Экран ученика можно использовать для повторения. Домашнее
                задание создаётся отдельно и также собирается из элементов
                Каталога — общее для группы или персональное для конкретного
                ученика.
              </p>
            </div>
          </article>

          <article>
            <div className="model-principle-number">8</div>
            <div>
              <h3>ИИ-ассистент всегда находится рядом</h3>
              <p className="model-copy-body">
                Ассистент доступен в любом разделе Shidao и понимает контекст
                открытой страницы. К нему можно обратиться текстом или голосом,
                чтобы найти нужную функцию, изменить урок, перестроить курс,
                добавить активность, назначить занятие или разобраться в
                результатах ученика.
              </p>
              <p className="model-copy-body">
                Через MCP-сервер ассистент сможет не только объяснять, что
                делать, но и выполнять разрешённые действия внутри продукта.
                Поэтому человеку не требуется заранее изучать все возможности
                интерфейса — достаточно сформулировать свою задачу обычными
                словами.
              </p>
            </div>
          </article>
        </div>

        <div className="model-ui-story model-ui-story-student">
          <div className="model-student-experience-copy">
            <span className="model-card-label model-card-label-dark">
              ЭКРАН УЧЕНИКА
            </span>
            <h3>Один экран. Два режима доступа.</h3>
            <p className="model-copy-body">
              Во время live-урока текущий шаг выбирает преподаватель. После
              завершения тот же экран становится пространством повторения.
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
                    Навигация ученика заблокирована. Все участники видят шаг,
                    выбранный преподавателем.
                  </span>
                </>
              ) : (
                <>
                  <MousePointer2 size={18} />
                  <span>
                    Ученик свободно перемещается между уже открытыми шагами и
                    повторяет материал.
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
              <div className="model-student-stepmeta">
                <span>ШАГ 2 ИЗ 6</span>
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
                <div className="model-step-dots">
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
                Лёгкий вход.
                <br />
                <em className="model-section-title-accent">
                  Большая система за ним.
                </em>
              </>
            }
            text="Мы не строим всё будущее одновременно. Первая версия решает конкретную ежедневную работу преподавателя — и закладывает модель, которая масштабируется до персонального обучения с ИИ."
            illustration={{
              src: "/model/6_1.png",
              alt: "Ученик поднимается по ступеням образовательного маршрута",
            }}
          />

          <div className="model-wedge">
            <div className="model-wedge-now">
              <span>ТАКТИКА · ПЕРВЫЙ РЫНОК</span>
              <h3>Школы, преподаватели и репетиторы</h3>
              <p className="model-copy-body">
                Уже работают с учащимися, каждую неделю готовят уроки и сразу
                чувствуют ценность единого рабочего процесса.
              </p>
              <div>
                <span>
                  <Clock3 size={16} /> Экономия подготовки
                </span>
                <span>
                  <FileStack size={16} /> Собственная библиотека
                </span>
                <span>
                  <Sparkles size={16} /> ИИ в реальной работе
                </span>
              </div>
            </div>
            <div className="model-wedge-arrow">
              <ArrowRight size={25} />
            </div>
            <div className="model-wedge-next">
              <span>СТРАТЕГИЯ · МАСШТАБИРОВАНИЕ</span>
              <div className="model-market-rings">
                <div>Преподаватели</div>
                <div>Агенты</div>
                <div>ИИ-преподаватель</div>
                <div>Самообучение</div>
              </div>
            </div>
          </div>

          <div className="model-roadmap" aria-label="Этапы развития Shidao">
            {roadmap.map((item, index) => (
              <article
                className={index === 0 ? "is-current" : ""}
                key={item.stage}
              >
                <div className="model-roadmap-marker">
                  <span>{item.stage}</span>
                  <i />
                </div>
                <div className="model-roadmap-card">
                  <small>{item.tag}</small>
                  <h3>{item.title}</h3>
                  <p className="model-copy-body">{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="model-future">
          <div className="model-future-glow" aria-hidden="true" />
          <div className="model-future-copy">
            <span>ВЗГЛЯД В БУДУЩЕЕ · НЕ ОБЕЩАНИЕ, А НАПРАВЛЕНИЕ</span>
            <h2>
              Школа может перестать быть единственным источником образования.
            </h2>
            <p className="model-copy-body">
              Школы могут превратиться в пространства, которые отвечают за
              безопасность, социализацию, совместные проекты, режим и
              присутствие взрослых. Само обучение — объяснение, практика,
              проверка знаний и выбор следующего шага — частично перейдёт к ИИ.
            </p>
            <p className="model-copy-body">
              В таком сценарии Shidao становится цифровой образовательной средой
              школы. Он ведёт профиль каждого ребёнка, сохраняет историю
              обучения, подбирает программу, проводит занятия через
              ИИ-преподавателя, анализирует результаты и адаптирует следующий
              урок под одного ученика или целую группу.
            </p>
            <p className="model-copy-body">
              Дети могут работать с планшетами, общим экраном, проектором или
              новыми устройствами — конкретная техника не принципиальна.
              Взрослый остаётся рядом как оператор пространства, наставник и
              человек, который помогает, когда нужен живой контакт; всю
              последовательность образовательного процесса удерживает Shidao.
            </p>
          </div>
          <div className="model-future-scene">
            <div className="model-future-space-head">
              <div>
                <GraduationCap size={24} />
                <div>
                  <small>ФИЗИЧЕСКОЕ ПРОСТРАНСТВО</small>
                  <strong>Школа</strong>
                </div>
              </div>
              <span>
                безопасность · социализация · проекты · взрослые рядом
              </span>
            </div>

            <div className="model-future-platform">
              <div className="model-future-platform-head">
                <Wordmark className="model-future-wordmark" />
                <div>
                  <span>ВЕДЁТ ВЕСЬ ОБРАЗОВАТЕЛЬНЫЙ ПРОЦЕСС</span>
                  <strong>Цифровая образовательная среда</strong>
                </div>
              </div>
              <p className="model-copy-body">
                Shidao связывает цели, уроки, материалы и историю ребёнка в одну
                непрерывную систему.
              </p>

              <div className="model-future-capabilities">
                <div>
                  <Bot size={19} />
                  <div>
                    <strong>ИИ-преподаватель</strong>
                    <span>объясняет · тренирует · проверяет</span>
                  </div>
                </div>
                <div>
                  <History size={19} />
                  <div>
                    <strong>Учебный профиль</strong>
                    <span>хранит знания · ошибки · интересы · темп</span>
                  </div>
                </div>
                <div>
                  <Target size={19} />
                  <div>
                    <strong>Адаптация</strong>
                    <span>выбирает программу и следующий шаг</span>
                  </div>
                </div>
                <div>
                  <Network size={19} />
                  <div>
                    <strong>Аналитика</strong>
                    <span>видит прогресс и помогает принимать решения</span>
                  </div>
                </div>
              </div>

              <div className="model-future-modes">
                <div>
                  <CircleUserRound size={20} />
                  <div>
                    <strong>Один ребёнок</strong>
                    <span>свой ИИ-преподаватель, программа и темп</span>
                  </div>
                </div>
                <div>
                  <Users size={20} />
                  <div>
                    <strong>Группа детей</strong>
                    <span>общий урок, адаптированный под эту группу</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="model-future-operator">
              <Heart size={20} />
              <div>
                <strong>Взрослый внутри пространства</strong>
                <span>
                  поддерживает ритм, помогает в сложных ситуациях и сохраняет
                  живой человеческий контакт
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="model-north-star" id="north-star">
        <h2>
          Сегодня Shidao продаёт
          <br />
          <span>систему для создания и проведения обучения с ИИ.</span>
          <br />
          Завтра — само персональное образование.
        </h2>
        <p className="model-copy-lead">
          У каждого человека должен быть собственный образовательный путь, а не
          только доступ к учебным материалам.
        </p>
        <a href="#top" className="model-button model-button-light">
          Вернуться к началу <ArrowUp size={17} />
        </a>
      </section>
    </main>
  );
}
