import { postgresUuidSchema } from "@/lib/postgres-uuid";
import type { ChoiceQuizApplicationService } from "@/modules/choice-quiz/service";
import {
  getComponentDefinition,
  parseComponentPlacement,
  projectLearnerComponentPayload,
  type ComponentTypeKey,
} from "@/modules/course-builder/registry/contracts";
import {
  learnerLiveAssetRefSchema,
  learnerLiveStateSchema,
  liveDeliveryRevisionSchema,
  parseLiveDeliveryInput,
  setLiveAccessInputSchema,
  setPresentationCursorInputSchema,
  type LearnerLiveSourceAsset,
  type SetLiveAccessInput,
  type SetPresentationCursorInput,
} from "./contracts";
import type {
  LearnerLiveActor,
  LearnerLiveSource,
  LearnerLiveState,
} from "./domain";
import {
  LiveDeliveryAssetNotFoundError,
  LiveDeliveryAssetRangeError,
  LiveDeliveryProjectionError,
} from "./errors";
import type {
  LearnerLiveAssetBytes,
  LearnerLiveDeliveryRepository,
  TeacherLiveDeliveryRepository,
} from "./repository";

type LiveDeliveryServiceDependencies = {
  teacherRepository?: TeacherLiveDeliveryRepository;
  learnerRepository?: LearnerLiveDeliveryRepository;
  choiceQuizService?: Pick<ChoiceQuizApplicationService, "issueLiveDefinition">;
};

function requireTeacherRepository(
  repository: TeacherLiveDeliveryRepository | undefined,
) {
  if (!repository) {
    throw new Error("Teacher live delivery repository is not configured.");
  }
  return repository;
}

function requireLearnerRepository(
  repository: LearnerLiveDeliveryRepository | undefined,
) {
  if (!repository) {
    throw new Error("Learner live delivery repository is not configured.");
  }
  return repository;
}

function parseLessonRunId(value: unknown) {
  return parseLiveDeliveryInput(postgresUuidSchema, value);
}

function parseCursorRevision(value: unknown) {
  const normalized =
    typeof value === "string" && /^(?:0|[1-9]\d*)$/.test(value)
      ? Number(value)
      : value;
  const parsed = liveDeliveryRevisionSchema.safeParse(normalized);
  if (!parsed.success) throw new LiveDeliveryAssetNotFoundError();
  return parsed.data;
}

/**
 * A valid UUID required by the existing registry/renderers, but never a raw
 * stored_file id. Refs are scoped to one response and carry no authority.
 */
function syntheticAssetRef(ordinal: number) {
  return `00000000-0000-4000-8000-${ordinal.toString().padStart(12, "0")}`;
}

function learnerAssetUrl(input: {
  lessonRunId: string;
  ref: string;
  revision: number;
}) {
  return `/api/v2/me/live-runs/${encodeURIComponent(input.lessonRunId)}/assets/${encodeURIComponent(input.ref)}?revision=${input.revision}`;
}

export function normalizeLiveAssetRange(
  value: string | null,
  sizeBytes: number,
): string | null {
  if (value === null) return null;
  const match = /^bytes=(\d{1,16})-(\d{0,16})$|^bytes=-(\d{1,16})$/.exec(value);
  if (!match) throw new LiveDeliveryAssetRangeError(sizeBytes);

  if (match[3] !== undefined) {
    const suffixLength = Number(match[3]);
    if (
      !Number.isSafeInteger(suffixLength) ||
      suffixLength <= 0 ||
      sizeBytes <= 0
    ) {
      throw new LiveDeliveryAssetRangeError(sizeBytes);
    }
    const start = Math.max(0, sizeBytes - suffixLength);
    return `bytes=${start}-${sizeBytes - 1}`;
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : sizeBytes - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= sizeBytes ||
    requestedEnd < start
  ) {
    throw new LiveDeliveryAssetRangeError(sizeBytes);
  }
  return `bytes=${start}-${Math.min(requestedEnd, sizeBytes - 1)}`;
}

/**
 * Asset discovery intentionally runs only after the registry has removed
 * evaluator/private fields. A future learner schema may nest media refs, so
 * this walks the already-validated learner projection instead of consulting
 * the raw author payload.
 */
function extractProjectedStoredFileReferences(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(extractProjectedStoredFileReferences);
  }
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, nested]) => {
    if (key === "storedFileId" && typeof nested === "string") {
      const parsed = postgresUuidSchema.safeParse(nested);
      return parsed.success ? [parsed.data] : [];
    }
    return extractProjectedStoredFileReferences(nested);
  });
}

function replaceNestedStoredFileReferences(
  value: unknown,
  refByStoredFileId: ReadonlyMap<string, string>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((nested) =>
      replaceNestedStoredFileReferences(nested, refByStoredFileId),
    );
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      key === "storedFileId" && typeof nested === "string"
        ? (refByStoredFileId.get(nested) ?? null)
        : replaceNestedStoredFileReferences(nested, refByStoredFileId),
    ]),
  );
}

