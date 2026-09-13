import { redirect } from 'next/navigation';
import { isLocalDemoMode } from '@/lib/auth/session';

export default function HomePage() {
  redirect(isLocalDemoMode() ? '/dashboard' : '/login');
}
