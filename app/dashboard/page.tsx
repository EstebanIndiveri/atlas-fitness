import { redirect } from 'next/navigation';

/**
 * Legacy `/dashboard` entry point. The golden-path home is `/dashboard/today`,
 * so this route redirects there permanently (server-side, no flash).
 */
export default function DashboardPage(): never {
  redirect('/dashboard/today');
}
