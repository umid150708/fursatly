/**
 * POST /api/account/delete — permanently deletes the caller's account.
 *
 * Validates the session cookie, then removes the auth user with the service
 * role. FK cascades take profiles → saved_opportunities → reminders_sent and
 * mentor_usage with it, so no per-table cleanup is needed here.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('[Account] delete failed:', error.message);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
