create table if not exists public.application_email_outbox (
 application_id uuid primary key references public.partner_applications(id) on delete restrict,
 recipient text not null default 'admin3@desainindongmas.my.id',
 delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
 attempts integer not null default 0 check (attempts >= 0),
 last_error text,
 provider_message_id text,
 sent_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.application_email_outbox enable row level security;
revoke all on public.application_email_outbox from anon, authenticated;
create or replace function public.queue_fprs_application_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
 insert into public.application_email_outbox(application_id)
 values (new.id) on conflict (application_id) do nothing;
 return new;
end;$$;
revoke all on function public.queue_fprs_application_email() from public, anon, authenticated;
drop trigger if exists fprs_queue_registration_email on public.partner_applications;
create trigger fprs_queue_registration_email after insert on public.partner_applications
for each row execute function public.queue_fprs_application_email();