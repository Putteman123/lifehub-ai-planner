-- Demoföretag "Alfa Demo" med komplett innehåll för visning.
DO $$
DECLARE
  v_org uuid := 'a1f00000-0000-4000-8000-000000000001';
  v_owner uuid := 'b5495a92-e9a3-44ad-88c0-eb98e2c12022';
  v_admin uuid := 'a1f00000-0000-4000-8000-000000000101';
  s1 uuid := 'a1f00000-0000-4000-8000-000000000102';
  s2 uuid := 'a1f00000-0000-4000-8000-000000000103';
  s3 uuid := 'a1f00000-0000-4000-8000-000000000104';
  s4 uuid := 'a1f00000-0000-4000-8000-000000000105';
  c1 uuid := 'a1f00000-0000-4000-8000-000000000201';
  c2 uuid := 'a1f00000-0000-4000-8000-000000000202';
  c3 uuid := 'a1f00000-0000-4000-8000-000000000203';
  c4 uuid := 'a1f00000-0000-4000-8000-000000000204';
  c5 uuid := 'a1f00000-0000-4000-8000-000000000205';
  t_dusch uuid := 'a1f00000-0000-4000-8000-000000000301';
  t_stad uuid := 'a1f00000-0000-4000-8000-000000000302';
  t_tillsyn uuid := 'a1f00000-0000-4000-8000-000000000303';
  t_medicin uuid := 'a1f00000-0000-4000-8000-000000000304';
  t_prom uuid := 'a1f00000-0000-4000-8000-000000000305';
  m record;
  v record;
  d int;
