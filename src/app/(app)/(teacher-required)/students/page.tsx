import { AppPageHeader } from "@/components/app/page-header";
import { StudentsWorkspace } from "@/components/teaching-hub/students-workspace";
import { TopNav } from "@/components/top-nav";

export default function StudentsPage() {
  return (
    <main className="course-demo-shell teaching-hub-shell pb-12">
      <TopNav demoStyle />
      <div className="container app-page-container space-y-6">
        <AppPageHeader
          className="course-index-page-header teaching-hub-page-header"
          title="Ученики"
          description="Учебные профили и аудитории курсов. Здесь накапливается индивидуальная история завершённых уроков."
        />
        <StudentsWorkspace />
      </div>
    </main>
  );
}