function replaceStoredFileReferences(
  typeKey: ComponentTypeKey,
  projectedPayload: Record<string, unknown>,
  refByStoredFileId: ReadonlyMap<string, string>,
) {
  if (typeKey === "image" || typeKey === "file") {
    const raw = projectedPayload.storedFileId;
    return {
      ...projectedPayload,
      storedFileId:
        typeof raw === "string" ? (refByStoredFileId.get(raw) ?? null) : null,
    };
  }

  if (typeKey === "slideshow") {
    const slides = Array.isArray(projectedPayload.slides)
      ? projectedPayload.slides.flatMap((value) => {
          if (!value || typeof value !== "object" || Array.isArray(value)) {
            return [];
          }
          const slide = value as Record<string, unknown>;
          const storedFileId = slide.storedFileId;
          const ref =
            typeof storedFileId === "string"
              ? refByStoredFileId.get(storedFileId)
              : null;
          return ref ? [{ ...slide, storedFileId: ref }] : [];
        })
      : [];
    return { ...projectedPayload, slides };
  }

  return replaceNestedStoredFileReferences(
    projectedPayload,
    refByStoredFileId,
  ) as Record<string, unknown>;
}

function sourceAssetProjection(input: {
  source: Extract<LearnerLiveSource, { state: "live" }>;
  referencedIds: string[];
}) {
  const sourceAssetById = new Map(
    input.source.assets.map((asset) => [asset.id, asset]),
  );
  const assets: Array<{
    ref: string;
    source: LearnerLiveSourceAsset;
  }> = [];
  const refByStoredFileId = new Map<string, string>();

  for (const storedFileId of input.referencedIds) {
    if (refByStoredFileId.has(storedFileId)) continue;
    const source = sourceAssetById.get(storedFileId);
    if (!source) continue;
    const ref = syntheticAssetRef(assets.length + 1);
    refByStoredFileId.set(storedFileId, ref);
    assets.push({ ref, source });
  }

  return { assets, refByStoredFileId };
}

function projectActiveSource(
  source: Extract<LearnerLiveSource, { state: "live" }>,
) {
  try {
    const projectedComponents = source.slide.components.map((component) => {
      const definition = getComponentDefinition(component.typeKey);
      if (component.schemaVersion !== definition.version) {
        throw new LiveDeliveryProjectionError(
          `Unsupported ${component.typeKey} schema version.`,
        );
      }
      const payload = projectLearnerComponentPayload(
        component.typeKey,
        component.payload,
      ) as Record<string, unknown>;
      const placement = parseComponentPlacement(
        component.typeKey,
        component.placement,
      ) as Record<string, unknown>;
      return { component, definition, payload, placement };
    });
    const referencedIds = projectedComponents.flatMap(({ payload }) =>
      extractProjectedStoredFileReferences(payload),
    );
    const { assets, refByStoredFileId } = sourceAssetProjection({
      source,
      referencedIds,
    });

    const components = projectedComponents.map(
      ({ component, definition, payload: projectedPayload, placement }) => {
        const payload = replaceStoredFileReferences(
          component.typeKey,
          projectedPayload,
          refByStoredFileId,
        );
        const safePayload = definition.activityFacet
          ? definition.activityFacet.learnerDeliverySchema.parse(payload)
          : definition.payloadSchema.parse(payload);
        return {
          key: `component-${component.position}`,
          typeKey: component.typeKey,
          schemaVersion: component.schemaVersion,
          position: component.position,
          payload: safePayload as Record<string, unknown>,
          placement,
        };
      },
    );

    return { components, assets };
  } catch (error) {
    if (error instanceof LiveDeliveryProjectionError) throw error;
    throw new LiveDeliveryProjectionError();
  }
}

async function issueActiveChoiceQuizzes(input: {
  actor: LearnerLiveActor;
  lessonRunId: string;
  source: Extract<LearnerLiveSource, { state: "live" }>;
  components: ReturnType<typeof projectActiveSource>["components"];
  choiceQuizService:
    Pick<ChoiceQuizApplicationService, "issueLiveDefinition"> | undefined;
}) {
  const components = [];
  for (const [index, projected] of input.components.entries()) {
    const sourceComponent = input.source.slide.components[index];
    if (!sourceComponent || sourceComponent.position !== projected.position) {
      throw new LiveDeliveryProjectionError();
    }
    if (
      sourceComponent.typeKey !== "choice_quiz" ||
      sourceComponent.activityRole === null
    ) {
      components.push(projected);
      continue;
    }
    if (!input.choiceQuizService) throw new LiveDeliveryProjectionError();

    const issued = await input.choiceQuizService.issueLiveDefinition({
      actor: input.actor,
      lessonRunId: input.lessonRunId,
      cursorRevision: input.source.cursorRevision,
      component: {
        id: sourceComponent.id,
        schemaVersion: sourceComponent.schemaVersion,
        position: sourceComponent.position,
        updatedAt: sourceComponent.updatedAt,
        activityRole: sourceComponent.activityRole,
        primaryLearningObjectiveId: sourceComponent.primaryLearningObjectiveId,
        payload: sourceComponent.payload,
      },
    });
    if (!issued) throw new LiveDeliveryProjectionError();
    components.push({
      ...projected,
      // Use the definition returned from the durable issue row, never the
      // pre-write source projection, as the learner-visible question.
      payload: issued.learnerDefinition,
      execution: issued.execution,
    });
  }
  return components;
}

