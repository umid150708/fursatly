import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/supabase/server';
import { AccountClient } from './AccountClient';

/**
 * /account — thin server gate. Middleware already redirects signed-out
 * visitors, but this double-checks with a validated getUser() so a stale
 * cookie can't render the page shell.
 */
export default async function AccountPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth?next=/account');

  return <AccountClient />;
}
