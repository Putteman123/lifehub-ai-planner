CREATE TYPE public.travel_mode AS ENUM ('bil', 'kollektivt', 'gang_cykel', 'okant');
ALTER TABLE public.visits ADD COLUMN travel_mode public.travel_mode NOT NULL DEFAULT 'bil';