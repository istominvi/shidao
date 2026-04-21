"use client";

import Image from "next/image";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type {
  MethodologyLessonStudentContentSection,
  ReusableAsset,
} from "@/lib/lesson-content";
import type { MethodologyLessonStep } from "@/lib/server/methodology-lesson-unified-read-model";
import { classNames } from "@/lib/ui/classnames";

const cjkFontFamily =
  '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Arial Unicode MS", system-ui, sans-serif';

type Props = {
  step: MethodologyLessonStep;
  assetsById: Record<string, ReusableAsset>;
  sections: MethodologyLessonStudentContentSection[];
};

type Animal = { id: "dog" | "cat" | "rabbit" | "horse"; hanzi: string; pinyin: string; meaning: string; image: string };
const animals: Animal[] = [
  { id: "dog", hanzi: "狗", pinyin: "gǒu", meaning: "собака", image: "/methodologies/world-around-me/lesson-1/visuals/dog-card.png" },
  { id: "cat", hanzi: "猫", pinyin: "māo", meaning: "кошка", image: "/methodologies/world-around-me/lesson-1/visuals/cat-card.png" },
  { id: "rabbit", hanzi: "兔子", pinyin: "tùzi", meaning: "кролик", image: "/methodologies/world-around-me/lesson-1/visuals/rabbit-card.png" },
  { id: "horse", hanzi: "马", pinyin: "mǎ", meaning: "лошадь", image: "/methodologies/world-around-me/lesson-1/visuals/horse-card.png" },
];

function assetUrl(asset?: ReusableAsset) {
  return asset?.fileRef ?? asset?.sourceUrl ?? null;
}

function isVideo(url: string) {
  return /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url);
}

export function isWorldAroundMeLessonOneCanonicalStep(stepId: string) {
  return stepId.startsWith("canonical-world-around-me-lesson-1-step-");
}

