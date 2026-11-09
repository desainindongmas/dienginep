-- FPRS bootstrap schema. Registration remains closed until launch checks pass.
create extension if not exists pgcrypto;
create table if not exists public.admin_profiles(
 id uuid primary key references auth.users(id) on delete restrict,
 display_name text not null, role text not null check(role in('super_admin','local_operator')),
 is_active boolean not null default true, created_at timestamptz not null default now());
create table if not exists public.founding_quota(
 category text primary key check(category in('homestay','jeep','souvenirs','agrotourism','local_guide')),
 quota_count integer not null check(quota_count>=0),
 updated_by uuid references public.admin_profiles(id),
 updated_at timestamptz not null default now());
insert into public.founding_quota(category,quota_count) values
 ('homestay',14),('jeep',2),('souvenirs',2),('agrotourism',1),('local_guide',1)
 on conflict(category) do nothing;
create table if not exists public.partner_applications(
 id uuid primary key default gen_random_uuid(),
 public_code text not null unique,
 category text not null references public.founding_quota(category),
 owner_name text not null, business_name text not null,
 whatsapp_e164 text not null, village text not null,
 address_landmark text not null,
 status text not null default 'submitted' check(status in('submitted','under_review','field_verification','need_revision','waitlisted','approved','onboarding','rejected','withdrawn','active')),
 assigned_operator_id uuid references public.admin_profiles(id),
 referral_code text,terms_version text not null,privacy_version text not null,
 submitted_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 idempotency_key uuid not null unique,source text);
create table if not exists public.partner_business_details(
 application_id uuid primary key references public.partner_applications(id) on delete restrict,
 room_count integer check(room_count>0),guest_capacity integer check(guest_capacity>0),
 vehicle_count integer check(vehicle_count>0),passenger_capacity integer check(passenger_capacity>0),
 product_types text,experience_type text,visit_capacity integer check(visit_capacity>0),
 guiding_areas text,group_capacity integer check(group_capacity>0));
create table if not exists public.partner_status_history(
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.partner_applications(id),
 from_status text,to_status text not null,reason text not null,
 actor_id uuid references public.admin_profiles(id),
 actor_kind text not null check(actor_kind in('system','staff')),
 created_at timestamptz not null default now());
create table if not exists public.audit_logs(
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references public.admin_profiles(id),
 actor_kind text not null check(actor_kind in('system','staff')),
 action text not null,target_id text not null,
 metadata_redacted jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now());
create index if not exists fprs_status_category_idx on public.partner_applications(status,category,submitted_at desc);
create index if not exists fprs_phone_idx on public.partner_applications(whatsapp_e164);
do $$declare t text;begin
 foreach t in array array['admin_profiles','founding_quota','partner_applications','partner_business_details','partner_status_history','audit_logs']
 loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
end$$;
create or replace function public.submit_partner_application(p_payload jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare existing public.partner_applications%rowtype; newid uuid; newcode text; cat text;
begin
 select * into existing from public.partner_applications where idempotency_key=p_idempotency_key;
 if found then return jsonb_build_object('public_code',existing.public_code,'submitted_at',existing.submitted_at);end if;
 cat:=p_payload->>'business_category';
 if cat not in('homestay','jeep','souvenirs','agrotourism','local_guide') then raise exception 'INVALID_CATEGORY';end if;
 if coalesce(p_payload->>'owner_name','')='' or coalesce(p_payload->>'business_name','')='' then raise exception 'INVALID_IDENTITY';end if;
 if coalesce(p_payload->>'whatsapp_e164','') !~ '^\+628[0-9]{8,11}$' then raise exception 'INVALID_CONTACT';end if;
 newcode:='DI-FP-'||upper(encode(gen_random_bytes(6),'hex'));
 insert into public.partner_applications(public_code,category,owner_name,business_name,whatsapp_e164,village,address_landmark,idempotency_key,referral_code,terms_version,privacy_version)
 values(newcode,cat,p_payload->>'owner_name',p_payload->>'business_name',p_payload->>'whatsapp_e164',p_payload->>'village',p_payload->>'address_landmark',p_idempotency_key,p_payload->>'referral_code',p_payload->>'terms_version',p_payload->>'privacy_version')
 returning id into newid;
 insert into public.partner_business_details(application_id,room_count,guest_capacity,vehicle_count,passenger_capacity,product_types,experience_type,visit_capacity,guiding_areas,group_capacity)
 values(newid,(p_payload->>'room_count')::integer,(p_payload->>'guest_capacity')::integer,(p_payload->>'vehicle_count')::integer,(p_payload->>'passenger_capacity')::integer,p_payload->>'product_types',p_payload->>'experience_type',(p_payload->>'visit_capacity')::integer,p_payload->>'guiding_areas',(p_payload->>'group_capacity')::integer);
 insert into public.partner_status_history(application_id,to_status,reason,actor_kind) values(newid,'submitted','Pendaftaran diterima','system');
 insert into public.audit_logs(actor_kind,action,target_id) values('system','public_application_submitted',newid::text);
 return jsonb_build_object('public_code',newcode,'submitted_at',now());
exception when unique_violation then
 select * into existing from public.partner_applications where idempotency_key=p_idempotency_key;
 if found then return jsonb_build_object('public_code',existing.public_code,'submitted_at',existing.submitted_at);end if;
 raise;
end$$;
revoke all on function public.submit_partner_application(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.submit_partner_application(jsonb,uuid) to service_role;
