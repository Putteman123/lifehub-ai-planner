INSERT INTO public.visits (user_id, place_id, entry_kind, arrived_at, left_at, lat, lng, source, is_manual, distance_m, travel_mode)
SELECT u.user_id, x.place_id, 'besok'::visit_kind, x.arrived, x.leftat, x.lat, x.lng, 'telefon', false, 0, 'okant'::travel_mode
FROM (SELECT user_id FROM public.app_owner LIMIT 1) u,
(VALUES
  ('8712200d-7d5a-4d97-b2b7-245eadb25594'::uuid, timestamptz '2026-08-17 12:17:12+00', timestamptz '2026-08-17 13:05:02+00', 56.665496, 12.876332),
  ('8712200d-7d5a-4d97-b2b7-245eadb25594'::uuid, timestamptz '2026-08-17 13:28:52+00', timestamptz '2026-08-17 16:11:06+00', 56.665453, 12.876562),
  ('8712200d-7d5a-4d97-b2b7-245eadb25594'::uuid, timestamptz '2026-08-17 16:35:32+00', timestamptz '2026-08-18 10:55:33+00', 56.665458, 12.876639),
  ('8712200d-7d5a-4d97-b2b7-245eadb25594'::uuid, timestamptz '2026-08-18 10:59:42+00', timestamptz '2026-08-18 11:17:09+00', 56.665537, 12.876373),
  ('8712200d-7d5a-4d97-b2b7-245eadb25594'::uuid, timestamptz '2026-08-18 12:48:59+00', timestamptz '2026-08-18 19:07:04+00', 56.665494, 12.876468)
) AS x(place_id, arrived, leftat, lat, lng);

INSERT INTO public.visits (user_id, place_id, entry_kind, arrived_at, left_at, lat, lng, source, is_manual, distance_m, travel_mode)
SELECT u.user_id, '98d45a0a-7e70-4f4e-b8d7-8d74943882d5'::uuid, 'besok'::visit_kind,
       timestamptz '2026-08-18 19:14:48+00', NULL, 56.682439, 12.843389, 'telefon', false, 0, 'okant'::travel_mode
FROM (SELECT user_id FROM public.app_owner LIMIT 1) u;