CREATE POLICY "setec bucket read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'setec-bucket');
CREATE POLICY "setec bucket insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'setec-bucket');
CREATE POLICY "setec bucket update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'setec-bucket') WITH CHECK (bucket_id = 'setec-bucket');
CREATE POLICY "setec bucket delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'setec-bucket');