BEGIN
  -- Rensa tidigare demodata så migrationen kan köras om.
  DELETE FROM public.care_messages WHERE org_id = v_org;
  DELETE FROM public.care_medication_events WHERE org_id = v_org;
  DELETE FROM public.care_visit_tasks WHERE org_id = v_org;
  DELETE FROM public.care_visits WHERE org_id = v_org;
  DELETE FROM public.care_medications WHERE org_id = v_org;
  DELETE FROM public.care_relatives WHERE org_id = v_org;
  DELETE FROM public.care_clients WHERE org_id = v_org;
  DELETE FROM public.care_task_templates WHERE org_id = v_org;
  DELETE FROM public.org_members WHERE org_id = v_org;
  DELETE FROM public.org_modules WHERE org_id = v_org;
  DELETE FROM public.org_permissions WHERE org_id = v_org;
  DELETE FROM public.organizations WHERE id = v_org;

  INSERT INTO public.organizations
    (id, name, slug, org_number, contact_name, contact_role, contact_email, contact_phone,
     address, website, segment, contract_type, status, seats, is_active, created_by, internal_notes)
  VALUES
    (v_org, 'Alfa Demo Hemtjänst', 'alfa-demo', '559123-4567', 'Lena Bergqvist', 'Verksamhetschef',
     'lena@alfademo.se', '070-123 45 67', 'Storgatan 12, 852 30 Sundsvall', 'https://alfademo.se',
     'Hemtjänst', 'demo', 'aktiv', 25, true, v_owner,
     'Demoföretag för visning av LifeHub Vård Alfa 1.0.');

  INSERT INTO public.org_modules (org_id, module, enabled)
  SELECT v_org, m2, true FROM unnest(ARRAY['schema','uppgifter','medicin','karta','handla',
    'ekonomi','andrea','personuppgifter','avvikelser','rapporter']) AS m2;

  -- Behörighetsmatris: vårdföretag och personal arbetar i verksamheten,
  -- brukare och anhöriga ser sitt egna med samtycke.
  INSERT INTO public.org_permissions (org_id, role, module, can_view, can_edit)
  VALUES
    (v_org,'org_admin','schema',true,true),(v_org,'org_admin','uppgifter',true,true),
    (v_org,'org_admin','medicin',true,true),(v_org,'org_admin','karta',true,true),
    (v_org,'org_admin','personuppgifter',true,true),(v_org,'org_admin','avvikelser',true,true),
    (v_org,'org_admin','rapporter',true,true),(v_org,'org_admin','andrea',true,true),
    (v_org,'org_admin','handla',true,true),(v_org,'org_admin','ekonomi',false,false),
    (v_org,'caregiver','schema',true,false),(v_org,'caregiver','uppgifter',true,true),
    (v_org,'caregiver','medicin',true,true),(v_org,'caregiver','karta',true,false),
    (v_org,'caregiver','personuppgifter',true,false),(v_org,'caregiver','avvikelser',true,true),
    (v_org,'caregiver','rapporter',false,false),(v_org,'caregiver','andrea',true,false),
    (v_org,'caregiver','handla',true,true),(v_org,'caregiver','ekonomi',false,false),
    (v_org,'client','schema',true,false),(v_org,'client','uppgifter',true,false),
    (v_org,'client','medicin',true,false),(v_org,'client','personuppgifter',true,false),
    (v_org,'client','handla',true,true),(v_org,'client','ekonomi',true,true),
    (v_org,'client','andrea',true,false),(v_org,'client','avvikelser',false,false),
    (v_org,'client','karta',false,false),(v_org,'client','rapporter',false,false),
    (v_org,'relative','schema',true,false),(v_org,'relative','uppgifter',true,false),
    (v_org,'relative','medicin',true,false),(v_org,'relative','personuppgifter',true,false),
    (v_org,'relative','handla',false,false),(v_org,'relative','ekonomi',false,false),
    (v_org,'relative','andrea',false,false),(v_org,'relative','avvikelser',false,false),
    (v_org,'relative','karta',false,false),(v_org,'relative','rapporter',false,false);

  INSERT INTO public.org_members
    (id, org_id, display_name, email, phone, role, employment, work_hours, notes, is_active)
  VALUES
    (v_admin, v_org, 'Lena Bergqvist', 'lena@alfademo.se', '070-123 45 67', 'org_admin',
     'Tillsvidare 100 %', 'Vardagar 08–17', 'Verksamhetschef och schemaansvarig.', true),
    (s1, v_org, 'Anna Lind', 'anna@alfademo.se', '070-222 11 33', 'caregiver',
     'Tillsvidare 100 %', 'Vardagar 07–16', 'Delegering för medicin.', true),
    (s2, v_org, 'Johan Ek', 'johan@alfademo.se', '070-333 44 55', 'caregiver',
     'Tillsvidare 75 %', 'Vardagar 07–14', 'Kör bil, tar de längre rutterna.', true),
    (s3, v_org, 'Sara Nilsson', 'sara@alfademo.se', '070-444 55 66', 'caregiver',
     'Timanställd', 'Kvällar och helger', 'Kvällspass och helgtillsyn.', true),
    (s4, v_org, 'Mikael Ohlsson', 'mikael@alfademo.se', '070-555 66 77', 'caregiver',
     'Vikariat', 'Vardagar 12–20', 'Vikarie under hösten.', true);

  INSERT INTO public.care_clients
    (id, org_id, name, personal_number, address, lat, lng, phone, door_code, key_info, notes, is_active)
  VALUES
    (c1, v_org, 'Ingrid Persson', '19380412-1234', 'Nygatan 4, 852 37 Sundsvall', 62.3908, 17.3069,
     '060-11 22 33', '1234', 'Nyckel i nyckelskåp vid porten', 'Nedsatt syn, behöver hjälp med medicin.', true),
    (c2, v_org, 'Karl Svensson', '19421130-5678', 'Björkvägen 18, 852 40 Sundsvall', 62.3855, 17.2965,
     '060-22 33 44', '4321', 'Personal har egen nyckel', 'Waranbehandling, viktigt med tider.', true),
    (c3, v_org, 'Astrid Holm', '19351002-9012', 'Skolgatan 9, 852 32 Sundsvall', 62.3931, 17.3121,
     '060-33 44 55', '9090', 'Dörren öppnas inifrån', 'Vill gärna prata en stund vid varje besök.', true),
    (c4, v_org, 'Bertil Nyman', '19400820-3456', 'Hamngatan 21, 852 31 Sundsvall', 62.3889, 17.3172,
     '060-44 55 66', '2468', 'Nyckelgömma under mattan i trapphuset', 'Rullator, behöver hjälp vid dusch.', true),
    (c5, v_org, 'Gunhild Ek', '19370318-7890', 'Parkvägen 3, 852 35 Sundsvall', 62.3962, 17.2998,
     '060-55 66 77', '1357', 'Nyckelskåp kod 5566', 'Diabetes, behöver hjälp med måltider.', true);

  INSERT INTO public.care_relatives (org_id, client_id, name, relation, email, phone, notes, consent)
  VALUES
    (v_org, c1, 'Maria Persson', 'Dotter', 'maria.persson@example.com', '070-900 11 22',
     'Kontaktas i första hand.', '{"schema":true,"insatser":true,"medicin":true,"anteckningar":false}'::jsonb),
    (v_org, c1, 'Olle Persson', 'Son', 'olle.persson@example.com', '070-900 33 44', null,
     '{"schema":true,"insatser":false,"medicin":false,"anteckningar":false}'::jsonb),
    (v_org, c2, 'Per Svensson', 'Son', 'per.svensson@example.com', '070-900 55 66',
     'Bor i Stockholm, vill ha uppdatering veckovis.', '{"schema":true,"insatser":true,"medicin":true,"anteckningar":true}'::jsonb),
    (v_org, c3, 'Eva Holm', 'Dotter', 'eva.holm@example.com', '070-900 77 88', null,
     '{"schema":true,"insatser":true,"medicin":false,"anteckningar":false}'::jsonb),
    (v_org, c4, 'Anders Nyman', 'Son', 'anders.nyman@example.com', '070-900 99 00', null,
     '{"schema":true,"insatser":false,"medicin":false,"anteckningar":false}'::jsonb),
    (v_org, c5, 'Lisa Ek', 'Barnbarn', 'lisa.ek@example.com', '070-901 22 33',
     'Hjälper till med inköp.', '{"schema":true,"insatser":true,"medicin":true,"anteckningar":false}'::jsonb);

  INSERT INTO public.care_task_templates (id, org_id, title, description, default_minutes, is_active)
  VALUES
    (t_dusch, v_org, 'Dusch', 'Hjälp med dusch och påklädning.', 45, true),
    (t_stad, v_org, 'Städ', 'Veckostädning av kök och badrum.', 60, true),
    (t_tillsyn, v_org, 'Tillsyn', 'Kort tillsyn och avstämning.', 20, true),
    (t_medicin, v_org, 'Medicin', 'Överlämning av dosett enligt lista.', 15, true),
    (t_prom, v_org, 'Promenad', 'Kort promenad utomhus.', 30, true);

  INSERT INTO public.care_medications
    (org_id, client_id, name, dose, times, instructions, requires_delegation, is_active)
  VALUES
    (v_org, c1, 'Alvedon', '500 mg', '08:00, 20:00', 'Vid smärta, max 4 per dygn.', false, true),
    (v_org, c1, 'Ögondroppar', '1 droppe', '08:00', 'Höger öga.', true, true),
    (v_org, c2, 'Waran', 'Enligt dosschema', '17:00', 'Kontrolleras mot senaste provsvar.', true, true),
    (v_org, c2, 'Simvastatin', '20 mg', '20:00', null, false, true),
    (v_org, c3, 'Levaxin', '50 mikrogram', '07:00', 'Tas före frukost.', false, true),
    (v_org, c4, 'Furix', '40 mg', '08:00', 'Vätskedrivande, endast förmiddag.', true, true),
    (v_org, c5, 'Metformin', '500 mg', '08:00, 18:00', 'Tas i samband med måltid.', true, true);

  -- Given-logg 10 dagar bakåt för varje medicin.
  FOR m IN SELECT id, client_id FROM public.care_medications WHERE org_id = v_org LOOP
    FOR d IN 1..10 LOOP
      INSERT INTO public.care_medication_events (org_id, medication_id, given_at, note)
      VALUES (v_org, m.id, (now() - (d || ' days')::interval)::date + time '08:15',
              CASE WHEN d = 3 THEN 'Brukaren tveksam, tog den efter en stund.' ELSE null END);
    END LOOP;
  END LOOP;

  -- Besök: 14 dagar bakåt (utförda) och 7 dagar framåt (planerade).
  FOR d IN -14..7 LOOP
    INSERT INTO public.care_visits
      (org_id, client_id, staff_id, title, starts_at, ends_at, status, note,
       checkin_at, checkout_at, travel_meters, travel_seconds, deviation)
    SELECT
      v_org, x.client_id, x.staff_id, x.title,
      (now() + (d || ' days')::interval)::date + x.at,
      (now() + (d || ' days')::interval)::date + x.at + (x.mins || ' minutes')::interval,
      CASE WHEN d < 0 THEN 'utfort' ELSE 'planerad' END,
      null,
      CASE WHEN d < 0 THEN (now() + (d || ' days')::interval)::date + x.at + interval '2 minutes' END,
      CASE WHEN d < 0 THEN (now() + (d || ' days')::interval)::date + x.at + (x.mins || ' minutes')::interval END,
      CASE WHEN d < 0 THEN 1200 + (x.mins * 10) END,
      CASE WHEN d < 0 THEN 300 + (x.mins * 2) END,
      CASE WHEN d = -4 AND x.client_id = c2 THEN 'Brukaren sov, besöket kortades ned.' END
    FROM (VALUES
      (c1, s1, 'Morgonhjälp', time '08:00', 45),
      (c2, s1, 'Medicin och frukost', time '09:00', 30),
      (c3, s2, 'Tillsyn', time '10:00', 20),
      (c4, s2, 'Dusch', time '11:00', 45),
      (c5, s3, 'Lunchstöd', time '12:30', 40),
      (c1, s3, 'Kvällsbesök', time '19:00', 30),
      (c4, s4, 'Eftermiddagstillsyn', time '15:00', 20)
    ) AS x(client_id, staff_id, title, at, mins);
  END LOOP;

  -- Uppgifter kopplade till besöken.
  FOR v IN SELECT id, title FROM public.care_visits WHERE org_id = v_org LOOP
    INSERT INTO public.care_visit_tasks (org_id, visit_id, template_id, title, is_done, done_at, sort_order)
    VALUES
      (v_org, v.id, t_tillsyn, 'Tillsyn', false, null, 0),
      (v_org, v.id, t_medicin, 'Medicin', false, null, 1);
  END LOOP;

  UPDATE public.care_visit_tasks t
  SET is_done = true, done_at = vv.ends_at
  FROM public.care_visits vv
  WHERE t.visit_id = vv.id AND vv.org_id = v_org AND vv.status = 'utfort';

  -- Exempelmeddelanden i brukarnas tråd.
  INSERT INTO public.care_messages (org_id, client_id, author_id, author_name, author_role, body, created_at)
  VALUES
    (v_org, c1, v_owner, 'Anna Lind', 'caregiver', 'Hej! Ingrid har ätit bra idag och tagit sin medicin.', now() - interval '2 days'),
    (v_org, c1, v_owner, 'Maria Persson', 'relative', 'Tack för uppdateringen, skönt att höra!', now() - interval '2 days' + interval '30 minutes'),
    (v_org, c2, v_owner, 'Lena Bergqvist', 'org_admin', 'Vi har lagt in ett extra kvällsbesök på torsdag.', now() - interval '1 day'),
    (v_org, c4, v_owner, 'Johan Ek', 'caregiver', 'Bertil önskar duschen tidigare på dagen framöver.', now() - interval '5 hours');
END $$;