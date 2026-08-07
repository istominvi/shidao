/**
 * Single alignment point between the application and the forward-only learner
 * identity migration. Routes and components must never spell RPC names.
 */
export const LEARNER_IDENTITY_RPC = {
  listTeacherDirectory: "list_teacher_learner_directory",
  restoreTeacherLearner: "restore_teacher_learner",
  permanentlyDeleteOfflineLearner: "delete_empty_offline_learner_profile",
  listConnections: "list_learner_connection_requests",
  createConnection: "create_learner_connection_request",
  actOnConnection: "act_on_learner_connection_request",
  listProfileInvitations: "list_learner_profile_invitations",
  revokeProfileInvitation: "revoke_learner_profile_invitation",
  previewProfileInvitation: "preview_learner_profile_invitation",
  actOnProfileInvitation: "act_on_learner_profile_invitation",
  activateChildAccount: "activate_offline_learner_account",
  previewMerge: "preview_learner_profile_merge",
  confirmMerge: "confirm_learner_profile_merge",
  cancelMerge: "cancel_learner_profile_merge",
  getSelfProfile: "get_my_learning_profile",
  getSelfHistory: "get_my_learning_history",
  getSelfProgress: "get_my_learning_progress",
  rotateShareCode: "rotate_my_learner_share_code",
  previewSafeUnlink: "preview_my_learner_profile_unlink",
  confirmSafeUnlink: "confirm_my_learner_profile_unlink",
  previewErasure: "preview_my_learning_data_erasure",
  confirmErasure: "confirm_my_learning_data_erasure",
  listMyRecoveryDelegates: "list_my_learner_credential_recovery_delegates",
  revokeMyRecoveryDelegate: "revoke_my_learner_credential_recovery_delegate",
  listObserverOverview: "list_my_learner_observer_overview",
  createObserverInvitation: "create_learner_observer_invitation",
  actOnObserverRelationship: "act_on_learner_observer_relationship",
  listObservedProfiles: "list_my_observed_learner_profiles",
  getObservedHistory: "get_observed_learner_history",
  getObservedProgress: "get_observed_learner_progress",
  requestAiConsent: "request_learner_ai_consent",
  listAiConsents: "list_my_learner_ai_consents",
  actOnAiConsent: "act_on_learner_ai_consent",
} as const;

/** These functions are intentionally executable by service_role only. */
export const LEARNER_IDENTITY_ADMIN_RPC = {
  resolveTeacherLearnerAlias: "resolve_teacher_learner_profile_alias",
  createConnection: "create_learner_connection_request",
  createProfileInvitation: "create_learner_profile_invitation",
  previewEmailConnection: "preview_email_learner_connection_request",
  actOnEmailConnection: "act_on_email_learner_connection_request",
  previewProfileInvitation: "preview_learner_profile_invitation",
  actOnProfileInvitation: "act_on_learner_profile_invitation",
  activateChildAccount: "activate_offline_learner_account",
  actOnEmailObserverInvitation: "act_on_email_learner_observer_invitation",
  previewEmailObserverInvitation: "preview_email_learner_observer_invitation",
  previewVerifiedProfileInvitation:
    "preview_verified_learner_profile_invitation",
  actOnVerifiedProfileInvitation: "act_on_verified_learner_profile_invitation",
  activateVerifiedChildAccount: "activate_verified_offline_learner_account",
  listRecoverableCredentials: "list_recoverable_learner_credentials",
  resetRecoverableCredentials: "reset_recoverable_learner_credentials",
  previewVerifiedEmailConnection:
    "preview_verified_email_learner_connection_request",
  actOnVerifiedEmailConnection:
    "act_on_verified_email_learner_connection_request",
  previewVerifiedEmailObserverInvitation:
    "preview_verified_email_learner_observer_invitation",
  actOnVerifiedEmailObserverInvitation:
    "act_on_verified_email_learner_observer_invitation",
  confirmErasure: "confirm_my_learning_data_erasure",
  confirmSafeUnlink: "confirm_my_learner_profile_unlink",
} as const;

export type LearnerIdentityRpcName =
  (typeof LEARNER_IDENTITY_RPC)[keyof typeof LEARNER_IDENTITY_RPC];
