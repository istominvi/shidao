import { StudentsWorkspace } from "@/components/teaching-hub/students-workspace";
import { TopNav } from "@/components/top-nav";

type StudentsPageProps = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function StudentsPage({
  searchParams,
}: StudentsPageProps) {
  const tab = (await searchParams).tab;
  const initialView =
    tab === "groups"
      ? "groups"
      : tab === "observing"
        ? "observing"
        : "learners";

  return (
    <main className="course-demo-shell teaching-hub-shell pb-12">
      <TopNav demoStyle />
      <div className="container app-page-container space-y-6">
        <StudentsWorkspace initialView={initialView} />
      </div>
    </main>
  );
}
