import { LearningProfileWorkspace } from "@/components/learner-identity/learning-profile-workspace";
import { TopNav } from "@/components/top-nav";

export default function LearningProfilePage() {
  return (
    <main className="course-demo-shell teaching-hub-shell pb-12">
      <TopNav demoStyle />
      <div className="container app-page-container">
        <LearningProfileWorkspace />
      </div>
    </main>
  );
}
