CREATE POLICY "own andrea files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'andrea' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'andrea' AND (storage.foldername(name))[1] = auth.uid()::text);