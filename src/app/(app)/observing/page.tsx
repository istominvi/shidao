import { ObservingWorkspace } from "@/components/learner-identity/observing-workspace";
import { TopNav } from "@/components/top-nav";

export default function ObservingPage() {
  return (
    <main className="course-demo-shell teaching-hub-shell pb-12">
      <TopNav demoStyle />
      <div className="container app-page-container">
        <ObservingWorkspace />
      </div>
    </main>
  );
}
