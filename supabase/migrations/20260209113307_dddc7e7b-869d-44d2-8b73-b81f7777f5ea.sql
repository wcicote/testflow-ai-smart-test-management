
-- Create test-evidences storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('test-evidences', 'test-evidences', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for test-evidences bucket
CREATE POLICY "Users can view test evidences"
ON storage.objects FOR SELECT
USING (bucket_id = 'test-evidences');

CREATE POLICY "Authenticated users can upload test evidences"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'test-evidences' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete their test evidences"
ON storage.objects FOR DELETE
USING (bucket_id = 'test-evidences' AND auth.role() = 'authenticated');
