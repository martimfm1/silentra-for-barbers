-- Snapshot customer billing details into the generated payment document so the PDF
-- remains historically accurate even if the subscription request is later edited.

alter table public.billing_documents
  add column if not exists customer_tax_id text,
  add column if not exists customer_phone text,
  add column if not exists customer_address_line1 text,
  add column if not exists customer_address_line2 text,
  add column if not exists customer_postal_code text,
  add column if not exists customer_city text,
  add column if not exists customer_country text,
  add column if not exists customer_website text,
  add column if not exists seller_name text not null default 'Silentra',
  add column if not exists seller_website text not null default 'https://silentra.me';

create index if not exists billing_documents_number_idx
  on public.billing_documents (document_number);
