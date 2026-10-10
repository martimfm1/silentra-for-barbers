import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function POST__unobserved() {
  try {
    const supabase = await createClient();

    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export const POST = withApiObservability('/api/auth/logout', POST__unobserved);