async function projectLearnerState(
  source: LearnerLiveSource,
  lessonRunId: string,
  actor: LearnerLiveActor,
  choiceQuizService:
    Pick<ChoiceQuizApplicationService, "issueLiveDefinition"> | undefined,
): Promise<LearnerLiveState> {
  if (source.state === "ended") return { kind: "ended" };
  if (source.state === "waiting") {
    return { kind: "waiting", cursorRevision: source.cursorRevision };
  }

  const projected = projectActiveSource(source);
  const components = await issueActiveChoiceQuizzes({
    actor,
    lessonRunId,
    source,
    components: projected.components,
    choiceQuizService,
  });
  const candidate = {
    kind: "active" as const,
    cursorRevision: source.cursorRevision,
    slide: {
      position: source.slide.position,
      componentCount: components.length,
      components,
    },
    assets: projected.assets.map(({ ref, source: asset }) => ({
      ref,
      mimeType: asset.mimeType,
      url: learnerAssetUrl({
        lessonRunId,
        ref,
        revision: source.cursorRevision,
      }),
    })),
  };
  const parsed = learnerLiveStateSchema.safeParse(candidate);
  if (!parsed.success) throw new LiveDeliveryProjectionError();
  return parsed.data;
}

export type LearnerLiveAssetDelivery = LearnerLiveAssetBytes & {
  mimeType: LearnerLiveSourceAsset["mimeType"];
};

export function createLiveDeliveryService(
  dependencies: LiveDeliveryServiceDependencies,
) {
  return {
    getTeacherDelivery(lessonRunIdValue: unknown) {
      return requireTeacherRepository(
        dependencies.teacherRepository,
      ).getDelivery(parseLessonRunId(lessonRunIdValue));
    },

    setTeacherAccess(
      lessonRunIdValue: unknown,
      rawInput: SetLiveAccessInput | unknown,
    ) {
      const lessonRunId = parseLessonRunId(lessonRunIdValue);
      const input = parseLiveDeliveryInput(setLiveAccessInputSchema, rawInput);
      return requireTeacherRepository(dependencies.teacherRepository).setAccess(
        lessonRunId,
        input,
      );
    },

    setTeacherCursor(
      lessonRunIdValue: unknown,
      rawInput: SetPresentationCursorInput | unknown,
    ) {
      const lessonRunId = parseLessonRunId(lessonRunIdValue);
      const input = parseLiveDeliveryInput(
        setPresentationCursorInputSchema,
        rawInput,
      );
      return requireTeacherRepository(dependencies.teacherRepository).setCursor(
        lessonRunId,
        input,
      );
    },

    async getLearnerState(actor: LearnerLiveActor, lessonRunIdValue: unknown) {
      const repository = requireLearnerRepository(
        dependencies.learnerRepository,
      );
      const lessonRunId = parseLessonRunId(lessonRunIdValue);
      return projectLearnerState(
        await repository.resolveSource(actor, lessonRunId),
        lessonRunId,
        actor,
        dependencies.choiceQuizService,
      );
    },

    async getLearnerAsset(
      actor: LearnerLiveActor,
      lessonRunIdValue: unknown,
      assetRefValue: unknown,
      revisionValue: unknown,
      rangeValue: string | null,
      signal?: AbortSignal,
    ): Promise<LearnerLiveAssetDelivery> {
      const repository = requireLearnerRepository(
        dependencies.learnerRepository,
      );
      const lessonRunId = parseLessonRunId(lessonRunIdValue);
      // The successful resolver is this GET's authorization linearization
      // point. A revoke/completion committed before it denies the request;
      // an already-overlapping, bounded response may finish, but no later GET
      // can reuse its ref as authority or bypass this fresh resolver check.
      const source = await repository.resolveSource(actor, lessonRunId);
      if (source.state !== "live") throw new LiveDeliveryAssetNotFoundError();

      const parsedAssetRef = learnerLiveAssetRefSchema.safeParse(assetRefValue);
      if (!parsedAssetRef.success) throw new LiveDeliveryAssetNotFoundError();
      const assetRef = parsedAssetRef.data;
      const revision = parseCursorRevision(revisionValue);
      if (source.cursorRevision !== revision) {
        throw new LiveDeliveryAssetNotFoundError();
      }

      const projected = projectActiveSource(source);
      const selected = projected.assets.find((asset) => asset.ref === assetRef);
      if (!selected) throw new LiveDeliveryAssetNotFoundError();

      const range = normalizeLiveAssetRange(
        rangeValue,
        selected.source.sizeBytes,
      );
      return {
        ...(await repository.fetchAsset(selected.source, { range, signal })),
        mimeType: selected.source.mimeType,
      };
    },
  };
}