export function LessonOneStudentActivities({ step, assetsById, sections: _sections }: Props) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [sticks, setSticks] = useState(1);
  const [verb, setVerb] = useState<"跑" | "跳">("跑");
  const [animal, setAnimal] = useState<Animal["id"]>("dog");
  const [checkedWords, setCheckedWords] = useState<string[]>([]);
  const [appendix, setAppendix] = useState(1);
  const currentAnimal = animals[idx % animals.length] ?? animals[0];
  const chosenAnimal = animals.find((a) => a.id === animal) ?? animals[0];

  const stepNum = step.order;
  const baseCard = "mt-4 rounded-2xl border border-neutral-200 bg-white p-4 md:p-5";

  if (stepNum === 1) {
    const videoAsset = assetsById["video:farm-animals"];
    const video = assetUrl(videoAsset);
    const presentation = assetsById["presentation:world-around-me-lesson-1"];
    const slide = Array.isArray(presentation?.metadata?.slideImageRefs)
      ? presentation?.metadata?.slideImageRefs.find((v): v is string => typeof v === "string")
      : null;
    return (
      <div className={baseCard}>
        <p className="text-sm text-neutral-700">Смотри, слушай и повторяй животных.</p>
        {video && isVideo(video) ? <video controls preload="metadata" className="mt-3 w-full rounded-xl border border-sky-200 bg-black/90"><source src={video} /></video> : <p className="mt-3 text-sm text-neutral-600">Видео покажет преподаватель.</p>}
        {slide ? <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-sky-800">Презентация урока (только просмотр)</p><Image src={slide} alt="Презентация урока" width={1200} height={675} className="mt-2 h-auto w-full rounded-lg object-contain" /></div> : null}
      </div>
    );
  }

  if (stepNum === 2) {
    const picks = ["小龙", "小美", "我"] as const;
    return <div className={baseCard}><p style={{ fontFamily: cjkFontFamily }} className="text-4xl font-bold">我是…</p><p style={{ fontFamily: cjkFontFamily }} className="mt-2 text-3xl">你是谁？</p><div className="mt-4 flex flex-wrap gap-2">{picks.map((name) => <button key={name} type="button" onClick={() => setSelected(name)} className={classNames("rounded-xl border px-4 py-2 text-sm font-semibold", selected === name ? "border-violet-500 bg-violet-100 text-violet-900" : "border-neutral-300 bg-white text-neutral-800")}>{name === "小龙" ? "Сяо Лон" : name === "小美" ? "Сяо Мей" : "Я"}</button>)}</div>{selected ? <p style={{ fontFamily: cjkFontFamily }} className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-2xl font-semibold">我是{selected}。</p> : null}</div>;
  }

  if (stepNum === 3) {
    const a = currentAnimal;
    return <div className={baseCard}><div className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-700">Карточка {idx + 1} / 4</div><div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]"><div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><Image src={a.image} alt={a.meaning} width={420} height={320} className="mx-auto h-52 w-auto object-contain" /></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p style={{ fontFamily: cjkFontFamily }} className="text-6xl font-bold">{a.hanzi}</p><p className="mt-1 text-lg text-neutral-700">{a.pinyin}</p><p className="mt-1 text-lg font-semibold">{a.meaning}</p><p style={{ fontFamily: cjkFontFamily }} className="mt-3 text-2xl font-semibold text-amber-900">这是{a.hanzi}。</p></div></div><div className="mt-3 flex gap-2"><button type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" onClick={() => setIdx((p) => (p - 1 + 4) % 4)}>Назад</button><button type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" onClick={() => setIdx((p) => (p + 1) % 4)}>Следующая карточка</button></div></div>;
  }

  if (stepNum === 4) {
    const a = currentAnimal;
    return <div className={baseCard}><div className="grid gap-3 md:grid-cols-[1fr_1fr]"><Image src={a.image} alt={a.meaning} width={420} height={320} className="h-52 w-full rounded-2xl border border-neutral-200 bg-neutral-50 object-contain p-3" /><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p style={{ fontFamily: cjkFontFamily }} className="text-5xl font-bold">{a.hanzi}</p><p className="text-lg">{a.pinyin} · {a.meaning}</p><p className="mt-2 text-sm">{`Покажи ${a.meaning}`}</p><p style={{ fontFamily: cjkFontFamily }} className="mt-3 text-2xl font-semibold">我是{a.hanzi}。</p></div></div><button type="button" className="mt-3 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" onClick={() => setIdx((p) => (p + 1) % 4)}>Следующее животное</button></div>;
  }

  if (stepNum === 5) {
    return <div className={baseCard}><p className="text-sm text-neutral-700">Найди карточку, которую назвал преподаватель.</p><div className="mt-3 grid grid-cols-2 gap-3">{animals.map((a) => <button key={a.id} type="button" onClick={() => setSelected(a.id)} className={classNames("rounded-2xl border p-3 text-left", selected === a.id ? "border-sky-500 ring-2 ring-sky-200" : "border-neutral-200")}><Image src={a.image} alt={a.meaning} width={220} height={140} className="h-24 w-full object-contain" /><p style={{ fontFamily: cjkFontFamily }} className="mt-1 text-2xl font-semibold">{a.hanzi}</p></button>)}</div></div>;
  }

  if (stepNum === 6) {
    const numerals = ["一", "二", "三", "四", "五"];
    return <div className={baseCard}><p className="text-sm text-neutral-700">Считай до пяти вместе с преподавателем.</p><div className="mt-3 flex flex-wrap gap-2">{Array.from({ length: sticks }).map((_, i) => <span key={i} className="h-10 w-2 rounded-full bg-amber-500" />)}</div><p style={{ fontFamily: cjkFontFamily }} className="mt-3 text-3xl font-semibold">{numerals[sticks - 1]}</p><div className="mt-3 flex gap-2"><button type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" onClick={() => setSticks((v) => Math.max(1, v - 1))}>– палочка</button><button type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" onClick={() => setSticks((v) => Math.min(5, v + 1))}>+ палочка</button></div></div>;
  }

  if (stepNum === 7) {
    const pics = Array.from({ length: 10 }, (_, i) => `/methodologies/world-around-me/lesson-1/step7/step7_${i + 1}.png`);
    return <div className={baseCard}><p className="text-sm text-neutral-700">Сколько животных? Назови животное.</p><Image src={pics[appendix - 1] ?? pics[0]} alt={`Приложение 1 · ${appendix}`} width={1000} height={600} className="mt-3 h-auto w-full rounded-xl border border-sky-200 object-contain" /><div className="mt-3 flex flex-wrap gap-2">{pics.map((_, i) => <button key={i} type="button" onClick={() => setAppendix(i + 1)} className={classNames("rounded-full border px-3 py-1 text-xs", appendix === i + 1 ? "border-sky-500 bg-sky-100" : "border-neutral-300 bg-white")}>{i + 1}</button>)}</div></div>;
  }

  if (stepNum === 8) {
    return <div className={baseCard}><div className="grid gap-3 sm:grid-cols-2">{[{ term: "跑", pinyin: "pǎo", meaning: "бежать", phrase: "我们跑吧！" }, { term: "跳", pinyin: "tiào", meaning: "прыгать", phrase: "我们跳吧！" }].map((v) => <button key={v.term} type="button" onClick={() => setVerb(v.term as "跑" | "跳")} className={classNames("rounded-2xl border p-4 text-left transition", verb === v.term ? "border-emerald-500 bg-emerald-100" : "border-neutral-200 bg-white")}><p style={{ fontFamily: cjkFontFamily }} className="text-5xl font-bold">{v.term}</p><p className="text-lg">{v.pinyin} · {v.meaning}</p><p style={{ fontFamily: cjkFontFamily }} className={classNames("mt-2 text-2xl font-semibold", verb === v.term ? "animate-pulse" : "")}>{v.phrase}</p></button>)}</div></div>;
  }

  if (stepNum === 9) {
    const commands = ["跑到狗！", "跳到兔子！", "跑到马！", "跳到猫！"];
    return <div className={baseCard}><div className="flex flex-wrap gap-2">{commands.map((cmd) => <button key={cmd} type="button" onClick={() => setSelected(cmd)} className={classNames("rounded-xl border px-3 py-2 text-sm", selected === cmd ? "border-violet-500 bg-violet-100" : "border-neutral-300 bg-white")} style={{ fontFamily: cjkFontFamily }}>{cmd}</button>)}</div><div className="mt-3 grid grid-cols-2 gap-2">{animals.map((a) => {const active = selected?.includes(a.hanzi);return <div key={a.id} className={classNames("rounded-xl border p-2", active ? "border-violet-500 bg-violet-50" : "border-neutral-200")}><p style={{ fontFamily: cjkFontFamily }} className="text-2xl font-semibold">{a.hanzi}</p></div>;})}</div></div>;
  }

  if (stepNum === 10) {
    return <div className={baseCard}><p style={{ fontFamily: cjkFontFamily }} className="text-2xl font-semibold">狗在做什么？</p><div className="mt-3 flex flex-wrap gap-2">{animals.map((a) => <button key={a.id} type="button" onClick={() => setAnimal(a.id)} className={classNames("rounded-full border px-3 py-1", animal === a.id ? "border-sky-500 bg-sky-100" : "border-neutral-300 bg-white")} style={{ fontFamily: cjkFontFamily }}>{a.hanzi}</button>)}{(["跑", "跳"] as const).map((v) => <button key={v} type="button" onClick={() => setVerb(v)} className={classNames("rounded-full border px-3 py-1", verb === v ? "border-emerald-500 bg-emerald-100" : "border-neutral-300 bg-white")} style={{ fontFamily: cjkFontFamily }}>{v}</button>)}</div><p style={{ fontFamily: cjkFontFamily }} className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-3xl font-bold">{chosenAnimal.hanzi}在{verb}。</p></div>;
  }

  if (stepNum === 11) {
    const workbookAsset = assetsById["worksheet:workbook-pages-3-4"];
    const preview = typeof workbookAsset?.metadata?.previewImageRef === "string" ? workbookAsset.metadata.previewImageRef : "/methodologies/world-around-me/lesson-1/step11/step11.png";
    const url = assetUrl(workbookAsset);
    return <div className={baseCard}><p className="text-sm text-neutral-700">Раскрась животных и ответь: 这是什么？</p><Image src={preview} alt="Рабочая тетрадь 3–4" width={1000} height={700} className="mt-3 h-auto w-full rounded-xl border border-amber-200 object-contain" />{url ? <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Открыть просмотр</a> : null}</div>;
  }

  if (stepNum === 12) {
    return <div className={baseCard}><div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-center"><p style={{ fontFamily: cjkFontFamily }} className="text-7xl font-bold">农场</p><p className="mt-2 text-2xl">nóngchǎng</p><p className="text-xl">ферма</p><p className="mt-2 text-sm">Повтори слово 农场.</p><Image src="/methodologies/world-around-me/lesson-1/visuals/farm-barn.png" alt="Ферма" width={500} height={300} className="mx-auto mt-3 h-36 w-auto object-contain" /></div></div>;
  }

  if (stepNum === 13) {
    return <div className={baseCard}><p className="text-sm text-neutral-700">Выбери животное и поселим его на ферме.</p><Image src="/methodologies/world-around-me/lesson-1/visuals/farm-barn.png" alt="Ферма" width={900} height={500} className="mt-3 h-48 w-full rounded-xl border border-amber-200 object-contain" /><div className="mt-3 flex flex-wrap gap-2">{animals.map((a) => <button key={a.id} type="button" onClick={() => setAnimal(a.id)} className={classNames("rounded-full border px-3 py-1", animal === a.id ? "border-amber-500 bg-amber-100" : "border-neutral-300 bg-white")} style={{ fontFamily: cjkFontFamily }}>{a.hanzi}</button>)}</div><p style={{ fontFamily: cjkFontFamily }} className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-2xl font-semibold">{chosenAnimal.hanzi}{chosenAnimal.hanzi === "猫" ? "住在农场里。" : "在农场里。"}</p></div>;
  }

  if (stepNum === 14) {
    const song = assetUrl(assetsById["song:farm-animals"]);
    const songVideo = assetUrl(assetsById["song-video:farm-animals-movement"]);
    return <div className={baseCard}><p className="text-sm text-neutral-700">Слушай, пой и показывай движения.</p>{song ? <audio controls preload="none" className="mt-3 w-full"><source src={song} /></audio> : <p className="mt-2 text-sm text-neutral-600">Аудио покажет преподаватель.</p>}{songVideo && isVideo(songVideo) ? <video controls preload="metadata" className="mt-3 w-full rounded-xl border border-rose-200 bg-black/90"><source src={songVideo} /></video> : <p className="mt-2 text-sm text-neutral-600">Видео движений пока недоступно.</p>}</div>;
  }

  const words = ["狗", "猫", "兔子", "马", "农场", "跑", "跳"];
  return <div className={baseCard}><p className="text-sm text-neutral-700">Нажми на слова, которые запомнил(а).</p><div className="mt-3 flex flex-wrap gap-2">{words.map((word) => {const active = checkedWords.includes(word);return <button key={word} type="button" onClick={() => setCheckedWords((prev) => prev.includes(word) ? prev.filter((v) => v !== word) : [...prev, word])} className={classNames("inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm", active ? "border-emerald-500 bg-emerald-100 text-emerald-900" : "border-neutral-300 bg-white")} style={{ fontFamily: cjkFontFamily }}>{word}{active ? <CheckCircle2 className="h-4 w-4" /> : null}</button>;})}</div><div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-5 text-center"><p style={{ fontFamily: cjkFontFamily }} className="text-5xl font-bold text-sky-900">再见！</p><p className="mt-2 text-sm text-sky-900">До встречи на следующем уроке.</p></div></div>;
}
