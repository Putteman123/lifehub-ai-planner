DO $$
DECLARE
  keep_id uuid;
  dup_id uuid;
  merged int;
BEGIN
  -- 1) Slå ihop dubblettplatser (samma användare, inom 60 m, likartat namn)
  FOR keep_id, dup_id IN
    SELECT a.id, b.id
    FROM public.places a
    JOIN public.places b
      ON a.user_id = b.user_id
     AND a.created_at < b.created_at
     AND (
       6371000 * 2 * asin(least(1, sqrt(
         power(sin(radians(b.lat - a.lat) / 2), 2) +
         cos(radians(a.lat)) * cos(radians(b.lat)) *
         power(sin(radians(b.lng - a.lng) / 2), 2)
       )))
     ) <= 60
     AND lower(left(a.name, 3)) = lower(left(b.name, 3))
  LOOP
    UPDATE public.visits SET place_id = keep_id WHERE place_id = dup_id;
    UPDATE public.day_segments SET place_id = keep_id WHERE place_id = dup_id;
    DELETE FROM public.places WHERE id = dup_id;
  END LOOP;

  -- 2) Ta bort AI-dubbletter som överlappar en telefonregistrerad post
  DELETE FROM public.visit_edits ve
  USING public.visits v
  WHERE ve.visit_id = v.id
    AND v.source = 'ai'
    AND v.is_manual = false
    AND EXISTS (
      SELECT 1 FROM public.visits o
      WHERE o.user_id = v.user_id
        AND o.id <> v.id
        AND o.source <> 'ai'
        AND o.arrived_at < coalesce(v.left_at, v.arrived_at + interval '1 minute')
        AND coalesce(o.left_at, now()) > v.arrived_at
    );

  UPDATE public.day_segments ds SET visit_id = NULL
  WHERE ds.visit_id IN (
    SELECT v.id FROM public.visits v
    WHERE v.source = 'ai' AND v.is_manual = false
      AND EXISTS (
        SELECT 1 FROM public.visits o
        WHERE o.user_id = v.user_id AND o.id <> v.id AND o.source <> 'ai'
          AND o.arrived_at < coalesce(v.left_at, v.arrived_at + interval '1 minute')
          AND coalesce(o.left_at, now()) > v.arrived_at
      )
  );

  DELETE FROM public.visits v
  WHERE v.source = 'ai' AND v.is_manual = false
    AND EXISTS (
      SELECT 1 FROM public.visits o
      WHERE o.user_id = v.user_id AND o.id <> v.id AND o.source <> 'ai'
        AND o.arrived_at < coalesce(v.left_at, v.arrived_at + interval '1 minute')
        AND coalesce(o.left_at, now()) > v.arrived_at
    );

  -- 3) Slå ihop besök som ligger direkt efter varandra på samma plats
  LOOP
    WITH ordered AS (
      SELECT v.*, lead(v.id) OVER w AS next_id,
             lead(v.arrived_at) OVER w AS next_arrived,
             lead(v.left_at) OVER w AS next_left,
             lead(v.place_id) OVER w AS next_place,
             lead(v.entry_kind) OVER w AS next_kind
      FROM public.visits v
      WINDOW w AS (PARTITION BY v.user_id ORDER BY v.arrived_at)
    ), pairs AS (
      SELECT id, next_id, next_left
      FROM ordered
      WHERE entry_kind = 'besok' AND next_kind = 'besok'
        AND place_id IS NOT NULL AND place_id = next_place
        AND left_at IS NOT NULL
        AND next_arrived <= left_at + interval '10 minutes'
    ), first_pairs AS (
      SELECT DISTINCT ON (id) id, next_id, next_left FROM pairs ORDER BY id
    )
    UPDATE public.visits v
    SET left_at = fp.next_left
    FROM first_pairs fp
    WHERE v.id = fp.id;
    GET DIAGNOSTICS merged = ROW_COUNT;
    EXIT WHEN merged = 0;

    -- ta bort de hopslagna efterföljarna
    DELETE FROM public.visit_edits WHERE visit_id IN (
      SELECT v2.id FROM public.visits v2
      JOIN public.visits v1 ON v1.user_id = v2.user_id
       AND v1.entry_kind = 'besok' AND v2.entry_kind = 'besok'
       AND v1.place_id = v2.place_id AND v1.id <> v2.id
       AND v1.arrived_at <= v2.arrived_at
       AND coalesce(v1.left_at, now()) >= coalesce(v2.left_at, v2.arrived_at)
    );
    UPDATE public.day_segments SET visit_id = NULL WHERE visit_id IN (
      SELECT v2.id FROM public.visits v2
      JOIN public.visits v1 ON v1.user_id = v2.user_id
       AND v1.entry_kind = 'besok' AND v2.entry_kind = 'besok'
       AND v1.place_id = v2.place_id AND v1.id <> v2.id
       AND v1.arrived_at <= v2.arrived_at
       AND coalesce(v1.left_at, now()) >= coalesce(v2.left_at, v2.arrived_at)
    );
    DELETE FROM public.visits v2
    USING public.visits v1
    WHERE v1.user_id = v2.user_id
      AND v1.entry_kind = 'besok' AND v2.entry_kind = 'besok'
      AND v1.place_id = v2.place_id AND v1.id <> v2.id
      AND v1.arrived_at <= v2.arrived_at
      AND coalesce(v1.left_at, now()) >= coalesce(v2.left_at, v2.arrived_at);
  END LOOP;

  -- 4) Rensa brus: 0-meters resor och mycket korta automatiska besök
  DELETE FROM public.visit_edits WHERE visit_id IN (
    SELECT id FROM public.visits
    WHERE is_manual = false
      AND ((entry_kind = 'resa' AND coalesce(distance_m, 0) < 100)
        OR (entry_kind = 'besok' AND left_at IS NOT NULL
            AND left_at - arrived_at < interval '3 minutes'))
  );
  UPDATE public.day_segments SET visit_id = NULL WHERE visit_id IN (
    SELECT id FROM public.visits
    WHERE is_manual = false
      AND ((entry_kind = 'resa' AND coalesce(distance_m, 0) < 100)
        OR (entry_kind = 'besok' AND left_at IS NOT NULL
            AND left_at - arrived_at < interval '3 minutes'))
  );
  DELETE FROM public.visits
  WHERE is_manual = false
    AND ((entry_kind = 'resa' AND coalesce(distance_m, 0) < 100)
      OR (entry_kind = 'besok' AND left_at IS NOT NULL
          AND left_at - arrived_at < interval '3 minutes'));

  -- 5) Stäng gamla öppna besök som aldrig avslutats
  UPDATE public.visits
  SET left_at = arrived_at + interval '2 hours'
  WHERE left_at IS NULL AND arrived_at < now() - interval '24 hours';
END $$;