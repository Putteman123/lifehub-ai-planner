DELETE FROM public.care_shopping_items WHERE org_id = 'a1f00000-0000-4000-8000-000000000001';

INSERT INTO public.care_shopping_items (id, org_id, client_id, title, quantity, note, amount, is_done, done_at, created_name, created_role)
VALUES
  ('a1f00000-0000-4000-8000-000000000701','a1f00000-0000-4000-8000-000000000001','a1f00000-0000-4000-8000-000000000201','Mjölk','2 l',NULL,NULL,false,NULL,'Sara Lind','personal'),
  ('a1f00000-0000-4000-8000-000000000702','a1f00000-0000-4000-8000-000000000001','a1f00000-0000-4000-8000-000000000201','Knäckebröd','1 paket','Gärna grovt',NULL,false,NULL,'Eva Persson','anhorig'),
  ('a1f00000-0000-4000-8000-000000000703','a1f00000-0000-4000-8000-000000000001','a1f00000-0000-4000-8000-000000000201','Bananer','4 st',NULL,32,true,now() - interval '1 day','Sara Lind','personal'),
  ('a1f00000-0000-4000-8000-000000000704','a1f00000-0000-4000-8000-000000000001','a1f00000-0000-4000-8000-000000000202','Kaffe','1 paket',NULL,NULL,false,NULL,'Karl Svensson','brukare'),
  ('a1f00000-0000-4000-8000-000000000705','a1f00000-0000-4000-8000-000000000001','a1f00000-0000-4000-8000-000000000202','Tvättmedel','1 flaska','Parfymfritt',NULL,false,NULL,'Lena Bergqvist','administrator'),
  ('a1f00000-0000-4000-8000-000000000706','a1f00000-0000-4000-8000-000000000001','a1f00000-0000-4000-8000-000000000203','Yoghurt','2 st',NULL,48,true,now() - interval '2 days','Sara Lind','personal'),
  ('a1f00000-0000-4000-8000-000000000707','a1f00000-0000-4000-8000-000000000001','a1f00000-0000-4000-8000-000000000204','Potatis','2 kg',NULL,NULL,false,NULL,'Johan Ek','personal'),
  ('a1f00000-0000-4000-8000-000000000708','a1f00000-0000-4000-8000-000000000001','a1f00000-0000-4000-8000-000000000205','Blöjor','1 paket','Storlek M',NULL,false,NULL,'Lena Bergqvist','administrator');

INSERT INTO public.care_org_finance (org_id, hourly_rate, staff_cost_per_hour, travel_cost_per_km)
VALUES ('a1f00000-0000-4000-8000-000000000001', 520, 295, 25)
ON CONFLICT (org_id) DO UPDATE
SET hourly_rate = EXCLUDED.hourly_rate,
    staff_cost_per_hour = EXCLUDED.staff_cost_per_hour,
    travel_cost_per_km = EXCLUDED.travel_cost_per_km;
