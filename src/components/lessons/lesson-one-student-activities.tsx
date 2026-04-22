"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Volume2 } from "lucide-react";
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
  fullscreen?: boolean;
};

type Animal = {
  id: "dog" | "cat" | "rabbit" | "horse";
  hanzi: string;
  pinyin: string;
  meaning: string;
  image: string;
  pronunciationId: string;
};

const animals: Animal[] = [
  { id: "dog", hanzi: "狗", pinyin: "gǒu", meaning: "собака", image: "/methodologies/world-around-me/lesson-1/visuals/dog-card.png", pronunciationId: "pronunciation:dog" },
  { id: "cat", hanzi: "猫", pinyin: "māo", meaning: "кошка", image: "/methodologies/world-around-me/lesson-1/visuals/cat-card.png", pronunciationId: "pronunciation:cat" },
  { id: "rabbit", hanzi: "兔子", pinyin: "tùzi", meaning: "кролик", image: "/methodologies/world-around-me/lesson-1/visuals/rabbit-card.png", pronunciationId: "pronunciation:rabbit" },
  { id: "horse", hanzi: "马", pinyin: "mǎ", meaning: "лошадь", image: "/methodologies/world-around-me/lesson-1/visuals/horse-card.png", pronunciationId: "pronunciation:horse" },
];

const lessonWords = ["狗", "猫", "兔子", "马", "农场", "跑", "跳", "我是…", "这是…", "在…里"];
const animalClipById: Record<Animal["id"], string> = {
  dog: "video-clip:farm-animals-dog",
  cat: "video-clip:farm-animals-cat",
  rabbit: "video-clip:farm-animals-rabbit",
  horse: "video-clip:farm-animals-horse",
};

function assetUrl(asset?: ReusableAsset) {
  return asset?.fileRef ?? asset?.sourceUrl ?? null;
}

function isVideo(url: string) {
  return /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url);
}

function AudioButton({ asset, label = "Слушать" }: { asset?: ReusableAsset; label?: string }) {
  const url = assetUrl(asset);
  if (!url) return null;
  return (
    <audio controls preload="none" className="w-full max-w-sm">
      <source src={url} />
      {label}
    </audio>
  );
}

function resolveCardImage(asset?: ReusableAsset, fallback?: string) {
  const refs = asset?.metadata?.cardImageRefs;
  if (Array.isArray(refs)) {
    const first = refs.find((item): item is string => typeof item === "string" && item.length > 0);
    if (first) return first;
  }
  return fallback ?? "/methodologies/world-around-me/lesson-1/visuals/farm-barn.png";
}

function StepShell({ children, fullscreen = false }: { children: ReactNode; fullscreen?: boolean }) {
  return (
    <div
      className={classNames(
        "mt-4 rounded-3xl border border-emerald-100 bg-gradient-to-b from-emerald-50/60 via-white to-amber-50/40 p-4 md:p-6",
        fullscreen ? "p-3 md:p-4" : "",
      )}
    >
      {children}
    </div>
  );
}

export function isWorldAroundMeLessonOneCanonicalStep(stepId: string) {
  return stepId.startsWith("canonical-world-around-me-lesson-1-step-");
}

