ALTER TABLE public.care_relatives
  ADD COLUMN IF NOT EXISTS consent jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE
  v_org uuid;
  v_anna uuid; v_johan uuid; v_sara uuid;
  v_henry uuid; v_ingrid uuid; v_karl uuid;
  v_dusch uuid; v_stad uuid; v_tillsyn uuid;
  v_visit uuid;
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE slug = 'care-4-you';
  IF v_org IS NULL THEN RETURN; END IF;

  -- Personal
  INSERT INTO public.org_members (org_id, display_name, email, phone, role, employment, work_hours, notes)
  SELECT v_org, 'Anna Lind', 'anna@care4you.se', '070-111 22 33', 'caregiver', 'Tillsvidare', 'Vardagar 07-16', 'Delegering medicin'
  WHERE NOT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = v_org AND display_name = 'Anna Lind');
  INSERT INTO public.org_members (org_id, display_name, email, phone, role, employment, work_hours)
  SELECT v_org, 'Johan Ek', 'johan@care4you.se', '070-222 33 44', 'caregiver', 'Timanställd', 'Kvällar 15-22'
  WHERE NOT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = v_org AND display_name = 'Johan Ek');
  INSERT INTO public.org_members (org_id, display_name, email, phone, role, employment, work_hours)
  SELECT v_org, 'Sara Nilsson', 'sara@care4you.se', '070-333 44 55', 'caregiver', 'Tillsvidare', 'Helger 08-17'
  WHERE NOT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = v_org AND display_name = 'Sara Nilsson');

  SELECT id INTO v_anna FROM public.org_members WHERE org_id = v_org AND display_name = 'Anna Lind';
  SELECT id INTO v_johan FROM public.org_members WHERE org_id = v_org AND display_name = 'Johan Ek';
  SELECT id INTO v_sara FROM public.org_members WHERE org_id = v_org AND display_name = 'Sara Nilsson';

  -- Brukare
  UPDATE public.care_clients
     SET address = COALESCE(address, 'Storgatan 12, Västerås'),
         phone = COALESCE(phone, '021-12 34 56'),
         door_code = COALESCE(door_code, '1234'),
         key_info = COALESCE(key_info, 'Nyckel i nyckelskåp A3')
   WHERE org_id = v_org AND name = 'Henry claesson';

  INSERT INTO public.care_clients (org_id, name, address, phone, personal_number, door_code, key_info, notes)
  SELECT v_org, 'Ingrid Persson', 'Kungsgatan 4, Västerås', '021-22 33 44', '19380412-1234', '4455', 'Nyckel i skåp B1', 'Behöver hjälp vid dusch.'
  WHERE NOT EXISTS (SELECT 1 FROM public.care_clients WHERE org_id = v_org AND name = 'Ingrid Persson');
  INSERT INTO public.care_clients (org_id, name, address, phone, personal_number, door_code, key_info, notes)
  SELECT v_org, 'Karl Svensson', 'Vasagatan 27, Västerås', '021-55 66 77', '19420903-5678', '9081', 'Portnyckel i skåp C2', 'Hörselnedsättning, ring på länge.'
  WHERE NOT EXISTS (SELECT 1 FROM public.care_clients WHERE org_id = v_org AND name = 'Karl Svensson');

  SELECT id INTO v_henry FROM public.care_clients WHERE org_id = v_org AND name = 'Henry claesson';
  SELECT id INTO v_ingrid FROM public.care_clients WHERE org_id = v_org AND name = 'Ingrid Persson';
  SELECT id INTO v_karl FROM public.care_clients WHERE org_id = v_org AND name = 'Karl Svensson';

  -- Anhöriga
  INSERT INTO public.care_relatives (org_id, client_id, name, relation, email, phone, consent)
  SELECT v_org, v_ingrid, 'Maria Persson', 'Dotter', 'maria@example.com', '070-444 55 66',
         '{"schema":true,"insatser":true,"medicin":false,"anteckningar":false}'::jsonb
  WHERE v_ingrid IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.care_relatives WHERE client_id = v_ingrid AND name = 'Maria Persson');
  INSERT INTO public.care_relatives (org_id, client_id, name, relation, email, phone, consent)
  SELECT v_org, v_karl, 'Per Svensson', 'Son', 'per@example.com', '070-555 66 77',
         '{"schema":true,"insatser":false,"medicin":false,"anteckningar":false}'::jsonb
  WHERE v_karl IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.care_relatives WHERE client_id = v_karl AND name = 'Per Svensson');

  -- Insatsmallar
  INSERT INTO public.care_task_templates (org_id, title, description, default_minutes)
  SELECT v_org, 'Dusch', 'Hjälp med dusch och påklädning', 45
  WHERE NOT EXISTS (SELECT 1 FROM public.care_task_templates WHERE org_id = v_org AND title = 'Dusch');
  INSERT INTO public.care_task_templates (org_id, title, description, default_minutes)
  SELECT v_org, 'Städ', 'Veckostäd av kök och badrum', 60
  WHERE NOT EXISTS (SELECT 1 FROM public.care_task_templates WHERE org_id = v_org AND title = 'Städ');
  INSERT INTO public.care_task_templates (org_id, title, description, default_minutes)
  SELECT v_org, 'Tillsyn', 'Kort tillsyn och medicinpåminnelse', 20
  WHERE NOT EXISTS (SELECT 1 FROM public.care_task_templates WHERE org_id = v_org AND title = 'Tillsyn');

  SELECT id INTO v_dusch FROM public.care_task_templates WHERE org_id = v_org AND title = 'Dusch';
  SELECT id INTO v_stad FROM public.care_task_templates WHERE org_id = v_org AND title = 'Städ';
  SELECT id INTO v_tillsyn FROM public.care_task_templates WHERE org_id = v_org AND title = 'Tillsyn';

  -- Medicin
  INSERT INTO public.care_medications (org_id, client_id, name, dose, times, instructions, requires_delegation)
  SELECT v_org, v_ingrid, 'Alvedon', '1 tablett', '08:00, 20:00', 'Tas med mat', true
  WHERE v_ingrid IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.care_medications WHERE client_id = v_ingrid AND name = 'Alvedon');
  INSERT INTO public.care_medications (org_id, client_id, name, dose, times, instructions, requires_delegation)
  SELECT v_org, v_karl, 'Waran', '2,5 mg', '18:00', 'Enligt ordination', true
  WHERE v_karl IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.care_medications WHERE client_id = v_karl AND name = 'Waran');

  -- Besök: igår och kommande vecka
  IF NOT EXISTS (SELECT 1 FROM public.care_visits WHERE org_id = v_org) THEN
    INSERT INTO public.care_visits (org_id, client_id, staff_id, title, starts_at, ends_at, status, checkin_at, checkout_at, travel_meters, travel_seconds)
    VALUES (v_org, v_ingrid, v_anna, 'Morgonbesök',
            (current_date - 1) + time '08:00', (current_date - 1) + time '08:45', 'done',
            (current_date - 1) + time '08:02', (current_date - 1) + time '08:47', 2400, 480);

    INSERT INTO public.care_visits (org_id, client_id, staff_id, title, starts_at, ends_at, status)
    VALUES
      (v_org, v_ingrid, v_anna, 'Morgonbesök', current_date + time '08:00', current_date + time '08:45', 'planned'),
      (v_org, v_karl, v_johan, 'Tillsyn', current_date + time '17:00', current_date + time '17:20', 'planned'),
      (v_org, v_henry, v_sara, 'Städ', (current_date + 1) + time '10:00', (current_date + 1) + time '11:00', 'planned'),
      (v_org, v_ingrid, NULL, 'Dusch', (current_date + 2) + time '09:00', (current_date + 2) + time '09:45', 'planned'),
      (v_org, v_karl, v_johan, 'Kvällsbesök', (current_date + 3) + time '19:00', (current_date + 3) + time '19:30', 'planned');

    SELECT id INTO v_visit FROM public.care_visits
     WHERE org_id = v_org AND client_id = v_ingrid AND starts_at = current_date + time '08:00' LIMIT 1;
    IF v_visit IS NOT NULL THEN
      INSERT INTO public.care_visit_tasks (org_id, visit_id, template_id, title, sort_order)
      VALUES (v_org, v_visit, v_tillsyn, 'Tillsyn', 0),
             (v_org, v_visit, v_dusch, 'Dusch', 1);
    END IF;
  END IF;
END $$;