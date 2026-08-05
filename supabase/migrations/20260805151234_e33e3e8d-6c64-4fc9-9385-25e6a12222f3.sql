ALTER TABLE public.shopping_items REPLICA IDENTITY FULL;
ALTER TABLE public.shopping_lists REPLICA IDENTITY FULL;
ALTER TABLE public.pantry_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pantry_items;