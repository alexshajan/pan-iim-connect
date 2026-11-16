CREATE POLICY "deck files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'decks' AND public.has_any_role(auth.uid(), ARRAY['admin','editor','room_volunteer']));
CREATE POLICY "deck files write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'decks' AND public.is_organizer(auth.uid()));
CREATE POLICY "deck files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'decks' AND public.is_organizer(auth.uid()));