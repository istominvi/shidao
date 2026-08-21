import type {
  CreatedIdentityRequest,
  CursorPage,
  ErasurePreview,
  InvitationAcceptance,
  LearnerAiConsent,
  LearnerConnectionRequest,
  LearnerCredentialRecoveryOverview,
  LearnerCredentialRecoveryRevocation,
  LearnerCredentialResetResult,
  LearnerInvitation,
  LearnerMergeConfirmation,
  LearnerMergePreview,
  LearnerProgress,
  LearnerSafeHistoryItem,
  ObserverGrant,
  ObserverOverview,
  RecipientBoundInvitationPreview,
  SafeUnlinkPreview,
  SelfLearningProfile,
  ShareCode,
  TeacherLearnerDirectoryItem,
  TeacherLearnerStatus,
} from "@/modules/learner-identity/domain";
import type { CourseSummary } from "@/modules/course-builder/domain";
import type { AccountAttestationCredential } from "@/modules/course-attestations/domain";
export {
  loadObservedActivityProfile,
  loadSelfActivityProfile,
} from "@/components/learning-activities/activity-profile-client";

export class IdentityClientError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "IdentityClientError";
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: init?.cache ?? "no-store",
    credentials: init?.credentials ?? "same-origin",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as
    (T & { error?: string; code?: string }) | null;
  if (!response.ok) {
    throw new IdentityClientError(
      payload?.error ?? "Не удалось выполнить действие.",
      response.status,
      payload?.code ?? null,
    );
  }
  if (payload === null)
    throw new IdentityClientError("Пустой ответ сервера.", 502, null);
  return payload;
}

function post<T>(path: string, input: unknown = {}) {
  return requestJson<T>(path, { method: "POST", body: JSON.stringify(input) });
}

export async function loadTeacherDirectory(status: TeacherLearnerStatus) {
  const payload = await requestJson<{
    learners: TeacherLearnerDirectoryItem[];
  }>(`/api/v2/learner-directory?status=${status}`);
  return payload.learners;
}

export async function loadOwnedCourses() {
  const payload = await requestJson<{ courses: CourseSummary[] }>(
    "/api/v2/courses",
  );
  return payload.courses;
}

export async function restoreTeacherLearner(learnerProfileId: string) {
  const payload = await post<{ learner: TeacherLearnerDirectoryItem }>(
    `/api/v2/learner-directory/${encodeURIComponent(learnerProfileId)}/restore`,
  );
  return payload.learner;
}

export function permanentlyDeleteOfflineLearner(learnerProfileId: string) {
  return post<{ deleted: true }>(
    `/api/v2/learner-directory/${encodeURIComponent(learnerProfileId)}/permanent-delete`,
  );
}

export async function loadConnections() {
  const payload = await requestJson<{ requests: LearnerConnectionRequest[] }>(
    "/api/v2/learner-connections",
  );
  return payload.requests;
}

export function createConnection(
  input:
    | { method: "share_code"; shareCode: string; localDisplayName: string }
    | { method: "email"; email: string; localDisplayName: string },
) {
  return post<CreatedIdentityRequest<LearnerConnectionRequest>>(
    "/api/v2/learner-connections",
    input,
  );
}

export async function actOnConnection(
  connectionId: string,
  action: "accept" | "reject" | "cancel",
) {
  const payload = await post<{ request: LearnerConnectionRequest }>(
    `/api/v2/learner-connections/${encodeURIComponent(connectionId)}/${action}`,
    {},
  );
  return payload.request;
}

export async function loadLearnerInvitations(learnerProfileId: string) {
  const payload = await requestJson<{ invitations: LearnerInvitation[] }>(
    `/api/v2/learner-profiles/${encodeURIComponent(learnerProfileId)}/identity-invitations`,
  );
  return payload.invitations;
}

export function createLearnerInvitation(
  learnerProfileId: string,
  input: { kind: "claim" | "child_activation"; recipientEmail: string },
) {
  return post<CreatedIdentityRequest<LearnerInvitation>>(
    `/api/v2/learner-profiles/${encodeURIComponent(learnerProfileId)}/identity-invitations`,
    input,
  );
}

