update public.companies
set
  name = 'Demo Company',
  vendor_limit = 5,
  status = 'active'
where id = '11111111-1111-1111-1111-111111111111';

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  seed_user.id,
  'authenticated',
  'authenticated',
  seed_user.email,
  crypt(seed_user.password, gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', seed_user.name),
  now(),
  now(),
  '',
  '',
  '',
  ''
from (
  values
    (
      '44444444-4444-4444-4444-444444444444'::uuid,
      'dilbert@gmail.com'::text,
      'Dilbert Owner'::text,
      'DilbertDemo!1'::text
    ),
    (
      '55555555-5555-5555-5555-555555555555'::uuid,
      'analyst@demo-company.com'::text,
      'Demo Analyst'::text,
      'DilbertDemo!2'::text
    ),
    (
      '66666666-6666-6666-6666-666666666666'::uuid,
      'vendor@demo-company.com'::text,
      'Demo Vendor'::text,
      'DilbertDemo!3'::text
    )
) as seed_user(id, email, name, password)
where not exists (
  select 1
  from auth.users existing_user
  where lower(existing_user.email) = lower(seed_user.email)
);

insert into public.users (
  id,
  company_id,
  email,
  name,
  avatar_url,
  role,
  department,
  phone,
  created_at
)
select
  seed_user.id,
  '11111111-1111-1111-1111-111111111111',
  seed_user.email,
  seed_user.name,
  seed_user.avatar_url,
  seed_user.role::public.user_role,
  seed_user.department,
  seed_user.phone,
  now()
from (
  values
    (
      '44444444-4444-4444-4444-444444444444'::uuid,
      'dilbert@gmail.com'::text,
      'Dilbert Owner'::text,
      null::text,
      'owner'::text,
      'Revenue'::text,
      '+54 11 5555 0101'::text
    ),
    (
      '55555555-5555-5555-5555-555555555555'::uuid,
      'analyst@demo-company.com'::text,
      'Demo Analyst'::text,
      null::text,
      'analyst'::text,
      'Analytics'::text,
      '+54 11 5555 0102'::text
    ),
    (
      '66666666-6666-6666-6666-666666666666'::uuid,
      'vendor@demo-company.com'::text,
      'Demo Vendor'::text,
      null::text,
      'vendor'::text,
      'Sales'::text,
      '+54 11 5555 0103'::text
    )
) as seed_user(id, email, name, avatar_url, role, department, phone)
where not exists (
  select 1
  from public.users existing_user
  where existing_user.id = seed_user.id
     or lower(existing_user.email) = lower(seed_user.email)
);

insert into public.authorized_emails (
  id,
  company_id,
  email,
  added_by,
  created_at
)
select
  seed_authorized_email.id,
  '11111111-1111-1111-1111-111111111111',
  seed_authorized_email.email,
  '44444444-4444-4444-4444-444444444444',
  now()
from (
  values
    ('77777777-7777-7777-7777-777777777777'::uuid, 'dilbert@gmail.com'::text),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'analyst@demo-company.com'::text),
    ('99999999-9999-9999-9999-999999999999'::uuid, 'vendor@demo-company.com'::text)
) as seed_authorized_email(id, email)
where not exists (
  select 1
  from public.authorized_emails existing_authorized_email
  where existing_authorized_email.company_id = '11111111-1111-1111-1111-111111111111'
    and lower(existing_authorized_email.email) = lower(seed_authorized_email.email)
);

insert into public.invite_links (
  id,
  company_id,
  token,
  expires_at,
  created_at
)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  '11111111-1111-1111-1111-111111111111',
  'dilbert-demo-invite-20260402',
  now() + interval '24 hours',
  now()
where not exists (
  select 1
  from public.invite_links existing_invite_link
  where existing_invite_link.token = 'dilbert-demo-invite-20260402'
);
