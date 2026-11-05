-- New Auth users must always enter as CRM clients.
-- Never trust role values supplied through user-editable auth metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name_complete, num_phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name_complete', 'Utilizador'),
    coalesce(new.raw_user_meta_data->>'num_phone', ''),
    'client'
  );
  return new;
exception
  when unique_violation then return new;
  when others then
    raise log 'Erro no Trigger handle_new_user: %', SQLERRM;
    return new;
end;
$$;