export function LessonOneStudentActivities({
  step,
  assetsById,
  sections: _sections,
  fullscreen = false,
}: Props) {
  const [animalIndex, setAnimalIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [sticks, setSticks] = useState(1);
  const [verb, setVerb] = useState<"跑" | "跳">("跑");
  const [chosenAnimalId, setChosenAnimalId] = useState<Animal["id"]>("dog");
  const [checkedWords, setCheckedWords] = useState<string[]>([]);
  const [selectedClip, setSelectedClip] = useState<Animal["id"]>("dog");

  const activeAnimal = animals[animalIndex % animals.length] ?? animals[0];
  const chosenAnimal = animals.find((item) => item.id === chosenAnimalId) ?? animals[0];
  const numerals = ["一", "二", "三", "四", "五"];

  const orderedClips = useMemo(
    () =>
      animals.map((animal) => ({
        animal,
        src: assetUrl(assetsById[animalClipById[animal.id]]) ?? null,
      })),
    [assetsById],
  );

  if (step.order === 1) {
    return (
      <StepShell fullscreen={fullscreen}>
        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5">
            <p style={{ fontFamily: cjkFontFamily }} className="text-6xl font-extrabold text-sky-900">你好！</p>
            <p className="mt-2 text-lg font-semibold text-sky-900">Поздороваемся и отправимся на ферму.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {animals.map((animal) => (
                <span key={animal.id} className="rounded-full border border-sky-300 bg-white px-3 py-1 text-sm font-semibold text-sky-800">
                  <span style={{ fontFamily: cjkFontFamily }}>{animal.hanzi}</span> · {animal.meaning}
                </span>
              ))}
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">农场 · ферма</span>
            </div>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
            <Image
              src="/methodologies/world-around-me/lesson-1/visuals/hero-farm.png"
              alt="Сяо Лон и Сяо Мей"
              width={420}
              height={320}
              className="h-56 w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      </StepShell>
    );
  }

  if (step.order === 2) {
    const mainVideo = assetUrl(assetsById["video:farm-animals"]);
    const activeClip = orderedClips.find((clip) => clip.animal.id === selectedClip);
    const activeVideo = activeClip?.src ?? mainVideo;

    return (
      <StepShell fullscreen={fullscreen}>
        {activeVideo && isVideo(activeVideo) ? (
          <video controls preload="metadata" className="w-full rounded-2xl border border-sky-200 bg-black/90">
            <source src={activeVideo} />
          </video>
        ) : (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-700">Видео покажет преподаватель.</p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {orderedClips.map(({ animal }) => (
            <button
              key={animal.id}
              type="button"
              onClick={() => setSelectedClip(animal.id)}
              className={classNames(
                "rounded-2xl border px-3 py-2 text-left",
                selectedClip === animal.id ? "border-sky-500 bg-sky-100" : "border-neutral-300 bg-white",
              )}
            >
              <p style={{ fontFamily: cjkFontFamily }} className="text-2xl font-bold">{animal.hanzi}</p>
              <p className="text-xs text-neutral-700">{animal.pinyin} · {animal.meaning}</p>
            </button>
          ))}
        </div>
      </StepShell>
    );
  }

  if (step.order === 3) {
    const picks = ["小龙", "小美", "我", "狗", "猫", "兔子", "马"] as const;
    return (
      <StepShell fullscreen={fullscreen}>
        <p style={{ fontFamily: cjkFontFamily }} className="text-3xl font-bold">你是谁？</p>
        <p style={{ fontFamily: cjkFontFamily }} className="mt-1 text-5xl font-extrabold text-violet-900">我是…</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {picks.map((item) => (
            <button key={item} type="button" onClick={() => setSelected(item)} className={classNames("rounded-xl border px-4 py-2 text-sm font-semibold", selected === item ? "border-violet-500 bg-violet-100 text-violet-900" : "border-neutral-300 bg-white text-neutral-800")}>
              {item}
            </button>
          ))}
        </div>
        {selected ? <p style={{ fontFamily: cjkFontFamily }} className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-3xl font-bold">我是{selected}。</p> : null}
        <div className="mt-3"><AudioButton asset={assetsById["pronunciation:wo-shi"]} /></div>
      </StepShell>
    );
  }

  if (step.order === 4) {
    return (
      <StepShell fullscreen={fullscreen}>
        <div className="grid gap-3 md:grid-cols-2">
          {animals.map((animal) => (
            <article key={animal.id} className="rounded-2xl border border-amber-200 bg-white p-4">
              <Image src={animal.image} alt={animal.meaning} width={360} height={220} className="h-36 w-full rounded-xl object-contain" />
              <p style={{ fontFamily: cjkFontFamily }} className="mt-2 text-4xl font-bold">{animal.hanzi}</p>
              <p className="text-sm text-neutral-700">{animal.pinyin} · {animal.meaning}</p>
              <p style={{ fontFamily: cjkFontFamily }} className="mt-2 text-2xl font-semibold text-amber-900">这是{animal.hanzi}。</p>
              <div className="mt-2"><AudioButton asset={assetsById[animal.pronunciationId]} /></div>
            </article>
          ))}
        </div>
        <div className="mt-3"><AudioButton asset={assetsById["pronunciation:zhe-shi"]} /></div>
      </StepShell>
    );
  }

  if (step.order === 5) {
    return (
      <StepShell fullscreen={fullscreen}>
        <p className="text-sm font-semibold text-neutral-700">Покажи животное</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
          <Image src={activeAnimal.image} alt={activeAnimal.meaning} width={420} height={320} className="h-52 w-full rounded-2xl border border-neutral-200 bg-white object-contain p-3" />
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p style={{ fontFamily: cjkFontFamily }} className="text-5xl font-extrabold">{activeAnimal.hanzi}</p>
            <p className="text-lg">{activeAnimal.pinyin} · {activeAnimal.meaning}</p>
            <p style={{ fontFamily: cjkFontFamily }} className="mt-3 text-3xl font-bold">我是{activeAnimal.hanzi}。</p>
          </div>
        </div>
        <button type="button" className="mt-3 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold" onClick={() => setAnimalIndex((prev) => (prev + 1) % animals.length)}>Следующее животное</button>
      </StepShell>
    );
  }

  if (step.order === 6) {
    return (
      <StepShell fullscreen={fullscreen}>
        <p className="text-sm text-neutral-700">Слушай слово и попади в карточку.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {animals.map((animal) => (
            <button key={animal.id} type="button" onClick={() => setSelected(animal.id)} className={classNames("rounded-2xl border p-3 text-left", selected === animal.id ? "border-sky-500 bg-sky-100" : "border-neutral-200 bg-white")}>
              <p style={{ fontFamily: cjkFontFamily }} className="text-3xl font-bold">{animal.hanzi}</p>
              <p className="text-sm">{animal.meaning}</p>
            </button>
          ))}
        </div>
        {selected ? <p style={{ fontFamily: cjkFontFamily }} className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-2xl font-semibold">命中！这是{animals.find((animal) => animal.id === selected)?.hanzi ?? "狗"}。</p> : null}
      </StepShell>
    );
  }

  if (step.order === 7) {
    return (
      <StepShell fullscreen={fullscreen}>
        <p className="text-sm text-neutral-700">Считай 1–5 вместе с палочками.</p>
        <div className="mt-3 flex min-h-14 flex-wrap items-end gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          {Array.from({ length: sticks }).map((_, index) => (
            <span key={index} className="h-11 w-2 rounded-full bg-amber-500" />
          ))}
        </div>
        <p style={{ fontFamily: cjkFontFamily }} className="mt-3 text-5xl font-extrabold text-amber-900">{numerals[sticks - 1]}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" onClick={() => setSticks((value) => Math.max(1, value - 1))}>−</button>
          <button type="button" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" onClick={() => setSticks((value) => Math.min(5, value + 1))}>+</button>
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" onClick={() => setSticks(value)} className={classNames("rounded-full border px-3 py-1 text-sm", sticks === value ? "border-amber-500 bg-amber-100" : "border-neutral-300 bg-white")}>{value}</button>
          ))}
        </div>
      </StepShell>
    );
  }

  if (step.order === 8) {
    const appendix = assetsById["worksheet:appendix-1"];
    const preview = typeof appendix?.metadata?.previewImageRef === "string" ? appendix.metadata.previewImageRef : null;
    const appendixUrl = assetUrl(appendix);
    return (
      <StepShell fullscreen={fullscreen}>
        <p className="text-sm text-neutral-700">Покажи, посчитай и назови животных.</p>
        {preview ? <Image src={preview} alt="Приложение 1" width={1100} height={680} className="mt-3 h-auto w-full rounded-2xl border border-sky-200 bg-white object-contain" /> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {["一只狗", "两只猫", "三只兔子", "四匹马", "五只动物"].map((chip) => (
            <span key={chip} className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-sm" style={{ fontFamily: cjkFontFamily }}>{chip}</span>
          ))}
        </div>
        {appendixUrl ? <a href={appendixUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-900">Открыть приложение 1</a> : null}
      </StepShell>
    );
  }

  if (step.order === 9) {
    return (
      <StepShell fullscreen={fullscreen}>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { term: "跑", pinyin: "pǎo", meaning: "бежать", phrase: "我们跑吧！", assetId: "pronunciation:run" },
            { term: "跳", pinyin: "tiào", meaning: "прыгать", phrase: "我们跳吧！", assetId: "pronunciation:jump" },
          ].map((item) => (
            <button key={item.term} type="button" onClick={() => setVerb(item.term as "跑" | "跳")} className={classNames("rounded-2xl border p-4 text-left", verb === item.term ? "border-emerald-500 bg-emerald-100" : "border-neutral-200 bg-white")}>
              <p style={{ fontFamily: cjkFontFamily }} className="text-5xl font-bold">{item.term}</p>
              <p className="text-lg">{item.pinyin} · {item.meaning}</p>
              <p style={{ fontFamily: cjkFontFamily }} className={classNames("mt-2 text-2xl font-semibold", verb === item.term ? "animate-pulse" : "")}>{item.phrase}</p>
              <div className="mt-2"><AudioButton asset={assetsById[item.assetId]} /></div>
            </button>
          ))}
        </div>
      </StepShell>
    );
  }

  if (step.order === 10) {
    const commands = ["跑到狗！", "跳到兔子！", "跑到马！", "跳到猫！"];
    return (
      <StepShell fullscreen={fullscreen}>
        <div className="flex flex-wrap gap-2">
          {commands.map((command) => (
            <button key={command} type="button" onClick={() => setSelected(command)} className={classNames("rounded-xl border px-3 py-2 text-sm", selected === command ? "border-violet-500 bg-violet-100" : "border-neutral-300 bg-white")} style={{ fontFamily: cjkFontFamily }}>{command}</button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {animals.map((animal) => {
            const active = selected?.includes(animal.hanzi);
            return (
              <div key={animal.id} className={classNames("rounded-xl border p-2", active ? "border-violet-500 bg-violet-50" : "border-neutral-200 bg-white")}>
                <p style={{ fontFamily: cjkFontFamily }} className="text-3xl font-bold">{animal.hanzi}</p>
                <p className="text-xs">{animal.meaning}</p>
              </div>
            );
          })}
        </div>
      </StepShell>
    );
  }

  if (step.order === 11) {
    const questionAnimal = selected ? animals.find((animal) => animal.id === selected) : undefined;
    const subject = questionAnimal ?? chosenAnimal;
    return (
      <StepShell fullscreen={fullscreen}>
        <p style={{ fontFamily: cjkFontFamily }} className="text-3xl font-semibold">{subject.hanzi}在做什么？</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {animals.map((animal) => (
            <button key={animal.id} type="button" onClick={() => setSelected(animal.id)} className={classNames("rounded-full border px-3 py-1", selected === animal.id ? "border-sky-500 bg-sky-100" : "border-neutral-300 bg-white")} style={{ fontFamily: cjkFontFamily }}>{animal.hanzi}</button>
          ))}
          {(["跑", "跳"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setVerb(item)} className={classNames("rounded-full border px-3 py-1", verb === item ? "border-emerald-500 bg-emerald-100" : "border-neutral-300 bg-white")} style={{ fontFamily: cjkFontFamily }}>{item}</button>
          ))}
        </div>
        <p style={{ fontFamily: cjkFontFamily }} className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-3xl font-bold">{subject.hanzi}在{verb}。</p>
      </StepShell>
    );
  }

  if (step.order === 12) {
    const workbook = assetsById["worksheet:workbook-pages-3-4"];
    const preview = typeof workbook?.metadata?.previewImageRef === "string" ? workbook.metadata.previewImageRef : null;
    const workbookUrl = assetUrl(workbook);
    return (
      <StepShell fullscreen={fullscreen}>
        <p style={{ fontFamily: cjkFontFamily }} className="text-2xl font-semibold">这是什么？</p>
        {preview ? <Image src={preview} alt="Рабочая тетрадь 3-4" width={1000} height={700} className="mt-3 h-auto w-full rounded-2xl border border-amber-200 object-contain" /> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {animals.map((animal) => (
            <button key={animal.id} type="button" className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm" style={{ fontFamily: cjkFontFamily }}>{animal.hanzi}</button>
          ))}
        </div>
        {workbookUrl ? <a href={workbookUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900">Открыть тетрадь</a> : null}
      </StepShell>
    );
  }

  if (step.order === 13) {
    const farmCard = resolveCardImage(assetsById["flashcards:world-around-me-lesson-1"], "/methodologies/world-around-me/lesson-1/visuals/farm-barn.png");
    return (
      <StepShell fullscreen={fullscreen}>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-center">
          <p style={{ fontFamily: cjkFontFamily }} className="text-7xl font-extrabold">农场</p>
          <p className="mt-2 text-2xl">nóngchǎng · ферма</p>
          <p style={{ fontFamily: cjkFontFamily }} className="mt-3 text-3xl font-semibold">这是农场。</p>
          <Image src={farmCard} alt="Ферма" width={600} height={380} className="mx-auto mt-3 h-44 w-auto rounded-2xl object-contain" />
          <div className="mt-3 flex justify-center"><AudioButton asset={assetsById["pronunciation:farm"]} /></div>
        </div>
      </StepShell>
    );
  }

  if (step.order === 14) {
    return (
      <StepShell fullscreen={fullscreen}>
        <p className="text-sm text-neutral-700">Выбери животное и построй фразу с 在…里.</p>
        <Image src="/methodologies/world-around-me/lesson-1/visuals/farm-barn.png" alt="Игрушечная ферма" width={900} height={500} className="mt-3 h-52 w-full rounded-2xl border border-amber-200 bg-white object-contain" />
        <div className="mt-3 flex flex-wrap gap-2">
          {animals.map((animal) => (
            <button key={animal.id} type="button" onClick={() => setChosenAnimalId(animal.id)} className={classNames("rounded-full border px-3 py-1", chosenAnimalId === animal.id ? "border-amber-500 bg-amber-100" : "border-neutral-300 bg-white")} style={{ fontFamily: cjkFontFamily }}>{animal.hanzi}</button>
          ))}
        </div>
        <p style={{ fontFamily: cjkFontFamily }} className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-3xl font-bold">{chosenAnimal.hanzi}在农场里。</p>
        <p style={{ fontFamily: cjkFontFamily }} className="mt-2 text-xl font-semibold text-amber-900">猫住在农场里。</p>
        <div className="mt-2"><AudioButton asset={assetsById["pronunciation:zai"]} /></div>
      </StepShell>
    );
  }

  if (step.order === 15) {
    const song = assetUrl(assetsById["song:farm-animals"]);
    const songVideo = assetUrl(assetsById["song-video:farm-animals-movement"]);
    return (
      <StepShell fullscreen={fullscreen}>
        <p className="text-sm text-neutral-700">Слушай, пой и показывай животных.</p>
        {song ? <audio controls preload="none" className="mt-3 w-full"><source src={song} /></audio> : null}
        {songVideo && isVideo(songVideo) ? <video controls preload="metadata" className="mt-3 w-full rounded-2xl border border-rose-200 bg-black/90"><source src={songVideo} /></video> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {animals.map((animal) => (
            <span key={animal.id} className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-sm" style={{ fontFamily: cjkFontFamily }}>{animal.hanzi}</span>
          ))}
        </div>
      </StepShell>
    );
  }

  if (step.order === 16) {
    return (
      <StepShell fullscreen={fullscreen}>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-5 text-center">
          <p style={{ fontFamily: cjkFontFamily }} className="text-6xl font-extrabold text-sky-900">再见！</p>
          <p className="mt-2 text-lg font-semibold text-sky-900">До встречи!</p>
        </div>
        <p className="mt-3 text-sm text-neutral-700">Отметь, что ты запомнил(а):</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {lessonWords.map((word) => {
            const active = checkedWords.includes(word);
            return (
              <button
                key={word}
                type="button"
                onClick={() => setCheckedWords((prev) => (prev.includes(word) ? prev.filter((item) => item !== word) : [...prev, word]))}
                className={classNames("inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm", active ? "border-emerald-500 bg-emerald-100 text-emerald-900" : "border-neutral-300 bg-white")}
                style={{ fontFamily: cjkFontFamily }}
              >
                {word}
                {active ? <CheckCircle2 className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell fullscreen={fullscreen}>
      <p className="text-sm text-neutral-700">Слушай преподавателя и выполняй задание шага.</p>
      <Volume2 className="mt-3 h-6 w-6 text-neutral-500" aria-hidden="true" />
    </StepShell>
  );
}
