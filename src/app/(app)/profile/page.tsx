import { LearningProfileWorkspace } from "@/components/learner-identity/learning-profile-workspace";
import { TopNav } from "@/components/top-nav";
import {
  resolveProfileTab,
  type ProfileRouteSearchParams,
} from "@/lib/navigation/profile-nav";

type ProfilePageProps = {
  searchParams: Promise<
    ProfileRouteSearchParams & {
      tab?: string | string[];
      emailChanged?: string | string[];
      emailChangeRequested?: string | string[];
    }
  >;
};

function hasFlag(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) === "1";
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const emailStatus = hasFlag(params.emailChanged)
    ? ("changed" as const)
    : hasFlag(params.emailChangeRequested)
      ? ("change-requested" as const)
      : null;

  return (
    <main className="course-demo-shell teaching-hub-shell pb-12">
      <TopNav demoStyle />
      <div className="container app-page-container">
        <LearningProfileWorkspace
          initialSurface={resolveProfileTab(params.tab)}
          emailStatus={emailStatus}
        />
      </div>
    </main>
  );
}
