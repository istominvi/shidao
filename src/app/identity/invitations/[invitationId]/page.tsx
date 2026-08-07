import { InvitationAcceptWorkspace } from "@/components/learner-identity/invitation-accept-workspace";
import { TopNav } from "@/components/top-nav";

type Props = { params: Promise<{ invitationId: string }> };

export default async function IdentityInvitationPage({ params }: Props) {
  const { invitationId } = await params;
  return (
    <main className="course-demo-shell teaching-hub-shell pb-12">
      <TopNav demoStyle />
      <div className="container app-page-container">
        <InvitationAcceptWorkspace invitationId={invitationId} />
      </div>
    </main>
  );
}
