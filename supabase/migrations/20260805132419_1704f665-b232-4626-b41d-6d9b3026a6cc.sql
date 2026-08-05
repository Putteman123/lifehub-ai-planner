CREATE POLICY "vault files read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kassaskap' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "vault files insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kassaskap' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "vault files update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'kassaskap' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'kassaskap' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "vault files delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kassaskap' AND auth.uid()::text = (storage.foldername(name))[1]);