export function revokeLearnerInvitation(invitationId: string) {
  return post<{ invitation: LearnerInvitation }>(
    `/api/v2/identity-invitations/${encodeURIComponent(invitationId)}/revoke`,
  );
}

export function previewIdentityInvitation(
  invitationId: string,
  token: string | null,
) {
  return post<InvitationAcceptance>(
    `/api/v2/identity-invitations/${encodeURIComponent(invitationId)}/preview`,
    token ? { token } : {},
  );
}

export async function previewEmailConnection(
  connectionId: string,
  token: string | null,
) {
  const payload = await post<{ preview: RecipientBoundInvitationPreview }>(
    `/api/v2/email-connections/${encodeURIComponent(connectionId)}/preview`,
    token ? { token } : {},
  );
  return payload.preview;
}

export function actOnEmailConnection(
  connectionId: string,
  token: string | null,
  action: "accept" | "reject",
) {
  return post<{ request: RecipientBoundInvitationPreview }>(
    `/api/v2/email-connections/${encodeURIComponent(connectionId)}/${action}`,
    token ? { token } : {},
  );
}

export async function previewEmailObserverInvitation(
  relationshipId: string,
  token: string | null,
) {
  const payload = await post<{ preview: RecipientBoundInvitationPreview }>(
    `/api/v2/email-observer-invitations/${encodeURIComponent(relationshipId)}/preview`,
    token ? { token } : {},
  );
  return payload.preview;
}

export function actOnEmailObserverInvitation(
  relationshipId: string,
  token: string | null,
  action: "accept" | "reject",
) {
  return post<ObserverOverview>(
    `/api/v2/email-observer-invitations/${encodeURIComponent(relationshipId)}/${action}`,
    token ? { token } : {},
  );
}

export function actOnIdentityInvitation(
  invitationId: string,
  token: string | null,
  action: "accept" | "reject",
) {
  return post<InvitationAcceptance>(
    `/api/v2/identity-invitations/${encodeURIComponent(invitationId)}/${action}`,
    token ? { token } : {},
  );
}

export function activateChildIdentity(
  invitationId: string,
  input: {
    token: string | null;
    learnerLogin: string;
    pin: string;
    acknowledgeRecoveryDelegate: true;
    requestObserverInvitation: boolean;
  },
) {
  const { token, ...activation } = input;
  return post<InvitationAcceptance>(
    `/api/v2/identity-invitations/${encodeURIComponent(invitationId)}/activate-child`,
    token ? { ...activation, token } : activation,
  );
}

export function loadLearnerCredentialRecovery() {
  return requestJson<LearnerCredentialRecoveryOverview>(
    "/api/v2/learner-credential-recovery",
  );
}

export async function resetRecoverableLearnerCredentials(
  grantId: string,
  input: { newLogin: string; pin: string; idempotencyKey: string },
) {
  const payload = await post<{ result: LearnerCredentialResetResult }>(
    `/api/v2/learner-credential-recovery/${encodeURIComponent(grantId)}/reset`,
    input,
  );
  return payload.result;
}

export async function revokeMyLearnerRecoveryDelegate(grantId: string) {
  const payload = await post<{ delegate: LearnerCredentialRecoveryRevocation }>(
    `/api/v2/learner-credential-recovery/${encodeURIComponent(grantId)}/revoke`,
  );
  return payload.delegate;
}

export function previewMerge(mergeOperationId: string) {
  return post<LearnerMergePreview>(
    `/api/v2/learner-merges/${encodeURIComponent(mergeOperationId)}/preview`,
  );
}

export function confirmMerge(
  mergeOperationId: string,
  previewFingerprint: string,
) {
  return post<LearnerMergeConfirmation>(
    `/api/v2/learner-merges/${encodeURIComponent(mergeOperationId)}/confirm`,
    { previewFingerprint },
  );
}

export function cancelMerge(mergeOperationId: string) {
  return post<{ cancelled: true }>(
    `/api/v2/learner-merges/${encodeURIComponent(mergeOperationId)}/cancel`,
  );
}

export async function loadSelfLearningProfile() {
  const payload = await requestJson<{ profile: SelfLearningProfile }>(
    "/api/v2/me/learning-profile",
  );
  return payload.profile;
}

