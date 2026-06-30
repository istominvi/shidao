import assert from "node:assert/strict";
import test from "node:test";
import {
  lessonContentFixtureAssets,
  lessonContentFixtureMethodologyLesson,
  lessonContentFixtureMethodologyLessonFour,
  lessonContentFixtureMethodologyLessonStudentContent,
  lessonContentFixtureMethodologyLessonStudentContentLessonFour,
} from "../../lesson-content";
import { buildMethodologyLessonUnifiedReadModel } from "../methodology-lesson-unified-read-model";

function buildPresentationFlow() {
  const assetsById = Object.fromEntries(
    lessonContentFixtureAssets.map((asset) => [asset.id, asset]),
  );

  return lessonContentFixtureMethodologyLesson.blocks
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((block) => ({
      id: block.id,
      order: block.order,
      stepLabel: `Шаг ${block.order}`,
      blockLabel: block.blockType,
      accentTone: "sky" as const,
      title: block.title ?? `Шаг ${block.order}`,
      description: undefined,
      teacherActions: [],
      studentActions: [],
      materials: [],
      resources: block.assetRefs.map((ref) => ({
        title: assetsById[ref.id]?.title ?? ref.id,
        kindLabel: ref.kind,
        url: assetsById[ref.id]?.sourceUrl,
      })),
    }));
}

function buildPresentationFlowForLessonFour() {
  const assetsById = Object.fromEntries(
    lessonContentFixtureAssets.map((asset) => [asset.id, asset]),
  );

  return lessonContentFixtureMethodologyLessonFour.blocks
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((block) => ({
      id: block.id,
      order: block.order,
      stepLabel: `Шаг ${block.order}`,
      blockLabel:
        block.blockType === "materials_prep"
          ? "Подготовка материалов"
          : "Этап урока",
      accentTone: "sky" as const,
      title: block.title ?? `Шаг ${block.order}`,
      description: undefined,
      teacherActions: ["Провести шаг по плану."],
      studentActions: ["Выполняют задание шага."],
      materials: [],
      resources: block.assetRefs.map((ref) => ({
        title: assetsById[ref.id]?.title ?? ref.id,
        kindLabel: ref.kind,
        url: assetsById[ref.id]?.sourceUrl,
      })),
      studentComponentKey:
        typeof (block.content as { student?: { componentKey?: unknown } })
          .student?.componentKey === "string"
          ? (block.content as { student: { componentKey: string } }).student
              .componentKey
          : undefined,
      studentInstruction:
        typeof (block.content as { student?: { instruction?: unknown } })
          .student?.instruction === "string"
          ? (block.content as { student: { instruction: string } }).student
              .instruction
          : undefined,
      studentPayload: (
        block.content as { student?: { payload?: Record<string, unknown> } }
      ).student?.payload,
    }));
}

