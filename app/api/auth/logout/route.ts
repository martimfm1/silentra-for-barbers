import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function POSTHandler() {
  try {
    const supabase = await createClient();

    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}


export const POST = withApiLogging('/api/auth/logout', POSTHandler);
