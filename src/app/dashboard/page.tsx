import { redirect } from 'next/navigation';

export default function DashboardIndexPage() {
  redirect('/auth/sign-in');
}
