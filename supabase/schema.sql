


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."appointment_status" AS ENUM (
    'pending',
    'scheduled',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."appointment_status" OWNER TO "postgres";


CREATE TYPE "public"."subscription_plan" AS ENUM (
    'free',
    'pro',
    'enterprise'
);


ALTER TYPE "public"."subscription_plan" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'active',
    'trialing',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'unpaid',
    'paused'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."whatsapp_bot_status" AS ENUM (
    'NOT_INITIALIZED',
    'INITIALIZING',
    'qr',
    'CONNECTED',
    'DISCONNECTED',
    'ERROR'
);


ALTER TYPE "public"."whatsapp_bot_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_receita_barbearia"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF (NEW.status = 'concluido' AND OLD.status != 'concluido') THEN
    UPDATE barbearias
    SET receita_total_acumulada = receita_total_acumulada + (
      SELECT preco FROM servicos WHERE id = NEW.servico_id
    )
    WHERE id = NEW.barbearia_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."atualizar_receita_barbearia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_email_exists"("email_to_check" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(email_to_check)
  );
END;
$$;


ALTER FUNCTION "public"."check_email_exists"("email_to_check" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_if_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."check_if_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_barbershop_onboarding"("p_barbershop_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_barbershop_id is null then
    raise exception 'barbershop id is required';
  end if;

  if not exists (
    select 1
    from public.barbershops b
    where b.id = p_barbershop_id
      and b.created_by = auth.uid()
  ) then
    raise exception 'barbershop ownership validation failed';
  end if;

  if exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.barbershop_id is not null
  ) then
    raise exception 'user already belongs to a barbershop';
  end if;

  perform set_config('app.silentra_onboarding_owner_link', 'true', true);

  update public.users
  set barbershop_id = p_barbershop_id,
      role = 'owner'
  where id = auth.uid();

  if not found then
    raise exception 'user profile not found';
  end if;

  perform set_config('app.silentra_onboarding_owner_link', 'false', true);
end;
$$;


ALTER FUNCTION "public"."complete_barbershop_onboarding"("p_barbershop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_barbershop_invite_code"("p_role" "text" DEFAULT 'barber'::"text") RETURNS TABLE("code" "text", "expires_at" timestamp with time zone, "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_user uuid := auth.uid(); v_barbershop_id uuid; v_code text; v_hash text; v_expires timestamptz := now() + interval '10 minutes';
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_role not in ('admin', 'manager', 'barber', 'receptionist') then raise exception 'invalid_role' using errcode = '22023'; end if;
  select u.barbershop_id into v_barbershop_id from public.users u where u.id = v_user and u.role in ('owner', 'admin');
  if v_barbershop_id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  v_code := upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 10));
  v_hash := encode(digest(v_code, 'sha256'), 'hex');
  insert into public.barbershop_invite_codes (barbershop_id, code_hash, role, expires_at, created_by) values (v_barbershop_id, v_hash, p_role, v_expires, v_user);
  return query select v_code, v_expires, p_role;
end;
$$;


ALTER FUNCTION "public"."create_barbershop_invite_code"("p_role" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."pos_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "client_id" "uuid",
    "appointment_id" "uuid",
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "discount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "payment_method" "text" NOT NULL,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pos_transactions_discount_check" CHECK (("discount" >= (0)::numeric)),
    CONSTRAINT "pos_transactions_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'card'::"text", 'transfer'::"text", 'other'::"text"]))),
    CONSTRAINT "pos_transactions_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'refunded'::"text", 'void'::"text"]))),
    CONSTRAINT "pos_transactions_subtotal_check" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "pos_transactions_total_check" CHECK (("total" >= (0)::numeric))
);


ALTER TABLE "public"."pos_transactions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_pos_transaction_atomic"("p_barbershop_id" "uuid", "p_location_id" "uuid", "p_client_id" "uuid", "p_appointment_id" "uuid", "p_payment_method" "text", "p_discount" numeric, "p_created_by" "uuid", "p_items" "jsonb") RETURNS "public"."pos_transactions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_transaction public.pos_transactions;
  v_item jsonb;
  v_product public.inventory_products;
  v_service public.services;
  v_product_id uuid;
  v_service_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_expected_price numeric;
  v_description text;
  v_subtotal numeric := 0;
  v_discount numeric := greatest(coalesce(p_discount, 0), 0);
  v_total numeric;
begin
  if p_payment_method not in ('cash', 'card', 'transfer', 'other') then
    raise exception using errcode = '22023', message = 'Invalid payment method';
  end if;

  if p_created_by is null then
    raise exception using errcode = '22023', message = 'Created by is required';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = '22023', message = 'At least one POS item is required';
  end if;

  if p_location_id is not null and not exists (
    select 1 from public.locations l
    where l.id = p_location_id and l.parent_barbershop_id = p_barbershop_id
  ) then
    raise exception using errcode = '42501', message = 'Location does not belong to this barbershop';
  end if;

  if p_client_id is not null and not exists (
    select 1 from public.users u
    where u.id = p_client_id and u.barbershop_id = p_barbershop_id
  ) then
    raise exception using errcode = '42501', message = 'Client does not belong to this barbershop';
  end if;

  if p_appointment_id is not null and not exists (
    select 1 from public.appointments a
    where a.id = p_appointment_id and a.barbershop_id = p_barbershop_id
  ) then
    raise exception using errcode = '42501', message = 'Appointment does not belong to this barbershop';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'productId', '')::uuid;
    v_service_id := nullif(v_item->>'serviceId', '')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unitPrice')::numeric;
    v_description := left(trim(coalesce(v_item->>'description', '')), 200);

    if (v_product_id is null and v_service_id is null) or (v_product_id is not null and v_service_id is not null) then
      raise exception using errcode = '22023', message = 'Each POS item must reference exactly one product or service';
    end if;

    if v_quantity is null or v_quantity <= 0 or v_quantity > 100000 then
      raise exception using errcode = '22023', message = 'Invalid item quantity';
    end if;

    if v_unit_price is null or v_unit_price < 0 then
      raise exception using errcode = '22023', message = 'Invalid item price';
    end if;

    if v_description = '' then
      raise exception using errcode = '22023', message = 'Item description is required';
    end if;

    if v_product_id is not null then
      select * into v_product
      from public.inventory_products
      where id = v_product_id and barbershop_id = p_barbershop_id and active = true
      for update;

      if not found then
        raise exception using errcode = '42501', message = 'Product does not belong to this barbershop';
      end if;

      v_expected_price := v_product.unit_price;

      if round(v_unit_price, 2) <> round(v_expected_price, 2) then
        raise exception using errcode = '22023', message = 'Product price changed; refresh the POS';
      end if;

      if v_product.stock_quantity < v_quantity then
        raise exception using errcode = 'P0001', message = format('Insufficient stock for product %s', v_product.name);
      end if;
    else
      select s.* into v_service
      from public.services s
      where s.id = v_service_id and s.barbershop_id = p_barbershop_id;

      if not found then
        raise exception using errcode = '42501', message = 'Service does not belong to this barbershop';
      end if;

      v_expected_price := v_service.price;

      if round(v_unit_price, 2) <> round(v_expected_price, 2) then
        raise exception using errcode = '22023', message = 'Service price changed; refresh the POS';
      end if;
    end if;

    v_subtotal := v_subtotal + round(v_quantity * v_expected_price, 2);
  end loop;

  v_subtotal := round(v_subtotal, 2);
  v_discount := least(v_discount, v_subtotal);
  v_total := round(v_subtotal - v_discount, 2);

  insert into public.pos_transactions (
    barbershop_id, location_id, client_id, appointment_id,
    subtotal, discount, total, payment_method, status, created_by
  ) values (
    p_barbershop_id, p_location_id, p_client_id, p_appointment_id,
    v_subtotal, v_discount, v_total, p_payment_method, 'completed', p_created_by
  ) returning * into v_transaction;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'productId', '')::uuid;
    v_service_id := nullif(v_item->>'serviceId', '')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unitPrice')::numeric;
    v_description := left(trim(coalesce(v_item->>'description', '')), 200);

    insert into public.pos_transaction_items (
      transaction_id, product_id, service_id, description, quantity, unit_price
    ) values (
      v_transaction.id, v_product_id, v_service_id, v_description, v_quantity, v_unit_price
    );

    if v_product_id is not null then
      update public.inventory_products
      set stock_quantity = stock_quantity - v_quantity,
          updated_at = now()
      where id = v_product_id and barbershop_id = p_barbershop_id;

      insert into public.inventory_movements (
        product_id, barbershop_id, quantity, reason, reference_id, created_by
      ) values (
        v_product_id, p_barbershop_id, -v_quantity, 'sale', v_transaction.id, p_created_by
      );
    end if;
  end loop;

  return v_transaction;