test("world-around-me lesson 1 unified read model keeps canonical 15-step mapping", () => {
  const assetsById = Object.fromEntries(
    lessonContentFixtureAssets.map((asset) => [asset.id, asset]),
  );

  const unified = buildMethodologyLessonUnifiedReadModel({
    lessonId: lessonContentFixtureMethodologyLesson.id,
    lessonShell: lessonContentFixtureMethodologyLesson.shell,
    presentation: {
      quickSummary: {
        prepChecklist: ["Карточки", "Приложение 1"],
        keyWords: lessonContentFixtureMethodologyLesson.shell.vocabularySummary,
        keyPhrases: lessonContentFixtureMethodologyLesson.shell.phraseSummary,
        resources: [],
      },
      lessonFlow: buildPresentationFlow(),
    },
    studentContent: lessonContentFixtureMethodologyLessonStudentContent,
    assetsById,
    canonicalHomework: null,
  });

  assert.equal(unified.steps.length, 15);
  assert.equal(
    unified.steps.some((step) => step.title === "Подготовка до урока"),
    false,
  );

  for (const step of unified.steps) {
    assert.equal(step.title, step.student.title);
    assert.equal(
      Boolean(step.student.instruction && step.student.instruction.trim()),
      true,
    );
  }

  const step1 = unified.steps[0];
  assert.equal(step1.title, "Смотрим видео «farm animals»");
  assert.equal(step1.student.screenType, "video");
  assert.equal(step1.student.componentKey, "lesson_one_custom_v1");
  assert.equal(step1.resourceIds?.includes("video:farm-animals"), true);
  assert.equal(step1.resourceIds?.includes("song:farm-animals"), false);

  const step7 = unified.steps[6];
  assert.equal(
    step7.title,
    "Приложение 1: указываем, считаем и называем животных",
  );
  assert.equal(step7.student.componentKey, "lesson_one_custom_v1");
  assert.equal(step7.student.payload?.sections?.[0]?.type, "count_board");
  assert.equal(
    step7.student.instruction?.toLowerCase().includes("считай"),
    true,
  );
  assert.equal(step7.resourceIds?.includes("worksheet:appendix-1"), true);

  const step8 = unified.steps[7];
  assert.equal(step8.title, "Учим глаголы 跑，跳");
  assert.equal(step8.student.payload?.sections?.[0]?.type, "action_cards");

  const step14 = unified.steps[13];
  assert.equal(step14.title, "Поём песню «Животные на ферме»");
  assert.equal(step14.resourceIds?.includes("song:farm-animals"), true);
  assert.equal(step14.resourceIds?.includes("video:farm-animals"), false);
  assert.equal(
    step14.resourceIds?.includes("song-video:farm-animals-movement"),
    true,
  );

  const assignedSectionKeys = unified.steps.flatMap((step) =>
    (step.student.payload?.sections ?? []).map(
      (section) => `${section.sceneId ?? ""}|${section.type}|${section.title}`,
    ),
  );
  assert.equal(new Set(assignedSectionKeys).size, assignedSectionKeys.length);

  const step12 = unified.steps[11];
  assert.equal(step12.student.payload?.sections?.[0]?.type, "word_list");
  const step12Words =
    step12.student.payload?.sections?.[0]?.type === "word_list"
      ? step12.student.payload.sections[0].groups.flatMap((group) =>
          group.entries.map((entry) => entry.hanzi),
        )
      : [];
  assert.deepEqual(step12Words, ["农场"]);

  const step5 = unified.steps[4];
  assert.equal(step5.student.payload?.sections?.[0]?.type, "matching_practice");
  const step5Section = step5.student.payload?.sections?.[0];
  const step5Text =
    step5Section && step5Section.type === "matching_practice"
      ? `${step5Section.title ?? ""} ${step5Section.subtitle ?? ""} ${step5Section.prompt ?? ""}`
      : "";
  assert.equal(step5Text.toLowerCase().includes("homework"), false);

  const totalMinutes = unified.steps.reduce(
    (acc, step) => acc + (step.durationMinutes ?? 0),
    0,
  );
  assert.equal(totalMinutes >= 43 && totalMinutes <= 47, true);

  for (const step of unified.steps) {
    assert.equal((step.teacher.teacherActions?.length ?? 0) > 0, true);
    assert.equal((step.teacher.studentActions?.length ?? 0) > 0, true);
    assert.equal((step.teacher.teacherScript?.length ?? 0) > 0, true);
    assert.equal((step.teacher.materials?.length ?? 0) > 0, true);
    assert.equal((step.teacher.successCriteria?.length ?? 0) > 0, true);
    assert.equal(
      step.teacher.notes?.some((note) =>
        note.includes("Педагогические детали будут уточнены"),
      ) ?? false,
      false,
    );
    assert.equal(step.movementMode == null, false);
  }

  const lessonOneTeacherText = unified.steps
    .map((step) =>
      [
        step.teacher.goal,
        step.teacher.description,
        ...step.teacher.teacherActions,
        ...step.teacher.studentActions,
        ...(step.teacher.teacherScript ?? []),
        ...(step.teacher.expectedResponses ?? []),
        ...step.teacher.materials,
        ...(step.teacher.successCriteria ?? []),
        ...(step.teacher.notes ?? []),
      ]
        .filter((chunk): chunk is string => Boolean(chunk))
        .join(" "),
    )
    .join(" ")
    .toLowerCase();

  assert.equal(lessonOneTeacherText.includes("cow"), false);
  assert.equal(lessonOneTeacherText.includes("pig"), false);
  assert.equal(lessonOneTeacherText.includes("three cows"), false);
  assert.equal(lessonOneTeacherText.includes("where is horse"), false);
  assert.equal(lessonOneTeacherText.includes("put cow"), false);

  assert.equal(lessonOneTeacherText.includes("狗"), true);
  assert.equal(lessonOneTeacherText.includes("猫"), true);
  assert.equal(lessonOneTeacherText.includes("兔子"), true);
  assert.equal(lessonOneTeacherText.includes("马"), true);
  assert.equal(lessonOneTeacherText.includes("农场"), true);
  assert.equal(lessonOneTeacherText.includes("показывает动作"), false);
  assert.equal(lessonOneTeacherText.includes("показывает движения"), true);
});

