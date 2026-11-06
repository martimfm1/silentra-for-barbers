'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, Save, Search } from 'lucide-react';
import {
  AddressAutocomplete,
  type AddressSuggestion,
} from '@/components/location/address-autocomplete';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { SilentraLoading } from '@/components/ui/silentra-loading';
import { barbershopService } from '@/app/dashboard/_services/barbershop.service';
import { toast } from 'sonner';

export function SettingsLocationPanel({
  barbershopId,
}: {
  barbershopId: string;
}) {
  const [address, setAddress] = useState('');
  const [selected, setSelected] = useState<AddressSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void barbershopService.getConfig(barbershopId).then((result) => {
      if (!active) return;
      if (result.data?.address) setAddress(result.data.address);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [barbershopId]);

  const handleSelect = (suggestion: AddressSuggestion) => {
    setAddress(suggestion.fullAddress || suggestion.streetWithNumber);
    setSelected(suggestion);
  };

  const save = async () => {
    if (!selected) {
      toast.error(
        'Escolha uma morada sugerida para atualizar também a posição no mapa.',
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/barbershops/${barbershopId}/location`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: selected.fullAddress || address,
            latitude: selected.lat,
            longitude: selected.lng,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || 'Não foi possível atualizar a localização.',
        );
      setAddress(data.address || address);
      toast.success('Morada e localização do mapa atualizadas.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível guardar a localização.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-white/10 bg-black/40">
        <CardContent className="flex min-h-32 items-center justify-center">
          <SilentraLoading variant="compact" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-500/20 bg-emerald-500/[0.04] backdrop-blur-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-zinc-100">
          <MapPin className="size-4 text-emerald-400" /> Morada e localização
        </CardTitle>
        <CardDescription className="text-xs leading-5 text-zinc-400">
          Pesquise a morada correta e escolha o resultado certo. A posição
          guardada é usada no mapa e na ordenação por proximidade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AddressAutocomplete
          value={address}
          onChange={(value) => {
            setAddress(value);
            setSelected(null);
          }}
          onSelect={handleSelect}
          inputId="settings-location-address"
          placeholder="Pesquise a rua, número ou código postal…"
          className="border-white/10 bg-white/5"
        />

        {selected ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] p-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-100">
                Morada confirmada
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                {selected.fullAddress}
              </p>
              <p className="mt-1 text-[11px] text-zinc-600">
                Coordenadas: {selected.lat.toFixed(5)},{' '}
                {selected.lng.toFixed(5)}
              </p>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <Search className="size-3.5" /> Comece a escrever e escolha uma
            sugestão para obter uma posição precisa.
          </p>
        )}

        <Button
          type="button"
          onClick={save}
          disabled={saving || !selected}
          className="min-h-11 rounded-xl bg-zinc-50 text-zinc-950 hover:bg-white disabled:opacity-50"
        >
          {saving ? (
            <Spinner className="mr-2 size-4" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          {saving ? 'A guardar…' : 'Guardar localização'}
        </Button>
      </CardContent>
    </Card>
  );
}
