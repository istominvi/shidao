export type TeacherSchoolMembershipLite = {
  id: string;
  schoolId: string;
  role: "owner" | "teacher";
  schoolKind: "personal" | "organization" | null;
  schoolName: string | null;
};

export function pickTeacherPersonalSchoolMembership(
  memberships: TeacherSchoolMembershipLite[],
): TeacherSchoolMembershipLite | null {
  return memberships.find((membership) => membership.schoolKind === "personal") ?? null;
}