test("world-around-me step mapping keeps phrase scene single-use and avoids duplicate section reuse", () => {
  const readModel = buildMethodologyLessonUnifiedReadModel({
    lessonId: "lesson-1",
    lessonShell: {
      id: "lesson-1",
      methodologyId: "m1",
      title: "Урок 1",
      position: { moduleIndex: 1, lessonIndex: 1 },
      vocabularySummary: [],
      phraseSummary: [],
      estimatedDurationMinutes: 45,
      mediaSummary: { videos: 0, songs: 0, worksheets: 0, other: 0 },
      readinessStatus: "ready",
    },
    presentation: {
      quickSummary: {
        prepChecklist: [],
        keyWords: [],
        keyPhrases: [],
        resources: [],
      },
      lessonFlow: Array.from({ length: 15 }, (_, i) => ({
        id: `s${i + 1}`,
        order: i + 1,
        stepLabel: `Шаг ${i + 1}`,
        blockLabel: "intro",
        accentTone: "sky" as const,
        title: `Step ${i + 1}`,
        teacherActions: [],
        studentActions: [],
        materials: [],
        resources: [],
      })),
    },
    studentContent: {
      id: "sc-1",
      methodologyLessonId: "lesson-1",
      title: "Student",
      sections: [
        {
          type: "lesson_focus",
          title: "intro",
          body: "b",
          chips: [],
          sceneId: "scene-hero",
        },
        {
          type: "presentation",
          title: "slides",
          sceneId: "scene-presentation",
          assetId: "presentation:world-around-me-lesson-1",
        },
        {
          type: "phrase_cards",
          title: "dup",
          sceneId: "scene-phrases",
          items: [{ phrase: "我是", meaning: "я" }],
        },
        {
          type: "phrase_cards",
          title: "dup-2",
          sceneId: "scene-phrases",
          items: [{ phrase: "这是", meaning: "это" }],
        },
      ],
    },
    assetsById: {},
    canonicalHomework: null,
  });

  assert.equal(readModel.steps[1]?.student.screenType, "phrase_practice");
  assert.equal(
    readModel.steps[1]?.student.componentKey,
    "lesson_one_custom_v1",
  );
  assert.equal(readModel.steps[9]?.student.screenType, "placeholder");
  assert.equal(
    readModel.steps[9]?.student.componentKey,
    "lesson_one_custom_v1",
  );
});

test("generic read model keeps simple student component routing from lesson flow", () => {
  const readModel = buildMethodologyLessonUnifiedReadModel({
    lessonId: "lesson-4",
    lessonShell: {
      id: "lesson-4",
      methodologyId: "m1",
      title: "Урок 4",
      position: { moduleIndex: 1, lessonIndex: 4 },
      vocabularySummary: [],
      phraseSummary: [],
      estimatedDurationMinutes: 45,
      mediaSummary: { videos: 0, songs: 0, worksheets: 0, other: 0 },
      readinessStatus: "ready",
    },
    presentation: {
      quickSummary: {
        prepChecklist: [],
        keyWords: [],
        keyPhrases: [],
        resources: [],
      },
      lessonFlow: [
        {
          id: "lesson-4-step-1",
          order: 1,
          stepLabel: "Шаг 1",
          blockLabel: "Активность",
          accentTone: "sky" as const,
          title: "Собираем сцену",
          teacherActions: ["Запускает интерактив."],
          studentActions: ["Выбирают карточки."],
          materials: [],
          resources: [],
          studentComponentKey: "scene_builder_v1",
          studentInstruction: "Выбери карточки и собери сцену.",
          studentPayload: {
            cards: ["red", "blue"],
          },
        },
      ],
    },
    studentContent: null,
    assetsById: {},
    canonicalHomework: null,
  });

  const step = readModel.steps[0];
  assert.equal(step?.student.componentKey, "scene_builder_v1");
  assert.equal(step?.student.instruction, "Выбери карточки и собери сцену.");
  assert.deepEqual(step?.student.payload?.data, { cards: ["red", "blue"] });
  assert.equal(step?.student.allowStudentInteraction, true);
});

test("world-around-me lesson 4 keeps 16-step student parity and custom games", () => {
  const assetsById = Object.fromEntries(
    lessonContentFixtureAssets.map((asset) => [asset.id, asset]),
  );

  const readModel = buildMethodologyLessonUnifiedReadModel({
    lessonId: lessonContentFixtureMethodologyLessonFour.id,
    lessonShell: lessonContentFixtureMethodologyLessonFour.shell,
    presentation: {
      quickSummary: {
        prepChecklist: ["Карточки новых цветов", "Игры 4.6/4.7"],
        keyWords:
          lessonContentFixtureMethodologyLessonFour.shell.vocabularySummary,
        keyPhrases:
          lessonContentFixtureMethodologyLessonFour.shell.phraseSummary,
        resources: [],
      },
      lessonFlow: buildPresentationFlowForLessonFour(),
    },
    studentContent:
      lessonContentFixtureMethodologyLessonStudentContentLessonFour,
    assetsById,
    canonicalHomework: null,
  });

  assert.equal(readModel.steps.length, 16);

  for (const step of readModel.steps) {
    assert.equal(step.title, step.student.title);
    assert.equal(
      Boolean(step.student.instruction && step.student.instruction.trim()),
      true,
    );
  }

  const missingColorStep = readModel.steps[5];
  assert.equal(missingColorStep?.title, "Игра «Что пропало?»");
  assert.equal(missingColorStep?.student.componentKey, "missing_color_game_v1");
  assert.equal(
    (
      (
        missingColorStep?.student.payload?.data as
          { colors?: unknown[] } | undefined
      )?.colors ?? []
    ).length,
    4,
  );

  const sortingStep = readModel.steps[6];
  assert.equal(sortingStep?.title, "Сортируем предметы по цветам");
  assert.equal(sortingStep?.student.componentKey, "color_sorting_game_v1");
  assert.equal(sortingStep?.student.allowStudentInteraction, true);

  const grasslandStep = readModel.steps[9];
  assert.equal(
    grasslandStep?.resourceIds?.includes("media:lesson-4-grassland"),
    true,
  );
});
