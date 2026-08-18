import { StudentsWorkspace } from "@/components/teaching-hub/students-workspace";

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
      <div className="container app-page-container space-y-6">
        <StudentsWorkspace initialView={initialView} />
      </div>
    </main>
  );
}
