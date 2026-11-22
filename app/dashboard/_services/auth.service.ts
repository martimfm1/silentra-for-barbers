import { createClient } from '@/lib/supabase/client';

export type AuthResponse<T = null> = { data: T | null; error: Error | null };

export interface UserSessionProfile {
  id: string;
  email: string | undefined;
  role: string | undefined;
  barbershop_id?: string;
  name_complete?: string | null;
}

export async function logout(): Promise<AuthResponse<null>> {
  const supabase = createClient();
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error)
      throw new Error(
        `[Supabase Auth Error]: ${error.message} (Status: ${error.status})`,
      );
    return { data: null, error: null };
  } catch (error) {
    console.error(
      '[AUTH_LOGOUT_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error('Erro inesperado ao encerrar a sessão.'),
    };
  }
}

export async function getCurrentUser(): Promise<
  AuthResponse<UserSessionProfile>
> {
  const supabase = createClient();
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError)
      throw new Error(`[Supabase User Fetch Error]: ${authError.message}`);
    if (!user) throw new Error('Nenhum utilizador ativo encontrado na sessão.');

    const { data: publicUserData, error: dbError } = await supabase
      .from('users')
      .select('role, barbershop_id, name_complete')
      .eq('id', user.id)
      .single();
    if (dbError)
      console.warn('[AUTH_PROFILE_LOOKUP_WARN]', dbError.code ?? 'UNKNOWN');

    const profile: UserSessionProfile = {
      id: user.id,
      email: user.email,
      role: publicUserData?.role || user.role,
      barbershop_id: publicUserData?.barbershop_id,
      name_complete: publicUserData?.name_complete,
    };
    return { data: profile, error: null };
  } catch (error) {
    console.error(
      '[AUTH_CURRENT_USER_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error('Falha ao recuperar sessão do utilizador.'),
    };
  }
}

export const authService = { logout, getCurrentUser } as const;
