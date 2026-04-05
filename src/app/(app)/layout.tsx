import { requireUserContext } from '@/lib/server/user-context';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUserContext();
  return children;
}