export function loadSelfHistory(cursor: string | null = null) {
  const query = new URLSearchParams({ limit: "25" });
  if (cursor) query.set("cursor", cursor);
  return requestJson<CursorPage<LearnerSafeHistoryItem>>(
    `/api/v2/me/learning-profile/history?${query}`,
  );
}

export async function loadSelfProgress() {
  const payload = await requestJson<{ progress: LearnerProgress }>(
    "/api/v2/me/learning-profile/progress",
  );
  return payload.progress;
}

export async function loadAccountAttestations() {
  const payload = await requestJson<{
    attestations: AccountAttestationCredential[];
  }>("/api/v2/me/attestations");
  return payload.attestations;
}

export async function rotateSelfShareCode() {
  const payload = await post<{ shareCode: ShareCode }>(
    "/api/v2/me/learning-profile/share-code",
  );
  return payload.shareCode;
}

export async function previewSafeUnlink() {
  const payload = await post<{ preview: SafeUnlinkPreview }>(
    "/api/v2/me/learning-profile/unlink/preview",
  );
  return payload.preview;
}

export function confirmSafeUnlink(previewFingerprint: string) {
  return post<{ profile: SelfLearningProfile }>(
    "/api/v2/me/learning-profile/unlink/confirm",
    { previewFingerprint },
  );
}

export async function previewLearningDataErasure() {
  const payload = await post<{ preview: ErasurePreview }>(
    "/api/v2/me/learning-profile/erasure/preview",
  );
  return payload.preview;
}

export function confirmLearningDataErasure(previewFingerprint: string) {
  return post<{ profile: SelfLearningProfile }>(
    "/api/v2/me/learning-profile/erasure/confirm",
    { previewFingerprint },
  );
}

export function reauthenticate(secret: string) {
  return post<{ ok: true }>("/api/auth/reauth", { secret });
}

export function loadObserverOverview() {
  return requestJson<ObserverOverview>("/api/v2/observers");
}

export function createObserverInvitation(input: {
  recipientEmail: string;
  relationshipLabel: string;
}) {
  return post<{
    overview: ObserverOverview;
    copyLink: string | null;
    delivery: "delivery_attempted";
  }>("/api/v2/observers", input);
}

export function actOnObserver(
  relationshipId: string,
  action: "accept" | "reject" | "revoke" | "leave" | "rename",
  input: { relationshipLabel?: string } = {},
) {
  return post<ObserverOverview>(
    `/api/v2/observers/${encodeURIComponent(relationshipId)}/${action}`,
    input,
  );
}

export async function loadObservedProfiles() {
  const payload = await requestJson<{ profiles: ObserverGrant[] }>(
    "/api/v2/observations",
  );
  return payload.profiles;
}

export function loadObservedHistory(
  learnerProfileId: string,
  cursor: string | null = null,
) {
  const query = new URLSearchParams({ limit: "25" });
  if (cursor) query.set("cursor", cursor);
  return requestJson<CursorPage<LearnerSafeHistoryItem>>(
    `/api/v2/observations/${encodeURIComponent(learnerProfileId)}/history?${query}`,
  );
}

export async function loadObservedProgress(learnerProfileId: string) {
  const payload = await requestJson<{ progress: LearnerProgress }>(
    `/api/v2/observations/${encodeURIComponent(learnerProfileId)}/progress`,
  );
  return payload.progress;
}

export async function loadAiConsents() {
  const payload = await requestJson<{ consents: LearnerAiConsent[] }>(
    "/api/v2/me/ai-consents",
  );
  return payload.consents;
}

export async function actOnAiConsent(
  consentId: string,
  action: "grant" | "revoke",
  input: { expectedRevision: number; expiresInDays?: number },
) {
  const payload = await post<{ consent: LearnerAiConsent }>(
    `/api/v2/ai-consents/${encodeURIComponent(consentId)}/${action}`,
    input,
  );
  return payload.consent;
}

export async function requestAiConsent(
  courseId: string,
  input: { learnerProfileId: string; purpose: string; expiresInDays?: number },
) {
  const payload = await post<{ consent: LearnerAiConsent }>(
    `/api/v2/courses/${encodeURIComponent(courseId)}/ai-consent-requests`,
    input,
  );
  return payload.consent;
}
