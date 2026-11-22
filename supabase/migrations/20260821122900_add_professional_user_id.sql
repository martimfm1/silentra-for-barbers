-- Team quota and professional sync migrations reference professionals.user_id.
-- The original column migration was dated later than its first use, which made
-- a clean database replay fail even though production already had the column.
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS user_id uuid
  REFERENCES public.users(id) ON DELETE SET NULL;
