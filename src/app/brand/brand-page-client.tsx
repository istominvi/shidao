"use client";

import {
  ArrowDown,
  ArrowRight,
  Check,
  ExternalLink,
  Menu,
  X,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const brandDestinations = [
  {
    href: "https://shidao.ru",
    label: "shidao.ru",
    description: "Главная страница Shidao",
  },
  {
    href: "https://model.shidao.ru",
    label: "model.shidao.ru",
    description: "Продуктовая модель Shidao",
  },
  {
    href: "https://demo.shidao.ru",
    label: "demo.shidao.ru",
    description: "Демонстрация продукта",
  },
] as const;

const spellingRows = [
  {
    context: "Официальное имя",
    form: "Shidao",
    rule: "Основная форма во всех интерфейсах, документах, презентациях и коммуникациях.",
  },
  {
    context: "Русский текст",
    form: "Шидао",
    rule: "Допустимо для произношения или текста на кириллице. При первом упоминании: Shidao (Шидао).",
  },
  {
    context: "Домены",
    form: "shidao.ru",
    rule: "Всегда lowercase: brand.shidao.ru, model.shidao.ru, demo.shidao.ru.",
  },
  {
    context: "Технические ID",
    form: "shidao",
    rule: "Пакеты, переменные, slug и каталоги — lowercase, если соглашения кода не требуют другого.",
  },
  {
    context: "Декоративный uppercase",
    form: "SHIDAO",
    rule: "Только как типографический приём в коротких labels и служебных подписях.",
  },
] as const;

const correctForms = [
  "Shidao",
  "Shidao (Шидао)",
  "brand.shidao.ru",
  "SHIDAO — только как label",
] as const;

const incorrectForms = [
  "ShiDao",
  "Shadao",
  "Shi Dao",
  "Shidao™",
  "Shidao® — до регистрации",
] as const;

const nextChapters = [
  {
    number: "02",
    title: "Голос бренда",
    text: "Как Shidao объясняет сложное, обращается к взрослым и детям и говорит об ИИ.",
    color: "lilac",
  },
  {
    number: "03",
    title: "Визуальная система",
    text: "Логотип, цвет, типографика, сетка, изображения и движение.",
    color: "blue",
  },
  {
    number: "04",
    title: "Применение",
    text: "Продукт, сайт, презентации, соцсети, документы и партнёрские материалы.",
    color: "coral",
  },
] as const;

function Wordmark() {
  return <span className="brand-wordmark">Shidao</span>;
}

export function BrandPageClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const moreMenuRef = useRef<HTMLDivElement>(null);

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
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen && !moreMenuOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setMoreMenuOpen(false);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (
        moreMenuOpen &&
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setMoreMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen, moreMenuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="brand-page">
      <div
        className="brand-scroll-progress"
        style={{ width: `${scrollProgress}%` }}
        aria-hidden="true"
      />

      <header className="brand-header">
        <a className="brand-logo" href="#top" aria-label="Shidao, наверх">
          <Wordmark />
          <span className="brand-logo-descriptor">Brand book</span>
        </a>

        <nav
          className={`brand-nav ${menuOpen ? "is-open" : ""}`}
          aria-label="Навигация по брендбуку"
          id="brand-navigation"
        >
          <a href="#top" onClick={closeMenu}>
            Бренд
          </a>
          <a href="#name" onClick={closeMenu}>
            Название
          </a>
          <a href="#spelling" onClick={closeMenu}>
            Написание
          </a>
          <a href="#next" onClick={closeMenu}>
            Дальше
          </a>
        </nav>

        <div className="brand-more" ref={moreMenuRef}>
          <button
            className="brand-header-cta"
            type="button"
            aria-haspopup="true"
            aria-expanded={moreMenuOpen}
            aria-controls="brand-more-menu"
            onClick={() => {
              setMoreMenuOpen((value) => !value);
              setMenuOpen(false);
            }}
          >
            Еще <ArrowRight size={15} aria-hidden="true" />
          </button>

          {moreMenuOpen ? (
            <nav
              className="brand-more-menu"
              id="brand-more-menu"
              aria-label="Другие сайты Shidao"
            >
              {brandDestinations.map((destination) => (
                <a
                  className="brand-more-link"
                  href={destination.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMoreMenuOpen(false)}
                  key={destination.href}
                >
                  <span>
                    <strong>{destination.label}</strong>
                    <small>{destination.description}</small>
                  </span>
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              ))}
            </nav>
          ) : null}
        </div>

        <button
          className="brand-menu-button"
          type="button"
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
          aria-controls="brand-navigation"
          onClick={() => {
            setMenuOpen((value) => !value);
            setMoreMenuOpen(false);
          }}
        >
          {menuOpen ? (
            <X size={22} aria-hidden="true" />
          ) : (
            <Menu size={22} aria-hidden="true" />
          )}
        </button>
      </header>

      <section className="brand-hero" id="top">
        <div className="brand-hero-inner">
          <div className="brand-hero-main">
            <div className="brand-hero-kicker">
              <span>Внутренний брендбук</span>
              <span>28 / 07 / 2026</span>
            </div>

            <h1>
              <span>Shidao —</span>
              <em>имя, смысл</em>
              <span>и единый язык</span>
              <span>нашего продукта.</span>
            </h1>

            <p className="brand-hero-lead">
              Этот брендбук фиксирует решения, по которым Shidao узнают: как мы
              пишем название, объясняем его смысл, говорим с людьми и строим
              визуальную систему. Каждое принятое правило становится общим для
              продукта, сайта, презентаций и коммуникаций.
            </p>

            <div className="brand-hero-actions">
              <a className="brand-button brand-button-primary" href="#name">
                Начать с названия <ArrowDown size={17} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="brand-hero-media-slot" aria-hidden="true" />
        </div>
      </section>

      <section className="brand-section brand-name-section" id="name">
        <div className="brand-section-intro">
          <p className="brand-eyebrow">
            <span>01</span> Название
          </p>
          <div className="brand-section-title">
            <h2>
              Shidao — имя пути,
              <br />
              <em>в котором учат и учатся.</em>
            </h2>
            <p>
              Название происходит от китайского 师道 — shī dào. Это культурный
              образ, связанный с принципами учительства, уважением к знанию и
              путём обучения у наставника.
            </p>
          </div>
        </div>

        <div
          className="brand-etymology"
          aria-label="Этимология названия Shidao"
        >
          <article className="brand-etymology-card">
            <span className="brand-hanzi" lang="zh-CN">
              师
            </span>
            <span className="brand-pinyin">shī</span>
            <p>учитель · наставник</p>
          </article>
          <span className="brand-etymology-operator" aria-hidden="true">
            +
          </span>
          <article className="brand-etymology-card">
            <span className="brand-hanzi" lang="zh-CN">
              道
            </span>
            <span className="brand-pinyin">dào</span>
            <p>путь · принцип · способ</p>
          </article>
          <span className="brand-etymology-operator" aria-hidden="true">
            →
          </span>
          <article className="brand-etymology-card brand-etymology-result">
            <span className="brand-hanzi" lang="zh-CN">
              师道
            </span>
            <span className="brand-pinyin">shī dào</span>
            <p>путь учительства и обучения у наставника</p>
          </article>
        </div>

        <div className="brand-name-story">
          <div className="brand-story-copy">
            <p>
              В традиционном значении 师道 связано с путём учительства,
              принципами наставника и обучением у учителя. Для бренда Shidao
              этот смысл раскрывается шире одной профессии. Здесь человек может
              быть преподавателем, учеником, родителем, автором курса или
              наставником, а часть образовательного процесса может выполнять
              искусственный интеллект.
            </p>
            <p>
              Эти роли меняются, но общий смысл остаётся: человек формулирует
              цель, получает путь и движется по нему не в одиночку. Поэтому в
              коммуникации мы используем не только буквальную формулу «путь
              учителя», а более объёмную брендовую интерпретацию — «путь
              наставничества» и «путь обучения у наставника».
            </p>
          </div>

          <aside className="brand-meaning-note">
            <div>
              <span className="brand-note-index">Зафиксировано · 01</span>
              <span className="brand-note-status">
                <span aria-hidden="true" /> Важно
              </span>
            </div>
            <p>
              «Путь наставничества» — брендовая интерпретация, а не буквальный
              словарный перевод.
            </p>
            <span>
              Мы честно разделяем происхождение слова и тот смысл, который бренд
              развивает сегодня.
            </span>
          </aside>
        </div>

        <blockquote className="brand-formula">
          <div className="brand-formula-meta">
            <span>Смысл бренда</span>
            <span>Решение 01 · v1.0</span>
          </div>
          <p>
            Shidao помогает человеку выстроить путь обучения и пройти его{" "}
            <em>вместе с наставником, самостоятельно или с ИИ.</em>
          </p>
        </blockquote>
      </section>

      <section className="brand-section brand-spelling-section" id="spelling">
        <div className="brand-section-intro">
          <p className="brand-eyebrow brand-eyebrow-coral">
            <span>02</span> Написание
          </p>
          <div className="brand-section-title">
            <h2>
              Одно имя —
              <br />
              <em>одна форма.</em>
            </h2>
            <p>
              Во всех пользовательских и командных материалах бренд пишется
              Shidao — с одной заглавной буквой в начале и без символа ™.
            </p>
          </div>
        </div>

        <div className="brand-spelling-table">
          <div className="brand-table-header" aria-hidden="true">
            <span>Контекст</span>
            <span>Форма</span>
            <span>Правило</span>
          </div>
          {spellingRows.map((row) => (
            <article className="brand-table-row" key={row.context}>
              <span className="brand-table-context">{row.context}</span>
              <strong>{row.form}</strong>
              <p>{row.rule}</p>
            </article>
          ))}
        </div>

        <div className="brand-why-not">
          <p className="brand-micro-label">Почему не ShiDao</p>
          <div>
            <h3>
              Внутренняя заглавная D разрезает цельное имя на две технические
              части.
            </h3>
            <div className="brand-why-copy">
              <p>
                ShiDao визуально начинает напоминать идентификатор из кода или
                искусственно составленное английское слово. Для большинства
                людей Shi и Dao не являются понятными самостоятельными частями,
                поэтому такое разделение не помогает прочтению.
              </p>
              <p>
                Смысл двух китайских морфем объясняется один раз в брендбуке. В
                обычном использовании название воспринимается как
                самостоятельное цельное имя — Shidao.
              </p>
            </div>
          </div>
        </div>

        <div className="brand-forms-board">
          <article className="brand-forms-column brand-forms-correct">
            <div className="brand-forms-heading">
              <span>Правильно</span>
              <span className="brand-decision-chip">
                <span aria-hidden="true" /> Стандарт
              </span>
            </div>
            <ul>
              {correctForms.map((form) => (
                <li key={form}>
                  <Check size={19} strokeWidth={2.2} aria-hidden="true" />
                  {form}
                </li>
              ))}
            </ul>
          </article>

          <article className="brand-forms-column brand-forms-incorrect">
            <div className="brand-forms-heading">
              <span>Неправильно</span>
              <span className="brand-decision-chip">Не использовать</span>
            </div>
            <ul>
              {incorrectForms.map((form) => (
                <li key={form}>
                  <XIcon size={19} strokeWidth={2.2} aria-hidden="true" />
                  {form}
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="brand-legal">
          <div className="brand-legal-heading">
            <p className="brand-micro-label">Правило по ™ и ®</p>
            <h3>Wordmark остаётся чистым.</h3>
          </div>
          <ol>
            <li>
              <span>01</span>
              <p>На странице и в wordmark не использовать ™.</p>
            </li>
            <li>
              <span>02</span>
              <p>До регистрации товарного знака не использовать ®.</p>
            </li>
            <li>
              <span>03</span>
              <p>
                После регистрации вопрос использования ® решается отдельно
                вместе с юристом и не требует знака после каждого упоминания.
              </p>
            </li>
          </ol>
          <p className="brand-legal-note">
            В России знак охраны зарегистрированного товарного знака
            предусмотрен статьёй 1485 ГК РФ и связан с зарегистрированным
            обозначением. Это редакционное правило страницы, а не замена
            юридической проверки статуса регистрации.
          </p>
        </div>
      </section>

      <section className="brand-section brand-next-section" id="next">
        <div className="brand-next-heading">
          <p className="brand-eyebrow">
            <span>03</span> Следующие главы
          </p>
          <h2>
            Брендбук растёт
            <br />
            <em>вместе с решениями.</em>
          </h2>
          <p>
            Здесь появятся только утверждённые правила — после того, как команда
            их сформулирует, проверит и зафиксирует.
          </p>
        </div>

        <div className="brand-next-grid">
          {nextChapters.map((chapter) => (
            <article
              className={`brand-next-card brand-next-card-${chapter.color}`}
              key={chapter.number}
            >
              <div>
                <span>{chapter.number}</span>
                <span>Следующая редакция</span>
              </div>
              <h3>{chapter.title}</h3>
              <p>{chapter.text}</p>
              <span className="brand-next-line" aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <footer className="brand-footer">
        <div className="brand-footer-top">
          <a href="#top" aria-label="Shidao, наверх">
            <Wordmark />
          </a>
          <p>
            Один бренд. Одно написание.
            <br />
            Один живой источник правил.
          </p>
        </div>
        <div className="brand-footer-bottom">
          <p>Живой брендбук команды. Версия 1.0 · 28 июля 2026</p>
          <nav aria-label="Ссылки Shidao">
            <a
              href="https://shidao.ru"
              target="_blank"
              rel="noopener noreferrer"
            >
              shidao.ru <ExternalLink size={12} aria-hidden="true" />
            </a>
            <a
              href="https://model.shidao.ru"
              target="_blank"
              rel="noopener noreferrer"
            >
              model.shidao.ru <ExternalLink size={12} aria-hidden="true" />
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
