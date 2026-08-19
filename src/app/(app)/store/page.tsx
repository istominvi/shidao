import { StoreWorkspace } from "@/components/store/store-workspace";
import "../../styles/store.css";

type StorePageProps = {
  searchParams: Promise<{ product?: string | string[] }>;
};

export default async function StorePage({ searchParams }: StorePageProps) {
  const product = (await searchParams).product;
  const initialProductSlug = typeof product === "string" ? product : null;

  return (
    <main className="app-page-shell pb-12">
      <div className="container app-page-container space-y-6">
        <StoreWorkspace initialProductSlug={initialProductSlug} />
      </div>
    </main>
  );
}
