-- Add second seller
insert into sellers (id, company_id, name, telegram_user_id) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Maria Lopez', '111111111');

-- Seed 7 leads with variety
insert into leads (id, company_id, seller_id, client_name, client_company, status, estimated_amount, currency, product_interest, sentiment, next_steps, last_interaction, created_at) values
  ('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   'Carlos Mendez', 'TechFlow SA', 'closed_won', 45000, 'USD', 'Platform Enterprise', 'positive',
   'Firmar contrato el lunes', now() - interval '2 days', now() - interval '15 days'),

  ('aaaa0002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'Ana Rodriguez', 'DataVision', 'negotiating', 12000, 'USD', 'API Integration', 'positive',
   'Enviar propuesta actualizada', now() - interval '1 day', now() - interval '10 days'),

  ('aaaa0003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   'Roberto Diaz', 'Finanzas Plus', 'negotiating', 28000, 'USD', 'Dashboard Analytics', 'neutral',
   'Agendar demo con equipo tecnico', now() - interval '3 days', now() - interval '20 days'),

  ('aaaa0004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'Laura Gomez', 'StartupXYZ', 'new', 5000, 'USD', 'Plan Starter', 'positive',
   'Primer contacto por Telegram', now() - interval '0 days', now() - interval '2 days'),

  ('aaaa0005-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   'Miguel Torres', 'Logistica Express', 'closed_lost', 8000, 'USD', 'API Integration', 'negative',
   'Cliente eligio competencia', now() - interval '7 days', now() - interval '25 days'),

  ('aaaa0006-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
   'Fernanda Ruiz', 'MediaGroup', 'contacted', 18000, 'ARS', 'Platform Enterprise', 'neutral',
   'Esperando respuesta del presupuesto', now() - interval '4 days', now() - interval '12 days'),

  ('aaaa0007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   'Pedro Sanchez', 'CloudNet', 'closed_won', 32000, 'USD', 'Dashboard Analytics', 'positive',
   'Onboarding en progreso', now() - interval '5 days', now() - interval '30 days');

-- Seed interactions for leads
insert into interactions (lead_id, seller_id, raw_messages, extracted_data, summary, created_at) values
  ('aaaa0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   '[{"from":"carlos","text":"Necesitamos la plataforma enterprise para 50 usuarios"}]',
   '{"status":"closed_won","sentiment":"positive","estimated_amount":45000}',
   'Cliente confirmo compra de Platform Enterprise para 50 usuarios. Monto: USD 45,000.',
   now() - interval '2 days'),

  ('aaaa0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   '[{"from":"carlos","text":"Me interesa el plan enterprise, cuanto sale?"}]',
   '{"status":"negotiating","sentiment":"positive","estimated_amount":45000}',
   'Primer contacto interesado en plan enterprise. Pidio cotizacion.',
   now() - interval '10 days'),

  ('aaaa0002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333',
   '[{"from":"ana","text":"Queremos integrar su API con nuestro sistema de BI"}]',
   '{"status":"negotiating","sentiment":"positive","estimated_amount":12000}',
   'Cliente necesita integracion API con su plataforma de BI. En negociacion.',
   now() - interval '1 day'),

  ('aaaa0003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
   '[{"from":"roberto","text":"El dashboard se ve bien pero necesito verlo con datos reales"}]',
   '{"status":"negotiating","sentiment":"neutral","estimated_amount":28000}',
   'Cliente quiere demo con datos reales antes de decidir. Agendar con equipo tecnico.',
   now() - interval '3 days'),

  ('aaaa0005-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222',
   '[{"from":"miguel","text":"Gracias pero vamos a ir con otra solucion"}]',
   '{"status":"closed_lost","sentiment":"negative","estimated_amount":8000}',
   'Cliente decidio ir con la competencia. Lead perdido.',
   now() - interval '7 days'),

  ('aaaa0007-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222',
   '[{"from":"pedro","text":"Perfecto, arrancamos con el onboarding"}]',
   '{"status":"closed_won","sentiment":"positive","estimated_amount":32000}',
   'Cliente confirmo y empezo onboarding del Dashboard Analytics.',
   now() - interval '5 days');
