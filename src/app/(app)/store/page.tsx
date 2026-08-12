import { StoreWorkspace } from "@/components/store/store-workspace";
import { TopNav } from "@/components/top-nav";

type StorePageProps = {
  searchParams: Promise<{ product?: string | string[] }>;
};

export default async function StorePage({ searchParams }: StorePageProps) {
  const product = (await searchParams).product;
  const initialProductSlug = typeof product === "string" ? product : null;

  return (
    <main className="course-demo-shell store-shell pb-12">
      <TopNav demoStyle />
      <div className="container app-page-container space-y-6">
        <StoreWorkspace initialProductSlug={initialProductSlug} />
      </div>
    </main>
  );
}
