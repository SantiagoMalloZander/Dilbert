set search_path = public, extensions;

do $$
declare
  demo_company_id uuid := '00000000-0000-0000-0000-000000000001';
  owner_user_id uuid := '00000000-0000-0000-0000-000000000010';
  analyst_user_id uuid := '00000000-0000-0000-0000-000000000011';
  vendor_user_id uuid := '00000000-0000-0000-0000-000000000012';
  demo_pipeline_id uuid;
  stage_new_id uuid;
  stage_contacted_id uuid;
  stage_proposal_id uuid;
  stage_negotiation_id uuid;
  stage_won_id uuid;
  auth_instance_id uuid;
begin
  select coalesce((select id from auth.instances limit 1), '00000000-0000-0000-0000-000000000000'::uuid)
  into auth_instance_id;

  insert into public.companies (
    id,
    name,
    slug,
    vendor_limit,
    status,
    plan,
    settings
  )
  values (
    demo_company_id,
    'Empresa Demo',
    'empresa-demo',
    3,
    'active',
    'starter',
    '{"timezone":"America/Argentina/Buenos_Aires"}'::jsonb
  );

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
  values
    (
      auth_instance_id,
      owner_user_id,
      'authenticated',
      'authenticated',
      'owner@demo.com',
      extensions.crypt('Demo1234!', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Demo Owner"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      auth_instance_id,
      analyst_user_id,
      'authenticated',
      'authenticated',
      'analyst@demo.com',
      extensions.crypt('Demo1234!', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Demo Analyst"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      auth_instance_id,
      vendor_user_id,
      'authenticated',
      'authenticated',
      'vendor@demo.com',
      extensions.crypt('Demo1234!', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Demo Vendor"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values
    (
      gen_random_uuid(),
      owner_user_id,
      jsonb_build_object('sub', owner_user_id::text, 'email', 'owner@demo.com'),
      'email',
      'owner@demo.com',
      now(),
      now(),
      now()
    ),
    (
      gen_random_uuid(),
      analyst_user_id,
      jsonb_build_object('sub', analyst_user_id::text, 'email', 'analyst@demo.com'),
      'email',
      'analyst@demo.com',
      now(),
      now(),
      now()
    ),
    (
      gen_random_uuid(),
      vendor_user_id,
      jsonb_build_object('sub', vendor_user_id::text, 'email', 'vendor@demo.com'),
      'email',
      'vendor@demo.com',
      now(),
      now(),
      now()
    );

  insert into public.users (
    id,
    company_id,
    email,
    name,
    role,
    department,
    phone,
    is_active
  )
  values
    (
      owner_user_id,
      demo_company_id,
      'owner@demo.com',
      'Demo Owner',
      'owner',
      'Revenue',
      '+54 11 5555 0101',
      true
    ),
    (
      analyst_user_id,
      demo_company_id,
      'analyst@demo.com',
      'Demo Analyst',
      'analyst',
      'Operations',
      '+54 11 5555 0102',
      true
    ),
    (
      vendor_user_id,
      demo_company_id,
      'vendor@demo.com',
      'Demo Vendor',
      'vendor',
      'Sales',
      '+54 11 5555 0103',
      true
    );

  insert into public.authorized_emails (company_id, email, role, added_by)
  values
    (demo_company_id, 'analyst@demo.com', 'analyst', owner_user_id),
    (demo_company_id, 'vendor@demo.com', 'vendor', owner_user_id);

  insert into public.invite_links (company_id, token, expires_at)
  values (
    demo_company_id,
    'empresa-demo-invite-token',
    now() + interval '24 hours'
  );

  select id
  into demo_pipeline_id
  from public.pipelines
  where company_id = demo_company_id
    and is_default = true
  limit 1;

  select id into stage_new_id
  from public.pipeline_stages
  where company_id = demo_company_id
    and pipeline_id = demo_pipeline_id
    and name = 'Nuevo Lead';

  select id into stage_contacted_id
  from public.pipeline_stages
  where company_id = demo_company_id
    and pipeline_id = demo_pipeline_id
    and name = 'Contactado';

  select id into stage_proposal_id
  from public.pipeline_stages
  where company_id = demo_company_id
    and pipeline_id = demo_pipeline_id
    and name = 'Propuesta Enviada';

  select id into stage_negotiation_id
  from public.pipeline_stages
  where company_id = demo_company_id
    and pipeline_id = demo_pipeline_id
    and name = 'Negociación';

  select id into stage_won_id
  from public.pipeline_stages
  where company_id = demo_company_id
    and pipeline_id = demo_pipeline_id
    and name = 'Cerrado Ganado';

  insert into public.contacts (
    id,
    company_id,
    assigned_to,
    first_name,
    last_name,
    email,
    phone,
    company_name,
    position,
    source,
    tags,
    custom_fields,
    created_by
  )
  values
    ('10000000-0000-0000-0000-000000000001', demo_company_id, vendor_user_id, 'Carlos', 'Mendez', 'carlos@techflow.com', '+54 11 4000 0001', 'TechFlow', 'CEO', 'manual', array['demo', 'hot'], '{"industry":"saas"}', owner_user_id),
    ('10000000-0000-0000-0000-000000000002', demo_company_id, vendor_user_id, 'Ana', 'Rodriguez', 'ana@datavision.com', '+54 11 4000 0002', 'DataVision', 'COO', 'gmail', array['demo'], '{"industry":"analytics"}', owner_user_id),
    ('10000000-0000-0000-0000-000000000003', demo_company_id, vendor_user_id, 'Roberto', 'Diaz', 'roberto@finanzasplus.com', '+54 11 4000 0003', 'Finanzas Plus', 'CFO', 'whatsapp', array['finance'], '{"industry":"fintech"}', vendor_user_id),
    ('10000000-0000-0000-0000-000000000004', demo_company_id, vendor_user_id, 'Laura', 'Gomez', 'laura@startupxyz.io', '+54 11 4000 0004', 'StartupXYZ', 'Founder', 'instagram', array['startup'], '{"industry":"startup"}', vendor_user_id),
    ('10000000-0000-0000-0000-000000000005', demo_company_id, vendor_user_id, 'Miguel', 'Torres', 'miguel@logisticaexpress.com', '+54 11 4000 0005', 'Logistica Express', 'Head of Sales', 'manual', array['logistics'], '{"industry":"logistics"}', owner_user_id),
    ('10000000-0000-0000-0000-000000000006', demo_company_id, vendor_user_id, 'Fernanda', 'Ruiz', 'fernanda@mediagroup.com', '+54 11 4000 0006', 'MediaGroup', 'CMO', 'meet', array['media'], '{"industry":"media"}', owner_user_id),
    ('10000000-0000-0000-0000-000000000007', demo_company_id, vendor_user_id, 'Pedro', 'Sanchez', 'pedro@cloudnet.com', '+54 11 4000 0007', 'CloudNet', 'CTO', 'zoom', array['cloud'], '{"industry":"infra"}', vendor_user_id),
    ('10000000-0000-0000-0000-000000000008', demo_company_id, vendor_user_id, 'Lucia', 'Fernandez', 'lucia@retailhub.com', '+54 11 4000 0008', 'RetailHub', 'Director', 'import', array['retail'], '{"industry":"retail"}', owner_user_id),
    ('10000000-0000-0000-0000-000000000009', demo_company_id, vendor_user_id, 'Javier', 'Lopez', 'javier@healthsync.com', '+54 11 4000 0009', 'HealthSync', 'Operations Lead', 'gmail', array['health'], '{"industry":"health"}', vendor_user_id),
    ('10000000-0000-0000-0000-000000000010', demo_company_id, vendor_user_id, 'Sofia', 'Castro', 'sofia@energialatam.com', '+54 11 4000 0010', 'Energia Latam', 'Commercial Manager', 'whatsapp', array['energy'], '{"industry":"energy"}', owner_user_id);

  insert into public.leads (
    id,
    company_id,
    contact_id,
    assigned_to,
    pipeline_id,
    stage_id,
    title,
    value,
    currency,
    probability,
    expected_close_date,
    status,
    lost_reason,
    source,
    metadata,
    created_by
  )
  values
    ('20000000-0000-0000-0000-000000000001', demo_company_id, '10000000-0000-0000-0000-000000000001', vendor_user_id, demo_pipeline_id, stage_new_id, 'Expansión CRM TechFlow', 8500, 'USD', 15, current_date + 30, 'open', null, 'manual', '{"priority":"high"}', owner_user_id),
    ('20000000-0000-0000-0000-000000000002', demo_company_id, '10000000-0000-0000-0000-000000000002', vendor_user_id, demo_pipeline_id, stage_new_id, 'Automatización comercial DataVision', 6200, 'USD', 20, current_date + 28, 'open', null, 'gmail', '{"priority":"medium"}', owner_user_id),
    ('20000000-0000-0000-0000-000000000003', demo_company_id, '10000000-0000-0000-0000-000000000003', vendor_user_id, demo_pipeline_id, stage_contacted_id, 'Seguimiento financiero Finanzas Plus', 12000, 'USD', 35, current_date + 24, 'open', null, 'whatsapp', '{"channel":"whatsapp"}', vendor_user_id),
    ('20000000-0000-0000-0000-000000000004', demo_company_id, '10000000-0000-0000-0000-000000000004', vendor_user_id, demo_pipeline_id, stage_contacted_id, 'Piloto StartupXYZ', 4500, 'USD', 30, current_date + 18, 'open', null, 'instagram', '{"needs_demo":true}', vendor_user_id),
    ('20000000-0000-0000-0000-000000000005', demo_company_id, '10000000-0000-0000-0000-000000000005', vendor_user_id, demo_pipeline_id, stage_proposal_id, 'Propuesta Logistica Express', 14000, 'USD', 55, current_date + 20, 'open', null, 'manual', '{"proposal_version":2}', owner_user_id),
    ('20000000-0000-0000-0000-000000000006', demo_company_id, '10000000-0000-0000-0000-000000000006', vendor_user_id, demo_pipeline_id, stage_proposal_id, 'MediaGroup omnicanal', 9800, 'USD', 50, current_date + 16, 'open', null, 'meet', '{"multi_team":true}', owner_user_id),
    ('20000000-0000-0000-0000-000000000007', demo_company_id, '10000000-0000-0000-0000-000000000007', vendor_user_id, demo_pipeline_id, stage_negotiation_id, 'CloudNet enterprise', 22000, 'USD', 75, current_date + 12, 'open', null, 'zoom', '{"procurement":"in_progress"}', vendor_user_id),
    ('20000000-0000-0000-0000-000000000008', demo_company_id, '10000000-0000-0000-0000-000000000008', vendor_user_id, demo_pipeline_id, stage_negotiation_id, 'RetailHub expansión regional', 18500, 'USD', 80, current_date + 10, 'open', null, 'import', '{"regions":3}', owner_user_id),
    ('20000000-0000-0000-0000-000000000009', demo_company_id, '10000000-0000-0000-0000-000000000009', vendor_user_id, demo_pipeline_id, stage_won_id, 'HealthSync onboarding', 26000, 'USD', 100, current_date + 5, 'won', null, 'gmail', '{"contract_signed":true}', vendor_user_id),
    ('20000000-0000-0000-0000-000000000010', demo_company_id, '10000000-0000-0000-0000-000000000010', vendor_user_id, demo_pipeline_id, stage_won_id, 'Energia Latam rollout', 31000, 'USD', 100, current_date + 3, 'won', null, 'whatsapp', '{"contract_signed":true}', owner_user_id);
end
$$;
