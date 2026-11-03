'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { createClient } from '@/lib/supabase/client';
import { useBarbershop } from '@/context/BarbershopContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useLanguage } from '@/context/LanguageContext';
import { FeaturePlanBadge } from '@/components/billing/FeaturePlanBadge';

export function BarbershopVisibilitySetting() {
  const { barbershopId } = useBarbershop();
  const { hasFeature, loading: planLoading } = useFeatureAccess();
  const { locale } = useLanguage();
  const english = locale === 'en';
  const canHideFromDirectory = hasFeature('directory_visibility');
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadVisibility = useCallback(async () => {
    if (!barbershopId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('barbershops')
      .select('is_public_in_directory')
      .eq('id', barbershopId)
      .single();

    if (error) {
      console.error('[BARBERSHOP_VISIBILITY_LOAD]', error);
      toast.error(
        english
          ? 'Could not load directory visibility.'
          : 'Não foi possível carregar a visibilidade da barbearia.',
      );
    } else {
      setIsVisible(
        canHideFromDirectory
          ? (data?.is_public_in_directory ?? true)
          : true,
      );
    }

    setLoading(false);
  }, [barbershopId, canHideFromDirectory, english]);

  useEffect(() => {
    void loadVisibility();
  }, [loadVisibility]);

  const handleChange = async (nextValue: boolean) => {
    if (!barbershopId || saving || !canHideFromDirectory) return;

    const previousValue = isVisible;
    setIsVisible(nextValue);
    setSaving(true);

    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setSaving(false);
      setIsVisible(previousValue);
      toast.error(
        english
          ? 'Your session expired. Sign in again.'
          : 'A tua sessão expirou. Inicia sessão novamente.',
      );
      return;
    }

    const { error } = await supabase.rpc(
      'set_barbershop_directory_visibility',
      {
        p_actor_user_id: user.id,
        p_barbershop_id: barbershopId,
        p_visible: nextValue,
      },
    );

    setSaving(false);

    if (error) {
      console.error('[BARBERSHOP_VISIBILITY_UPDATE]', error);
      setIsVisible(previousValue);
      toast.error(
        error.message.includes('DIRECTORY_VISIBILITY_PRO_REQUIRED')
          ? english
            ? 'Upgrade to Pro to hide your barbershop from the directory.'
            : 'Faz upgrade para Pro para ocultares a barbearia do diretório.'
          : english
            ? 'Could not update directory visibility.'
            : 'Não foi possível atualizar a visibilidade.',
      );
      return;
    }

    toast.success(
      nextValue
        ? english
          ? 'Your barbershop is visible in the directory again.'
          : 'A tua barbearia voltou a aparecer no diretório.'
        : english
          ? 'Your barbershop is hidden from the directory.'
          : 'A tua barbearia deixou de aparecer no diretório.',
    );
  };

  return (
    <section className="mb-6 rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-400">
            <Globe2 className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">
                {english ? 'Directory visibility' : 'Visibilidade no diretório'}
              </h2>
              <FeaturePlanBadge feature="directory_visibility" />
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-400">
              {english
                ? 'Choose whether your barbershop appears in /barbearias, where customers can discover and book services.'
                : 'Controla se a tua barbearia aparece em /barbearias, onde os clientes podem descobrir e agendar serviços.'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {loading || saving || planLoading ? (
            <Loader2 className="size-4 animate-spin text-zinc-500" />
          ) : null}
          <Switch
            checked={!canHideFromDirectory || isVisible}
            disabled={loading || saving || planLoading || !barbershopId || !canHideFromDirectory}
            onCheckedChange={handleChange}
            aria-label={
              english
                ? 'Show barbershop in public directory'
                : 'Mostrar barbearia no diretório público'
            }
          />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-zinc-500">
        {!canHideFromDirectory
          ? english
            ? 'On Free, your barbershop always appears in the directory. Upgrade to Pro to hide it; your direct link will remain available.'
            : 'No plano Free, a tua barbearia aparece sempre no diretório. Faz upgrade para Pro para a ocultares; o link direto continua disponível.'
          : isVisible
            ? english
              ? 'Visible: your barbershop can appear in public search results.'
              : 'Visível: a tua barbearia pode aparecer nos resultados públicos.'
            : english
              ? 'Hidden: your barbershop no longer appears in the public directory, but its direct link remains available.'
              : 'Oculta: a tua barbearia não aparece no diretório público, mas o teu link direto continua disponível.'}
      </div>
    </section>
  );
}
