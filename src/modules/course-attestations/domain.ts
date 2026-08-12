export type CourseAttestationOption = {
  id: string;
  label: string;
};

export type CourseAttestationAuthoredQuestion = {
  id: string;
  prompt: string;
  options: CourseAttestationOption[];
  correctOptionId: string;
  explanation: string;
};

export type CourseAttestationDefinition = {
  version: number;
  title: string;
  description: string;
  passingScorePercent: number;
  questions: CourseAttestationAuthoredQuestion[];
};

export type CourseAttestationQuestion = {
  id: string;
  prompt: string;
  options: CourseAttestationOption[];
  selectedOptionId: string | null;
  /** Present only after a successful attempt. */
  correctOptionId: string | null;
  /** Present only after a successful attempt. */
  explanation: string | null;
};

export type CourseAttestationAttempt = {
  id: string;
  scorePercent: number;
  passed: boolean;
  completedAt: string;
  selectedOptionByQuestionId: Record<string, string>;
};

export type CourseAttestationState = {
  publicationId: string;
  revisionId: string;
  title: string;
  description: string;
  passingScorePercent: number;
  version: number;
  questions: CourseAttestationQuestion[];
  attempt: CourseAttestationAttempt | null;
  certified: boolean;
};

export type AccountAttestationCredential = {
  publicationId: string;
  revisionId: string;
  courseTitle: string;
  courseSubject: string;
  assessmentTitle: string;
  publisherDisplayName: string;
  scorePercent: number;
  passingScorePercent: number;
  completedAt: string;
  assessmentVersion: number;
  isCurrentRevision: boolean;
  publicationAvailable: boolean;
};
