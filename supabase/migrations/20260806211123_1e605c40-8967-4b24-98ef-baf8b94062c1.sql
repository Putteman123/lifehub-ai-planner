CREATE POLICY "own ekonomi files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'ekonomi' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'ekonomi' AND (storage.foldername(name))[1] = auth.uid()::text);