end;
$$;


ALTER FUNCTION "public"."create_pos_transaction_atomic"("p_barbershop_id" "uuid", "p_location_id" "uuid", "p_client_id" "uuid", "p_appointment_id" "uuid", "p_payment_method" "text", "p_discount" numeric, "p_created_by" "uuid", "p_items" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."professionals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "commission_percentage" integer DEFAULT 50,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."professionals" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_professional_with_plan_quota"("p_actor_user_id" "uuid", "p_barbershop_id" "uuid", "p_name" character varying, "p_commission_percentage" integer DEFAULT NULL::integer, "p_active" boolean DEFAULT true) RETURNS "public"."professionals"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_barbershop_id uuid;
  v_role text;
  v_plan text := 'free';
  v_limit integer := 1;
  v_count integer;
  v_professional public.professionals;
  v_commission integer;
  v_has_permission boolean := false;
begin
  if p_name is null or length(btrim(p_name)) = 0 or length(p_name) > 120 then
    raise exception using errcode = '22023', message = 'INVALID_NAME';
  end if;

  if p_commission_percentage is not null
     and (p_commission_percentage < 0 or p_commission_percentage > 100) then
    raise exception using errcode = '22023', message = 'INVALID_COMMISSION';
  end if;

  select u.barbershop_id, lower(coalesce(u.role, ''))
    into v_user_barbershop_id, v_role
  from public.users u
  where u.id = p_actor_user_id;

  if v_user_barbershop_id is null or v_user_barbershop_id <> p_barbershop_id then
    raise exception using errcode = '42501', message = 'BARBERSHOP_ACCESS_DENIED';
  end if;

  if v_role in ('admin', 'owner') then
    v_has_permission := true;
  else
    select exists (
      select 1
      from public.staff_permissions sp
      where sp.barbershop_id = p_barbershop_id
        and sp.user_id = p_actor_user_id
        and sp.permission in ('manage_professionals', 'team_management', 'manage_team')
        and sp.allowed = true
    ) into v_has_permission;
  end if;

  if not v_has_permission then
    raise exception using errcode = '42501', message = 'PROFESSIONAL_MANAGEMENT_DENIED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_barbershop_id::text, 0));

  select coalesce(public.get_effective_billing_plan(p_actor_user_id), 'free')
    into v_plan;

  v_limit := case v_plan
    when 'free' then 1
    when 'pro' then 5
    when 'enterprise' then null
    else 1
  end;

  select count(*)::integer
    into v_count
  from public.professionals
  where barbershop_id = p_barbershop_id;

  if v_limit is not null and v_count >= v_limit then
    raise exception using errcode = 'P0001', message = 'PROFESSIONAL_LIMIT_REACHED';
  end if;

  v_commission := case
    when v_plan = 'free' then 100
    else coalesce(p_commission_percentage, 100)
  end;

  insert into public.professionals (barbershop_id, name, commission_percentage, active)
  values (p_barbershop_id, btrim(p_name), v_commission, coalesce(p_active, true))
  returning * into v_professional;

  insert into public.audit_logs (action, entity_type, entity_id, metadata, created_at)
  values (
    'professional.created',
    'professional',
    v_professional.id::text,
    jsonb_build_object(
      'barbershop_id', p_barbershop_id,
      'plan', v_plan,
      'plan_source', case when exists (
        select 1 from public.subscriptions s
        where s.user_id = p_actor_user_id and s.plan_override in ('pro', 'enterprise')
      ) then 'admin_override' else 'subscription' end,
      'actor_user_id', p_actor_user_id
    ),
    now()
  );

  return v_professional;
end;
$$;


ALTER FUNCTION "public"."create_professional_with_plan_quota"("p_actor_user_id" "uuid", "p_barbershop_id" "uuid", "p_name" character varying, "p_commission_percentage" integer, "p_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_professional_plan_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_plan text := 'free';
  v_count integer := 0;
  v_existing_id uuid;
begin
  select case
    when s.status in ('active', 'trialing') and s.plan in ('pro', 'enterprise')
      then s.plan::text
    else 'free'
  end
    into v_plan
  from public.subscriptions s
  join public.users u on u.id = s.user_id
  where u.barbershop_id = new.barbershop_id
  order by case when s.status in ('active', 'trialing') then 0 else 1 end,
           s.updated_at desc
  limit 1;

  if v_plan = 'free' then
    if tg_op = 'INSERT' then
      perform pg_advisory_xact_lock(hashtextextended(new.barbershop_id::text, 0));

      select count(*)::integer
        into v_count
      from public.professionals
      where barbershop_id = new.barbershop_id;

      if v_count >= 1 then
        raise exception using errcode = 'P0001', message = 'PROFESSIONAL_LIMIT_REACHED';
      end if;
    end if;

    -- The Free plan intentionally does not expose commission configuration.
    new.commission_percentage := 100;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_professional_plan_rules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_effective_billing_plan"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when s.plan_override in ('pro', 'enterprise') then s.plan_override::text
    when s.plan::text in ('pro', 'enterprise') and s.status in ('active', 'trialing') then s.plan::text
    else 'free'::text
  end
  from public.subscriptions s
  where s.user_id = p_user_id
  limit 1;
$$;


ALTER FUNCTION "public"."get_effective_billing_plan"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_barbershop_id"() RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT barbershop_id::text FROM public.users WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_barbershop_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (id, email, name_complete, num_phone, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name_complete', 'Utilizador'),
    COALESCE(new.raw_user_meta_data->>'num_phone', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'client')
  );
  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    -- Se o utilizador já existir por erro de testes passados, ignora o conflito e avança
    RETURN new;
  WHEN others THEN
    -- Permite capturar o erro nos logs internos do Postgres
    RAISE LOG 'Erro no Trigger handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_subscription"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_subscription"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_update_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = auth.uid() AND role = 'admin' -- Ajusta 'role = admin' para a tua coluna real (ex: is_admin = true)
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_barbershop_with_invite"("p_code" "text") RETURNS TABLE("barbershop_id" "uuid", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_user uuid := auth.uid(); v_hash text; v_invite public.barbershop_invite_codes%rowtype;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if nullif(trim(p_code), '') is null then raise exception 'invalid_code' using errcode = '22023'; end if;
  v_hash := encode(digest(upper(trim(p_code)), 'sha256'), 'hex');
  select * into v_invite from public.barbershop_invite_codes where code_hash = v_hash and used_at is null and expires_at > now() order by created_at desc limit 1 for update;
  if not found then raise exception 'invalid_or_expired_code' using errcode = '22023'; end if;
  update public.users set barbershop_id = v_invite.barbershop_id, role = v_invite.role where id = v_user;
  if not found then raise exception 'user_profile_not_found' using errcode = 'P0002'; end if;
  update public.barbershop_invite_codes set used_at = now(), used_by = v_user where id = v_invite.id;
  return query select v_invite.barbershop_id, v_invite.role;
end;
$$;


ALTER FUNCTION "public"."join_barbershop_with_invite"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_review"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.notification_queue (type, entity_id, barbershop_id, payload)
  VALUES (
    'new_review', 
    NEW.id, 
    NEW.barbershop_id, 
    jsonb_build_object(
      'client_name', NEW.client_name, 
      'rating', NEW.rating, 
      'comment', NEW.comment
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_new_review"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_user_tenant_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if old.id <> auth.uid() then
    raise exception 'users may only modify their own profile';
  end if;

  if coalesce(current_setting('app.silentra_onboarding_owner_link', true), 'false') = 'true' then
    if old.barbershop_id is not null then
      raise exception 'user already belongs to a barbershop';
    end if;

    if new.barbershop_id is null or new.role <> 'owner' then
      raise exception 'invalid onboarding owner association';
    end if;

    return new;
  end if;

  if new.id <> old.id
     or new.barbershop_id is distinct from old.barbershop_id
     or new.role is distinct from old.role then
    raise exception 'protected account fields cannot be changed by the client';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."protect_user_tenant_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_pos_transaction_atomic"("p_transaction_id" "uuid", "p_barbershop_id" "uuid", "p_user_id" "uuid", "p_mode" "text" DEFAULT 'refund'::"text") RETURNS "public"."pos_transactions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_transaction public.pos_transactions;
  v_item record;
  v_product public.inventory_products;
  v_target_status text;
begin
  if p_transaction_id is null or p_barbershop_id is null or p_user_id is null then
    raise exception using errcode = '22023', message = 'Transaction, barbershop and user are required';
  end if;

  if p_mode not in ('refund', 'void') then
    raise exception using errcode = '22023', message = 'Invalid POS reversal mode';
  end if;

  select * into v_transaction
  from public.pos_transactions
  where id = p_transaction_id
    and barbershop_id = p_barbershop_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Transaction does not belong to this barbershop';
  end if;

  if v_transaction.status <> 'completed' then
    raise exception using errcode = '40901', message = 'Only completed transactions can be refunded or voided';
  end if;

  for v_item in
    select i.*
    from public.pos_transaction_items i
    where i.transaction_id = v_transaction.id
      and i.product_id is not null
    order by i.product_id
  loop
    select * into v_product
    from public.inventory_products
    where id = v_item.product_id
      and barbershop_id = p_barbershop_id
    for update;

    if not found then
      raise exception using errcode = '42501', message = 'POS product does not belong to this barbershop';
    end if;

    update public.inventory_products
    set stock_quantity = stock_quantity + v_item.quantity,
        updated_at = now()
    where id = v_item.product_id
      and barbershop_id = p_barbershop_id;

    insert into public.inventory_movements (
      product_id, barbershop_id, quantity, reason, reference_id, created_by
    ) values (
      v_item.product_id, p_barbershop_id, v_item.quantity, 'return', v_transaction.id, p_user_id
    );
  end loop;

  v_target_status := case when p_mode = 'void' then 'void' else 'refunded' end;

  update public.pos_transactions
  set status = v_target_status
  where id = v_transaction.id
  returning * into v_transaction;

  return v_transaction;
end;
$$;


ALTER FUNCTION "public"."refund_pos_transaction_atomic"("p_transaction_id" "uuid", "p_barbershop_id" "uuid", "p_user_id" "uuid", "p_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_barbershop_avatar_url"("p_barbershop_id" "uuid", "p_avatar_url" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_barbershop_id is null or p_avatar_url is null or btrim(p_avatar_url) = '' then
    raise exception 'invalid avatar update';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.barbershop_id = p_barbershop_id
      and u.role = 'admin'
  ) then
    raise exception 'avatar update not permitted';
  end if;

  -- Only accept the public Supabase Storage URL for this tenant's avatar.
  if p_avatar_url !~ ('/storage/v1/object/public/avatar/' || p_barbershop_id::text || '/avatar\.webp($|[?])') then
    raise exception 'invalid avatar url';
  end if;

  update public.barbershops
  set avatar_url = p_avatar_url,
      updated_at = now()
  where id = p_barbershop_id;
end;
$_$;


ALTER FUNCTION "public"."set_barbershop_avatar_url"("p_barbershop_id" "uuid", "p_avatar_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_barbershop_directory_visibility"("p_actor_user_id" "uuid", "p_barbershop_id" "uuid", "p_visible" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_barbershop_id uuid;
  v_role text;
  v_plan text := 'free';
begin
  select u.barbershop_id, u.role
    into v_user_barbershop_id, v_role
  from public.users u
  where u.id = p_actor_user_id;

  if v_user_barbershop_id is null or v_user_barbershop_id <> p_barbershop_id then
    raise exception using errcode = '42501', message = 'BARBERSHOP_ACCESS_DENIED';
  end if;

  if coalesce(lower(v_role), '') not in ('admin', 'owner') then
    raise exception using errcode = '42501', message = 'DIRECTORY_VISIBILITY_DENIED';
  end if;

  select case
    when s.status in ('active', 'trialing') and s.plan in ('pro', 'enterprise') then s.plan::text
    else 'free'
  end
    into v_plan
  from public.subscriptions s
  join public.users u on u.id = s.user_id
  where u.barbershop_id = p_barbershop_id
  order by case when s.status in ('active', 'trialing') then 0 else 1 end,
           s.updated_at desc
  limit 1;

  if v_plan not in ('pro', 'enterprise') then
    raise exception using errcode = '42501', message = 'DIRECTORY_VISIBILITY_PRO_REQUIRED';
  end if;

  update public.barbershops
  set is_public_in_directory = coalesce(p_visible, true)
  where id = p_barbershop_id;

  return true;
end;
$$;


ALTER FUNCTION "public"."set_barbershop_directory_visibility"("p_actor_user_id" "uuid", "p_barbershop_id" "uuid", "p_visible" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_barbershop_address_to_shops"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.shops
  SET address = NEW.address
  WHERE barbershop_id = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_barbershop_address_to_shops"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_barbershop_details_to_shops"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.shops
  SET
    name = NEW.name,
    phone = NEW.phone,
    address = NEW.address,
    opening_time = NEW.opening_time,
    closing_time = NEW.closing_time,
    lunch_start = NEW.lunch_start,
    lunch_end = NEW.lunch_end,
    closed_days = NEW.closed_days, -- Coluna da BD em inglês
    slug = NEW.slug,
    updated_at = NOW()
  WHERE barbershop_id = NEW.id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_barbershop_details_to_shops"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_barbershop_name_to_shops"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.shops
  SET name = NEW.name
  WHERE barbershop_id = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_barbershop_name_to_shops"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_barbershop_phone_to_shops"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.shops
  SET phone = NEW.phone
  WHERE barbershop_id = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_barbershop_phone_to_shops"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_barbershop_to_shop"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE shops
  SET off_days = NEW.off_days -- copia o valor de texto diretamente
  WHERE barbershop_id = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_barbershop_to_shop"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."advanced_report_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "report_type" "text" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "advanced_report_configs_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 120))),
    CONSTRAINT "advanced_report_configs_report_type_check" CHECK (("report_type" = ANY (ARRAY['revenue'::"text", 'appointments'::"text", 'clients'::"text", 'services'::"text", 'professionals'::"text", 'inventory'::"text", 'commissions'::"text"])))
);


ALTER TABLE "public"."advanced_report_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "service_id" "uuid",
    "professional_id" "uuid",
    "date_hour" timestamp with time zone NOT NULL,
    "status" "public"."appointment_status" DEFAULT 'scheduled'::"public"."appointment_status" NOT NULL,
    "manual_name" character varying(255),
    "manual_phone" character varying(50),
    "value_products" numeric(10,2) DEFAULT 0.00,
    "description_products" "text",
    "payment_method" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "manual_email" character varying(255),
    "management_token" "uuid" DEFAULT "gen_random_uuid"(),
    "management_token_expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval),
    "email_verified" boolean DEFAULT false,
    "email_verified_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "manual_birth_date" "date"
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."appointments"."manual_birth_date" IS 'Birth date supplied for a manual booking; copied to users.birth_date when the customer is added to the CRM.';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "trigger_type" "text" NOT NULL,
    "conditions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "automation_rules_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 120))),
    CONSTRAINT "automation_rules_trigger_type_check" CHECK (("trigger_type" = ANY (ARRAY['booking_created'::"text", 'booking_completed'::"text", 'booking_cancelled'::"text", 'client_inactive'::"text", 'birthday'::"text"])))
);


ALTER TABLE "public"."automation_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_id" "uuid" NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "entity_id" "uuid",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "error_message" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "automation_runs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."automation_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."barbershop_invite_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "code_hash" "text" NOT NULL,
    "role" "text" DEFAULT 'barber'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "used_by" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "barbershop_invite_codes_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'barber'::"text", 'receptionist'::"text"])))
);


ALTER TABLE "public"."barbershop_invite_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."barbershop_invite_codes" IS 'Single-use onboarding codes for joining a barbershop; codes expire after 10 minutes.';



CREATE TABLE IF NOT EXISTS "public"."barbershops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "phone" character varying(50),
    "address" "text",
    "opening_time" time without time zone,
    "closing_time" time without time zone,
    "closed_days" "text" DEFAULT '''''::text'::"text",
    "allow_online_bookings" boolean DEFAULT true,
    "auto_reminders" boolean DEFAULT false,
    "time_limit_cancellation_hours" integer DEFAULT 24,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text",
    "whatsapp_status" "public"."whatsapp_bot_status" DEFAULT 'NOT_INITIALIZED'::"public"."whatsapp_bot_status" NOT NULL,
    "updated_at" timestamp with time zone,
    "lunch_start" time without time zone,
    "lunch_end" time without time zone,
    "is_public_in_directory" boolean DEFAULT true NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."barbershops" OWNER TO "postgres";


COMMENT ON COLUMN "public"."barbershops"."whatsapp_status" IS 'Estado atual do barramento de comunicação com o contentor local da Evolution API';



COMMENT ON COLUMN "public"."barbershops"."is_public_in_directory" IS 'Controla se a barbearia aparece no diretório público /barbearias. O link direto continua disponível quando false.';



CREATE TABLE IF NOT EXISTS "public"."birthday_email_automations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "subject" "text" DEFAULT 'Feliz aniversário, {{nome}}! 🎉'::"text" NOT NULL,
    "body" "text" DEFAULT 'Olá {{nome}},

Toda a equipa da {{barbearia}} deseja-te um excelente aniversário! 🎉

Esperamos voltar a ver-te em breve.

Um abraço,
{{barbearia}}'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "birthday_email_body_length" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 8000))),
    CONSTRAINT "birthday_email_subject_length" CHECK ((("char_length"("subject") >= 1) AND ("char_length"("subject") <= 180)))
);


ALTER TABLE "public"."birthday_email_automations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."birthday_email_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "birthday_date" "date" NOT NULL,
    "email" "text" NOT NULL,
    "status" "text" NOT NULL,
    "provider_message_id" "text",
    "error_message" "text",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "birthday_email_logs_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."birthday_email_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "appointment_id" "uuid",
    "gross_amount" numeric(12,2) NOT NULL,
    "commission_percentage" numeric(5,2) NOT NULL,
    "commission_amount" numeric(12,2) GENERATED ALWAYS AS ("round"((("gross_amount" * "commission_percentage") / (100)::numeric), 2)) STORED,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commissions_commission_percentage_check" CHECK ((("commission_percentage" >= (0)::numeric) AND ("commission_percentage" <= (100)::numeric))),
    CONSTRAINT "commissions_gross_amount_check" CHECK (("gross_amount" >= (0)::numeric)),
    CONSTRAINT "commissions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'paid'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."commissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_segments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "rules" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_segments_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 120)))
);


ALTER TABLE "public"."customer_segments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_tag_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customer_tag_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_tags_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 80)))
);


ALTER TABLE "public"."customer_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "to_email" "text" NOT NULL,
    "template_name" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "quantity" numeric(12,3) NOT NULL,
    "reason" "text" NOT NULL,
    "reference_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_movements_quantity_check" CHECK (("quantity" <> (0)::numeric)),
    CONSTRAINT "inventory_movements_reason_check" CHECK (("reason" = ANY (ARRAY['purchase'::"text", 'sale'::"text", 'adjustment'::"text", 'return'::"text", 'waste'::"text"])))
);


ALTER TABLE "public"."inventory_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "name" "text" NOT NULL,
    "sku" "text",
    "unit_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "stock_quantity" numeric(12,3) DEFAULT 0 NOT NULL,
    "low_stock_threshold" numeric(12,3) DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_products_low_stock_threshold_check" CHECK (("low_stock_threshold" >= (0)::numeric)),
    CONSTRAINT "inventory_products_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 160))),
    CONSTRAINT "inventory_products_stock_quantity_check" CHECK (("stock_quantity" >= (0)::numeric)),
    CONSTRAINT "inventory_products_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."inventory_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."location_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "location_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "location_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."location_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_barbershop_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "phone" "text",
    "address" "text",
    "opening_time" time without time zone,
    "closing_time" time without time zone,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "locations_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 120)))
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "points_balance" integer DEFAULT 0 NOT NULL,
    "lifetime_points" integer DEFAULT 0 NOT NULL,
    "tier" "text" DEFAULT 'bronze'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loyalty_accounts_lifetime_points_check" CHECK (("lifetime_points" >= 0)),
    CONSTRAINT "loyalty_accounts_points_balance_check" CHECK (("points_balance" >= 0)),
    CONSTRAINT "loyalty_accounts_tier_check" CHECK (("tier" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text"])))
);


ALTER TABLE "public"."loyalty_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "reward_id" "uuid" NOT NULL,
    "points_spent" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fulfilled_at" timestamp with time zone,
    CONSTRAINT "loyalty_redemptions_points_spent_check" CHECK (("points_spent" > 0)),
    CONSTRAINT "loyalty_redemptions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'fulfilled'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."loyalty_redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "points_cost" integer NOT NULL,
    "reward_type" "text" DEFAULT 'discount'::"text" NOT NULL,
    "reward_value" numeric(10,2),
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loyalty_rewards_name_check" CHECK ((("length"(TRIM(BOTH FROM "name")) >= 1) AND ("length"(TRIM(BOTH FROM "name")) <= 120))),
    CONSTRAINT "loyalty_rewards_points_cost_check" CHECK ((("points_cost" > 0) AND ("points_cost" <= 10000000))),
    CONSTRAINT "loyalty_rewards_reward_type_check" CHECK (("reward_type" = ANY (ARRAY['discount'::"text", 'free_service'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."loyalty_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_settings" (
    "barbershop_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "points_per_euro" numeric(10,2) DEFAULT 1 NOT NULL,
    "welcome_points" integer DEFAULT 0 NOT NULL,
    "referral_points" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loyalty_settings_points_per_euro_check" CHECK ((("points_per_euro" > (0)::numeric) AND ("points_per_euro" <= (100)::numeric))),
    CONSTRAINT "loyalty_settings_referral_points_check" CHECK ((("referral_points" >= 0) AND ("referral_points" <= 100000))),
    CONSTRAINT "loyalty_settings_welcome_points_check" CHECK ((("welcome_points" >= 0) AND ("welcome_points" <= 100000)))
);


ALTER TABLE "public"."loyalty_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "points" integer NOT NULL,
    "type" "text" NOT NULL,
    "reference_id" "uuid",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loyalty_transactions_points_check" CHECK (("points" <> 0)),
    CONSTRAINT "loyalty_transactions_type_check" CHECK (("type" = ANY (ARRAY['booking'::"text", 'welcome'::"text", 'referral'::"text", 'adjustment'::"text", 'redemption'::"text"])))
);


ALTER TABLE "public"."loyalty_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "entity_id" "uuid",
    "barbershop_id" "uuid",
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "platform" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pos_transaction_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "service_id" "uuid",
    "description" "text" NOT NULL,
    "quantity" numeric(12,3) NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "total" numeric(12,2) GENERATED ALWAYS AS ("round"(("quantity" * "unit_price"), 2)) STORED,
    CONSTRAINT "pos_transaction_items_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "pos_transaction_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."pos_transaction_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "count" integer DEFAULT 1 NOT NULL,
    "last_request" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "client_name" "text" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."schedule_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "duration" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "popular" boolean DEFAULT false
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "city" "text" NOT NULL,
    "price" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "lat" double precision DEFAULT 0,
    "lng" double precision DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text",
    "name" "text",
    "phone" "text",
    "address" "text",
    "opening_time" time without time zone,
    "closing_time" time without time zone,
    "lunch_start" time without time zone,
    "lunch_end" time without time zone,
    "closed_days" "text" DEFAULT 'domingo'::"text",
    "popular_service_id" "uuid",
    "rating" numeric(3,2) DEFAULT 0.00,
    "reviews_count" integer DEFAULT 0
);


ALTER TABLE "public"."shops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "permission" "text" NOT NULL,
    "allowed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_permissions_permission_check" CHECK (("permission" = ANY (ARRAY['appointments'::"text", 'clients'::"text", 'services'::"text", 'analytics'::"text", 'marketing'::"text", 'loyalty'::"text", 'inventory'::"text", 'pos'::"text", 'commissions'::"text", 'billing'::"text", 'team'::"text"])))
);


ALTER TABLE "public"."staff_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "plan" "public"."subscription_plan" DEFAULT 'free'::"public"."subscription_plan" NOT NULL,
    "status" "public"."subscription_status" DEFAULT 'active'::"public"."subscription_status" NOT NULL,
    "trial_end" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "canceled_at" timestamp with time zone,
    "canceled_by_user_id" "uuid",
    "cancellation_requested_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_override" "text",
    CONSTRAINT "subscriptions_plan_override_check" CHECK ((("plan_override" IS NULL) OR ("plan_override" = ANY (ARRAY['free'::"text", 'pro'::"text", 'enterprise'::"text"])))),
    CONSTRAINT "subscriptions_stripe_customer_id_check" CHECK ((("stripe_customer_id" IS NULL) OR ("stripe_customer_id" ~~ 'cus_%'::"text"))),
    CONSTRAINT "subscriptions_stripe_price_id_check" CHECK ((("stripe_price_id" IS NULL) OR ("stripe_price_id" ~~ 'price_%'::"text"))),
    CONSTRAINT "subscriptions_stripe_subscription_id_check" CHECK ((("stripe_subscription_id" IS NULL) OR ("stripe_subscription_id" ~~ 'sub_%'::"text"))),
    CONSTRAINT "subscriptions_trial_end_check" CHECK ((("trial_end" IS NULL) OR ("current_period_end" IS NULL) OR ("trial_end" <= "current_period_end")))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscriptions" IS 'Billing state for every user. One row per user. Provisioned on signup with plan=free.';



COMMENT ON COLUMN "public"."subscriptions"."user_id" IS 'FK to auth.users. CASCADE delete ensures no orphan billing rows.';



COMMENT ON COLUMN "public"."subscriptions"."stripe_customer_id" IS 'Stripe customer ID (cus_*). NULL until user initiates checkout.';



COMMENT ON COLUMN "public"."subscriptions"."stripe_subscription_id" IS 'Stripe subscription ID (sub_*). NULL on free plan.';



COMMENT ON COLUMN "public"."subscriptions"."stripe_price_id" IS 'Active Stripe price ID (price_*). NULL on free plan.';



COMMENT ON COLUMN "public"."subscriptions"."plan" IS 'Resolved plan name derived from stripe_price_id. Denormalised for fast reads.';



COMMENT ON COLUMN "public"."subscriptions"."status" IS 'Mirror of Stripe subscription status. Kept in sync via webhook.';



COMMENT ON COLUMN "public"."subscriptions"."trial_end" IS 'UTC timestamp when the trial ends. NULL if no trial.';



COMMENT ON COLUMN "public"."subscriptions"."current_period_end" IS 'UTC timestamp when current billing period ends. NULL on free plan.';



COMMENT ON COLUMN "public"."subscriptions"."cancel_at_period_end" IS 'True if the subscription will cancel at current_period_end.';



COMMENT ON COLUMN "public"."subscriptions"."canceled_at" IS 'UTC timestamp when Stripe marked the subscription as canceled.';



COMMENT ON COLUMN "public"."subscriptions"."canceled_by_user_id" IS 'User who requested the cancellation when it was initiated from the application.';



COMMENT ON COLUMN "public"."subscriptions"."cancellation_requested_at" IS 'UTC timestamp when cancellation was requested by a user.';



COMMENT ON COLUMN "public"."subscriptions"."plan_override" IS 'Administrative entitlement override. pro/enterprise is treated as active paid access by application and database quota checks. null returns control to Stripe/local subscription state; free explicitly forces Free.';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barbershop_id" "uuid",
    "name_complete" character varying(150) NOT NULL,
    "num_phone" character varying(25),
    "email" character varying(255),
    "style_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'barber'::"text",
    "name" "text" DEFAULT 'user'::"text",
    "birth_date" "date",
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'barber'::"text", 'receptionist'::"text", 'staff'::"text", 'client'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verification_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "hashed_token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."verification_tokens" OWNER TO "postgres";


ALTER TABLE ONLY "public"."advanced_report_configs"
    ADD CONSTRAINT "advanced_report_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_management_token_key" UNIQUE ("management_token");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_rules"
    ADD CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_runs"
    ADD CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barbershop_invite_codes"
    ADD CONSTRAINT "barbershop_invite_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barbershops"
    ADD CONSTRAINT "barbershops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."birthday_email_automations"
    ADD CONSTRAINT "birthday_email_automations_barbershop_id_key" UNIQUE ("barbershop_id");



ALTER TABLE ONLY "public"."birthday_email_automations"
    ADD CONSTRAINT "birthday_email_automations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."birthday_email_logs"
    ADD CONSTRAINT "birthday_email_logs_barbershop_id_client_id_birthday_date_key" UNIQUE ("barbershop_id", "client_id", "birthday_date");



ALTER TABLE ONLY "public"."birthday_email_logs"
    ADD CONSTRAINT "birthday_email_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_segments"
    ADD CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_tag_assignments"
    ADD CONSTRAINT "customer_tag_assignments_client_id_tag_id_key" UNIQUE ("client_id", "tag_id");



ALTER TABLE ONLY "public"."customer_tag_assignments"
    ADD CONSTRAINT "customer_tag_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_tags"
    ADD CONSTRAINT "customer_tags_barbershop_id_name_key" UNIQUE ("barbershop_id", "name");



ALTER TABLE ONLY "public"."customer_tags"
    ADD CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."email_queue"
    ADD CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_products"
    ADD CONSTRAINT "inventory_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location_members"
    ADD CONSTRAINT "location_members_location_id_user_id_key" UNIQUE ("location_id", "user_id");



ALTER TABLE ONLY "public"."location_members"
    ADD CONSTRAINT "location_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_parent_barbershop_id_slug_key" UNIQUE ("parent_barbershop_id", "slug");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_accounts"
    ADD CONSTRAINT "loyalty_accounts_barbershop_id_client_id_key" UNIQUE ("barbershop_id", "client_id");



ALTER TABLE ONLY "public"."loyalty_accounts"
    ADD CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_settings"
    ADD CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("barbershop_id");



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_queue"
    ADD CONSTRAINT "notification_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_subscriptions"
    ADD CONSTRAINT "notification_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."notification_subscriptions"
    ADD CONSTRAINT "notification_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pos_transaction_items"
    ADD CONSTRAINT "pos_transaction_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pos_transactions"
    ADD CONSTRAINT "pos_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_blocks"
    ADD CONSTRAINT "schedule_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_barbershop_id_key" UNIQUE ("barbershop_id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."staff_permissions"
    ADD CONSTRAINT "staff_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_permissions"
    ADD CONSTRAINT "staff_permissions_user_id_permission_key" UNIQUE ("user_id", "permission");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_unique" UNIQUE ("barbershop_id", "email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_phone_unique" UNIQUE ("barbershop_id", "num_phone");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verification_tokens"
    ADD CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id");



CREATE INDEX "advanced_report_configs_tenant_idx" ON "public"."advanced_report_configs" USING "btree" ("barbershop_id");



CREATE INDEX "automation_rules_tenant_idx" ON "public"."automation_rules" USING "btree" ("barbershop_id", "active");



CREATE INDEX "automation_runs_rule_idx" ON "public"."automation_runs" USING "btree" ("rule_id", "status");



CREATE INDEX "barbershop_invite_codes_active_idx" ON "public"."barbershop_invite_codes" USING "btree" ("barbershop_id", "expires_at") WHERE ("used_at" IS NULL);



CREATE UNIQUE INDEX "barbershop_invite_codes_code_hash_idx" ON "public"."barbershop_invite_codes" USING "btree" ("code_hash");



CREATE INDEX "barbershops_created_by_idx" ON "public"."barbershops" USING "btree" ("created_by");



CREATE INDEX "commissions_tenant_idx" ON "public"."commissions" USING "btree" ("barbershop_id", "status", "created_at" DESC);



CREATE INDEX "customer_segments_tenant_idx" ON "public"."customer_segments" USING "btree" ("barbershop_id", "created_at" DESC);



CREATE INDEX "customer_tag_assignments_client_idx" ON "public"."customer_tag_assignments" USING "btree" ("barbershop_id", "client_id");



CREATE INDEX "customer_tags_tenant_idx" ON "public"."customer_tags" USING "btree" ("barbershop_id");



CREATE INDEX "idx_appointments_management_token" ON "public"."appointments" USING "btree" ("management_token");



CREATE INDEX "idx_appointments_management_token_expires_at" ON "public"."appointments" USING "btree" ("management_token_expires_at");



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_entity" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_barbershops_public_directory" ON "public"."barbershops" USING "btree" ("is_public_in_directory") WHERE ("is_public_in_directory" = true);



CREATE INDEX "idx_birthday_automations_enabled" ON "public"."birthday_email_automations" USING "btree" ("enabled", "barbershop_id");



CREATE INDEX "idx_birthday_logs_date" ON "public"."birthday_email_logs" USING "btree" ("birthday_date", "status");



CREATE INDEX "idx_email_queue_created_at" ON "public"."email_queue" USING "btree" ("created_at");



CREATE INDEX "idx_email_queue_status" ON "public"."email_queue" USING "btree" ("status");



CREATE INDEX "idx_notification_queue_status" ON "public"."notification_queue" USING "btree" ("status");



CREATE INDEX "idx_notification_subscriptions_endpoint" ON "public"."notification_subscriptions" USING "btree" ("endpoint");



CREATE INDEX "idx_notification_subscriptions_user" ON "public"."notification_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_rate_limits_key" ON "public"."rate_limits" USING "btree" ("key");



CREATE INDEX "idx_rate_limits_last_request" ON "public"."rate_limits" USING "btree" ("last_request");



CREATE INDEX "idx_shops_active" ON "public"."shops" USING "btree" ("is_active");



CREATE INDEX "idx_shops_barbershop_id" ON "public"."shops" USING "btree" ("barbershop_id");



CREATE INDEX "idx_shops_city" ON "public"."shops" USING "btree" ("city");



CREATE INDEX "idx_shops_popular_service" ON "public"."shops" USING "btree" ("popular_service_id");



CREATE INDEX "idx_users_client_birth_date" ON "public"."users" USING "btree" ("barbershop_id", "birth_date") WHERE (("role" = 'client'::"text") AND ("birth_date" IS NOT NULL));



CREATE INDEX "idx_verification_tokens_email" ON "public"."verification_tokens" USING "btree" ("email");



CREATE INDEX "idx_verification_tokens_expires_at" ON "public"."verification_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_verification_tokens_hashed_token" ON "public"."verification_tokens" USING "btree" ("hashed_token");



CREATE INDEX "inventory_movements_product_idx" ON "public"."inventory_movements" USING "btree" ("product_id", "created_at" DESC);



CREATE INDEX "inventory_products_tenant_idx" ON "public"."inventory_products" USING "btree" ("barbershop_id", "location_id");



CREATE INDEX "location_members_user_idx" ON "public"."location_members" USING "btree" ("user_id");



CREATE INDEX "locations_parent_idx" ON "public"."locations" USING "btree" ("parent_barbershop_id");



CREATE INDEX "loyalty_accounts_client_idx" ON "public"."loyalty_accounts" USING "btree" ("barbershop_id", "client_id");



CREATE INDEX "loyalty_rewards_shop_idx" ON "public"."loyalty_rewards" USING "btree" ("barbershop_id", "active");



CREATE INDEX "loyalty_transactions_client_idx" ON "public"."loyalty_transactions" USING "btree" ("barbershop_id", "client_id", "created_at" DESC);



CREATE INDEX "pos_transaction_items_transaction_idx" ON "public"."pos_transaction_items" USING "btree" ("transaction_id");



CREATE INDEX "pos_transactions_tenant_idx" ON "public"."pos_transactions" USING "btree" ("barbershop_id", "created_at" DESC);



CREATE INDEX "staff_permissions_tenant_user_idx" ON "public"."staff_permissions" USING "btree" ("barbershop_id", "user_id");



CREATE INDEX "subscriptions_active_user_idx" ON "public"."subscriptions" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['active'::"public"."subscription_status", 'trialing'::"public"."subscription_status", 'past_due'::"public"."subscription_status"]));



CREATE INDEX "subscriptions_customer_idx" ON "public"."subscriptions" USING "btree" ("stripe_customer_id");



CREATE INDEX "subscriptions_plan_idx" ON "public"."subscriptions" USING "btree" ("plan");



CREATE INDEX "subscriptions_status_period_end_idx" ON "public"."subscriptions" USING "btree" ("status", "current_period_end") WHERE ("status" = ANY (ARRAY['active'::"public"."subscription_status", 'trialing'::"public"."subscription_status"]));



CREATE INDEX "subscriptions_stripe_customer_id_idx" ON "public"."subscriptions" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);



CREATE INDEX "subscriptions_stripe_subscription_id_idx" ON "public"."subscriptions" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);



CREATE UNIQUE INDEX "subscriptions_user_id_idx" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "users_id_idx" ON "public"."users" USING "btree" ("id");



CREATE OR REPLACE TRIGGER "set_barbershops_timestamp" BEFORE UPDATE ON "public"."barbershops" FOR EACH ROW EXECUTE FUNCTION "public"."handle_update_timestamp"();



CREATE OR REPLACE TRIGGER "set_barbershops_updated_at" BEFORE UPDATE ON "public"."barbershops" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_shops_updated_at" BEFORE UPDATE ON "public"."shops" FOR EACH ROW EXECUTE FUNCTION "public"."handle_update_timestamp"();



CREATE OR REPLACE TRIGGER "subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_enforce_professional_plan_rules" BEFORE INSERT OR UPDATE OF "commission_percentage" ON "public"."professionals" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_professional_plan_rules"();



CREATE OR REPLACE TRIGGER "trigger_notify_new_review" AFTER INSERT ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_review"();



CREATE OR REPLACE TRIGGER "trigger_sync_barbershop_address" AFTER UPDATE OF "address" ON "public"."barbershops" FOR EACH ROW EXECUTE FUNCTION "public"."sync_barbershop_address_to_shops"();



CREATE OR REPLACE TRIGGER "trigger_sync_barbershop_details" AFTER INSERT OR UPDATE ON "public"."barbershops" FOR EACH ROW EXECUTE FUNCTION "public"."sync_barbershop_details_to_shops"();



CREATE OR REPLACE TRIGGER "trigger_sync_barbershop_name" AFTER UPDATE OF "name" ON "public"."barbershops" FOR EACH ROW EXECUTE FUNCTION "public"."sync_barbershop_name_to_shops"();



CREATE OR REPLACE TRIGGER "trigger_sync_barbershop_phone" AFTER UPDATE OF "phone" ON "public"."barbershops" FOR EACH ROW EXECUTE FUNCTION "public"."sync_barbershop_phone_to_shops"();



ALTER TABLE ONLY "public"."advanced_report_configs"
    ADD CONSTRAINT "advanced_report_configs_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."advanced_report_configs"
    ADD CONSTRAINT "advanced_report_configs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_rules"
    ADD CONSTRAINT "automation_rules_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_rules"
    ADD CONSTRAINT "automation_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."automation_runs"
    ADD CONSTRAINT "automation_runs_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_runs"
    ADD CONSTRAINT "automation_runs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barbershop_invite_codes"
    ADD CONSTRAINT "barbershop_invite_codes_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barbershop_invite_codes"
    ADD CONSTRAINT "barbershop_invite_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barbershop_invite_codes"
    ADD CONSTRAINT "barbershop_invite_codes_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."barbershops"
    ADD CONSTRAINT "barbershops_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."birthday_email_automations"
    ADD CONSTRAINT "birthday_email_automations_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."birthday_email_logs"
    ADD CONSTRAINT "birthday_email_logs_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."birthday_email_logs"
    ADD CONSTRAINT "birthday_email_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."customer_segments"
    ADD CONSTRAINT "customer_segments_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_segments"
    ADD CONSTRAINT "customer_segments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."customer_tag_assignments"
    ADD CONSTRAINT "customer_tag_assignments_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_tag_assignments"
    ADD CONSTRAINT "customer_tag_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_tag_assignments"
    ADD CONSTRAINT "customer_tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."customer_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_tags"
    ADD CONSTRAINT "customer_tags_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "fk_appointments_user" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_products"
    ADD CONSTRAINT "inventory_products_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_products"
    ADD CONSTRAINT "inventory_products_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_members"
    ADD CONSTRAINT "location_members_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_members"
    ADD CONSTRAINT "location_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_parent_barbershop_id_fkey" FOREIGN KEY ("parent_barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_accounts"
    ADD CONSTRAINT "loyalty_accounts_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_accounts"
    ADD CONSTRAINT "loyalty_accounts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "public"."loyalty_rewards"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_settings"
    ADD CONSTRAINT "loyalty_settings_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_subscriptions"
    ADD CONSTRAINT "notification_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pos_transaction_items"
    ADD CONSTRAINT "pos_transaction_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pos_transaction_items"
    ADD CONSTRAINT "pos_transaction_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pos_transaction_items"
    ADD CONSTRAINT "pos_transaction_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."pos_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pos_transactions"
    ADD CONSTRAINT "pos_transactions_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pos_transactions"
    ADD CONSTRAINT "pos_transactions_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pos_transactions"
    ADD CONSTRAINT "pos_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pos_transactions"
    ADD CONSTRAINT "pos_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pos_transactions"
    ADD CONSTRAINT "pos_transactions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_blocks"
    ADD CONSTRAINT "schedule_blocks_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_blocks"
    ADD CONSTRAINT "schedule_blocks_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_popular_service_id_fkey" FOREIGN KEY ("popular_service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_permissions"
    ADD CONSTRAINT "staff_permissions_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_permissions"
    ADD CONSTRAINT "staff_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_barbershop_id_fkey1" FOREIGN KEY ("barbershop_id") REFERENCES "public"."barbershops"("id") ON DELETE CASCADE;



CREATE POLICY "Allow admins to update their own barbershop" ON "public"."barbershops" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."barbershop_id" = "barbershops"."id") AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Allow public read access" ON "public"."barbershops" FOR SELECT USING (true);



CREATE POLICY "Allow service/authenticated updates" ON "public"."barbershops" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can create their own barbershop" ON "public"."barbershops" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Barbearias públicas visíveis para todos" ON "public"."barbershops" FOR SELECT USING (true);



CREATE POLICY "Barbershop creators can insert marketplace shop" ON "public"."shops" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."barbershops" "b"
  WHERE (("b"."id" = "shops"."barbershop_id") AND ("b"."created_by" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."barbershop_id" = "shops"."barbershop_id") AND ("u"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "Barbershop owners and admins can update marketplace shop" ON "public"."shops" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."barbershop_id" = "shops"."barbershop_id") AND ("u"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."barbershop_id" = "shops"."barbershop_id") AND ("u"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Criar avaliações publicamente" ON "public"."reviews" FOR INSERT WITH CHECK (true);



CREATE POLICY "Leitura pública de avaliações" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "Leitura pública de barbearias" ON "public"."barbershops" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Leitura pública de serviços" ON "public"."services" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Owners and admins can update their own barbershop" ON "public"."barbershops" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."barbershop_id" = "barbershops"."id") AND ("u"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."barbershop_id" = "barbershops"."id") AND ("u"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Permitir delete de agendamentos da barbearia" ON "public"."appointments" FOR DELETE TO "authenticated" USING (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir delete de bloqueios da barbearia" ON "public"."schedule_blocks" FOR DELETE TO "authenticated" USING (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir delete de profissionais da barbearia" ON "public"."professionals" FOR DELETE TO "authenticated" USING (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir delete de serviços da barbearia" ON "public"."services" FOR DELETE TO "authenticated" USING (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir escrita de bloqueios da barbearia" ON "public"."schedule_blocks" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir escrita de profissionais da barbearia" ON "public"."professionals" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir escrita de serviços da barbearia" ON "public"."services" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir inserção pública de agendamentos" ON "public"."appointments" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Permitir leitura de bloqueios da barbearia" ON "public"."schedule_blocks" FOR SELECT TO "authenticated" USING (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir leitura de profissionais da barbearia" ON "public"."professionals" FOR SELECT TO "authenticated" USING (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir leitura de serviços da barbearia" ON "public"."services" FOR SELECT TO "authenticated" USING (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir leitura pública" ON "public"."barbershops" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Permitir leitura pública de agendamentos" ON "public"."appointments" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Permitir que barbeiros apaguem utilizadores da sua barbearia" ON "public"."users" FOR DELETE TO "authenticated" USING (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir que barbeiros atualizem utilizadores da sua barbearia" ON "public"."users" FOR UPDATE TO "authenticated" USING (((("auth"."uid"())::"text" = ("id")::"text") OR ("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"))) WITH CHECK (((("auth"."uid"())::"text" = ("id")::"text") OR ("public"."get_my_barbershop_id"() = ("barbershop_id")::"text")));



CREATE POLICY "Permitir que barbeiros criem clientes para a sua barbearia" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir que barbeiros leiam utilizadores da sua barbearia" ON "public"."users" FOR SELECT TO "authenticated" USING (((("auth"."uid"())::"text" = ("id")::"text") OR ("public"."get_my_barbershop_id"() = ("barbershop_id")::"text")));



CREATE POLICY "Permitir update de bloqueios da barbearia" ON "public"."schedule_blocks" FOR UPDATE TO "authenticated" USING (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text")) WITH CHECK (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir update de profissionais da barbearia" ON "public"."professionals" FOR UPDATE TO "authenticated" USING (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text")) WITH CHECK (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir update de serviços da barbearia" ON "public"."services" FOR UPDATE TO "authenticated" USING (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text")) WITH CHECK (("public"."get_my_barbershop_id"() = ("barbershop_id")::"text"));



CREATE POLICY "Permitir update para staff da barbearia" ON "public"."appointments" FOR UPDATE TO "authenticated" USING (("barbershop_id" IN ( SELECT "users"."barbershop_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (("barbershop_id" IN ( SELECT "users"."barbershop_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Public marketplace read access" ON "public"."shops" FOR SELECT USING (true);



CREATE POLICY "Serviços públicos visíveis para todos" ON "public"."services" FOR SELECT USING (true);



CREATE POLICY "Users can create their own profile" ON "public"."barbershops" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can read their billing customer" ON "public"."customers" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read their subscription" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."barbershops" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can view their own profile" ON "public"."barbershops" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."advanced_report_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "advanced_report_configs_staff_all" ON "public"."advanced_report_configs" TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid")) WITH CHECK ((("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid") AND ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automation_rules_staff_all" ON "public"."automation_rules" TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid")) WITH CHECK ((("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid") AND ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."automation_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automation_runs_staff_read" ON "public"."automation_runs" FOR SELECT TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."barbershop_invite_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."barbershops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."birthday_email_automations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."birthday_email_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "commissions_staff_all" ON "public"."commissions" TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid")) WITH CHECK (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."customer_segments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_segments_staff_all" ON "public"."customer_segments" TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid")) WITH CHECK ((("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid") AND ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."customer_tag_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_tag_assignments_staff_all" ON "public"."customer_tag_assignments" TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid")) WITH CHECK (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."customer_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_tags_staff_all" ON "public"."customer_tags" TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid")) WITH CHECK (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_movements_staff_read" ON "public"."inventory_movements" FOR SELECT TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."inventory_products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_products_staff_all" ON "public"."inventory_products" TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid")) WITH CHECK (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."location_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "location_members_staff_all" ON "public"."location_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."locations" "l"
  WHERE (("l"."id" = "location_members"."location_id") AND ("l"."parent_barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."locations" "l"
  WHERE (("l"."id" = "location_members"."location_id") AND ("l"."parent_barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid")))));



ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "locations_staff_all" ON "public"."locations" TO "authenticated" USING (("parent_barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid")) WITH CHECK (("parent_barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."loyalty_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_accounts_owner_read" ON "public"."loyalty_accounts" FOR SELECT TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."loyalty_redemptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_redemptions_owner_read" ON "public"."loyalty_redemptions" FOR SELECT TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."loyalty_rewards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_rewards_owner_read" ON "public"."loyalty_rewards" FOR SELECT TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."loyalty_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_settings_owner_read" ON "public"."loyalty_settings" FOR SELECT TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."loyalty_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_transactions_owner_read" ON "public"."loyalty_transactions" FOR SELECT TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."notification_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pos_transaction_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pos_transaction_items_staff_all" ON "public"."pos_transaction_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."pos_transactions" "t"
  WHERE (("t"."id" = "pos_transaction_items"."transaction_id") AND ("t"."barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pos_transactions" "t"
  WHERE (("t"."id" = "pos_transaction_items"."transaction_id") AND ("t"."barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid")))));



ALTER TABLE "public"."pos_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pos_transactions_staff_all" ON "public"."pos_transactions" TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid")) WITH CHECK (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."professionals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_permissions_staff_all" ON "public"."staff_permissions" TO "authenticated" USING (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid")) WITH CHECK (("barbershop_id" = ("public"."get_my_barbershop_id"())::"uuid"));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_select_own" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verification_tokens" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_receita_barbearia"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_receita_barbearia"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_receita_barbearia"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_email_exists"("email_to_check" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_email_exists"("email_to_check" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_email_exists"("email_to_check" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_if_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_if_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_if_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."complete_barbershop_onboarding"("p_barbershop_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_barbershop_onboarding"("p_barbershop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_barbershop_onboarding"("p_barbershop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_barbershop_onboarding"("p_barbershop_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_barbershop_invite_code"("p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_barbershop_invite_code"("p_role" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_barbershop_invite_code"("p_role" "text") TO "authenticated";



GRANT ALL ON TABLE "public"."pos_transactions" TO "anon";
GRANT ALL ON TABLE "public"."pos_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."pos_transactions" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_pos_transaction_atomic"("p_barbershop_id" "uuid", "p_location_id" "uuid", "p_client_id" "uuid", "p_appointment_id" "uuid", "p_payment_method" "text", "p_discount" numeric, "p_created_by" "uuid", "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_pos_transaction_atomic"("p_barbershop_id" "uuid", "p_location_id" "uuid", "p_client_id" "uuid", "p_appointment_id" "uuid", "p_payment_method" "text", "p_discount" numeric, "p_created_by" "uuid", "p_items" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."professionals" TO "anon";
GRANT ALL ON TABLE "public"."professionals" TO "authenticated";
GRANT ALL ON TABLE "public"."professionals" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_professional_with_plan_quota"("p_actor_user_id" "uuid", "p_barbershop_id" "uuid", "p_name" character varying, "p_commission_percentage" integer, "p_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_professional_with_plan_quota"("p_actor_user_id" "uuid", "p_barbershop_id" "uuid", "p_name" character varying, "p_commission_percentage" integer, "p_active" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_professional_plan_rules"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_professional_plan_rules"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_effective_billing_plan"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_effective_billing_plan"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_barbershop_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_barbershop_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_barbershop_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_subscription"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_subscription"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_subscription"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_update_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_update_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_update_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."join_barbershop_with_invite"("p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_barbershop_with_invite"("p_code" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."join_barbershop_with_invite"("p_code" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."notify_new_review"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_review"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_review"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_user_tenant_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_user_tenant_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_user_tenant_fields"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refund_pos_transaction_atomic"("p_transaction_id" "uuid", "p_barbershop_id" "uuid", "p_user_id" "uuid", "p_mode" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refund_pos_transaction_atomic"("p_transaction_id" "uuid", "p_barbershop_id" "uuid", "p_user_id" "uuid", "p_mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_barbershop_avatar_url"("p_barbershop_id" "uuid", "p_avatar_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_barbershop_avatar_url"("p_barbershop_id" "uuid", "p_avatar_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_barbershop_avatar_url"("p_barbershop_id" "uuid", "p_avatar_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_barbershop_avatar_url"("p_barbershop_id" "uuid", "p_avatar_url" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_barbershop_directory_visibility"("p_actor_user_id" "uuid", "p_barbershop_id" "uuid", "p_visible" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_barbershop_directory_visibility"("p_actor_user_id" "uuid", "p_barbershop_id" "uuid", "p_visible" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_barbershop_address_to_shops"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_barbershop_address_to_shops"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_barbershop_address_to_shops"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_barbershop_details_to_shops"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_barbershop_details_to_shops"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_barbershop_details_to_shops"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_barbershop_name_to_shops"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_barbershop_name_to_shops"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_barbershop_name_to_shops"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_barbershop_phone_to_shops"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_barbershop_phone_to_shops"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_barbershop_phone_to_shops"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_barbershop_to_shop"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_barbershop_to_shop"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_barbershop_to_shop"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."advanced_report_configs" TO "anon";
GRANT ALL ON TABLE "public"."advanced_report_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."advanced_report_configs" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."automation_rules" TO "anon";
GRANT ALL ON TABLE "public"."automation_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_rules" TO "service_role";



GRANT ALL ON TABLE "public"."automation_runs" TO "anon";
GRANT ALL ON TABLE "public"."automation_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_runs" TO "service_role";



GRANT ALL ON TABLE "public"."barbershop_invite_codes" TO "service_role";



GRANT ALL ON TABLE "public"."barbershops" TO "anon";
GRANT ALL ON TABLE "public"."barbershops" TO "authenticated";
GRANT ALL ON TABLE "public"."barbershops" TO "service_role";



GRANT ALL ON TABLE "public"."birthday_email_automations" TO "service_role";



GRANT ALL ON TABLE "public"."birthday_email_logs" TO "service_role";



GRANT ALL ON TABLE "public"."commissions" TO "anon";
GRANT ALL ON TABLE "public"."commissions" TO "authenticated";
GRANT ALL ON TABLE "public"."commissions" TO "service_role";



GRANT ALL ON TABLE "public"."customer_segments" TO "anon";
GRANT ALL ON TABLE "public"."customer_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_segments" TO "service_role";



GRANT ALL ON TABLE "public"."customer_tag_assignments" TO "anon";
GRANT ALL ON TABLE "public"."customer_tag_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_tag_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."customer_tags" TO "anon";
GRANT ALL ON TABLE "public"."customer_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_tags" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."email_queue" TO "anon";
GRANT ALL ON TABLE "public"."email_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."email_queue" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_movements" TO "anon";
GRANT ALL ON TABLE "public"."inventory_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_movements" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_products" TO "anon";
GRANT ALL ON TABLE "public"."inventory_products" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_products" TO "service_role";



GRANT ALL ON TABLE "public"."location_members" TO "anon";
GRANT ALL ON TABLE "public"."location_members" TO "authenticated";
GRANT ALL ON TABLE "public"."location_members" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_accounts" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."loyalty_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_redemptions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."loyalty_redemptions" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_redemptions" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_rewards" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."loyalty_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_settings" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."loyalty_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_settings" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_transactions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."loyalty_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."notification_queue" TO "anon";
GRANT ALL ON TABLE "public"."notification_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_queue" TO "service_role";



GRANT ALL ON TABLE "public"."notification_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."notification_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."pos_transaction_items" TO "anon";
GRANT ALL ON TABLE "public"."pos_transaction_items" TO "authenticated";
GRANT ALL ON TABLE "public"."pos_transaction_items" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_blocks" TO "anon";
GRANT ALL ON TABLE "public"."schedule_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."shops" TO "anon";
GRANT ALL ON TABLE "public"."shops" TO "authenticated";
GRANT ALL ON TABLE "public"."shops" TO "service_role";



GRANT ALL ON TABLE "public"."staff_permissions" TO "anon";
GRANT ALL ON TABLE "public"."staff_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."verification_tokens" TO "anon";
GRANT ALL ON TABLE "public"."verification_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."verification_tokens" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







