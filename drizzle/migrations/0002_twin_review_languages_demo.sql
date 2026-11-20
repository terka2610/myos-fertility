ALTER TABLE public.twin_doctors ADD COLUMN status text NOT NULL DEFAULT 'review' CHECK (status IN ('draft','review','published'));
ALTER TABLE public.twin_doctors ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.twin_doctors ADD COLUMN bio text NOT NULL DEFAULT '';
UPDATE public.twin_doctors SET status = 'published';
ALTER TABLE public.twin_patients ADD COLUMN language text NOT NULL DEFAULT 'English';

DROP POLICY "read consented twins" ON public.twin_doctors;
CREATE POLICY "read published twins" ON public.twin_doctors FOR SELECT TO authenticated USING ((consent AND status = 'published') OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update twins" ON public.twin_doctors FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.twin_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.twin_doctors(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.twin_documents TO authenticated;
GRANT ALL ON public.twin_documents TO service_role;
ALTER TABLE public.twin_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read documents" ON public.twin_documents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.twin_doctors d WHERE d.id = doctor_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR (d.status = 'published' AND status = 'approved'))));
CREATE POLICY "owner insert documents" ON public.twin_documents FOR INSERT TO authenticated WITH CHECK (status = 'pending' AND EXISTS (SELECT 1 FROM public.twin_doctors d WHERE d.id = doctor_id AND d.owner_id = auth.uid()));
CREATE POLICY "owner delete documents" ON public.twin_documents FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.twin_doctors d WHERE d.id = doctor_id AND d.owner_id = auth.uid()));
CREATE POLICY "admin update documents" ON public.twin_documents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.twin_chunks ADD COLUMN document_id uuid REFERENCES public.twin_documents(id) ON DELETE CASCADE;
DROP POLICY "read chunks" ON public.twin_chunks;
CREATE POLICY "read chunks" ON public.twin_chunks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.twin_doctors d WHERE d.id = doctor_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR (d.status = 'published' AND d.consent AND EXISTS (SELECT 1 FROM public.twin_documents x WHERE x.id = document_id AND x.status = 'approved')))));

CREATE TABLE public.twin_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  doctor_id uuid NOT NULL REFERENCES public.twin_doctors(id) ON DELETE CASCADE,
  patient_name text NOT NULL,
  contact text NOT NULL,
  preferred_time text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.twin_booking_requests TO authenticated;
GRANT ALL ON public.twin_booking_requests TO service_role;
ALTER TABLE public.twin_booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert own booking" ON public.twin_booking_requests FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "read booking" ON public.twin_booking_requests FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.twin_doctors d WHERE d.id = doctor_id AND d.owner_id = auth.uid()));

CREATE POLICY "twin media owner read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'twin-media' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "twin media owner write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'twin-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "twin media owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'twin-media' AND (storage.foldername(name))[1] = auth.uid()::text);

INSERT INTO public.twin_doctors (id,owner_id,name,clinic,specialty,languages,is_female,treats_pcos,treats_endo,supports_queer_trans,supports_single_women,consent,photos,mouth_x,mouth_y,status,is_demo,bio) VALUES
('d0c70000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','Elena Marsh','Rose Fertility Centre','Fertility preservation & egg freezing','English, Spanish, Portuguese',true,true,true,true,true,true,ARRAY['/__l5e/assets-v1/d05c8bb2-3e40-4353-813c-ef1171efaaba/demo-dr-elena.jpg'],0.525,0.447,'published',true,'I help women plan ahead with egg freezing and fertility preservation, at their own pace.'),
('d0c70000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','Aisha Khan','Harbour IVF Clinic','Reproductive endocrinology, PCOS','English, Hindi, Urdu, Arabic',true,true,false,true,true,true,ARRAY['/__l5e/assets-v1/f205677e-98d2-4936-9ef3-0baa03db0110/demo-dr-priya.jpg'],0.525,0.444,'published',true,'I specialise in PCOS and IVF, and I explain every step in plain words.'),
('d0c70000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','Marcus Ellison','Northside Reproductive Health','IVF & endometriosis','English, French',false,false,true,true,false,true,ARRAY['/__l5e/assets-v1/d41ba786-71bc-4961-945e-2dc921baac6a/demo-dr-samuel.jpg'],0.51,0.44,'published',true,'Thirty years of IVF care. I am here to make treatment feel less overwhelming.')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.twin_documents (doctor_id,name,status) SELECT id,'MYOS demo clinic protocol','approved' FROM public.twin_doctors WHERE is_demo;