CREATE TABLE public.twin_doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  clinic text NOT NULL DEFAULT '',
  specialty text NOT NULL DEFAULT '',
  languages text NOT NULL DEFAULT '',
  is_female boolean NOT NULL DEFAULT false,
  treats_pcos boolean NOT NULL DEFAULT false,
  treats_endo boolean NOT NULL DEFAULT false,
  supports_queer_trans boolean NOT NULL DEFAULT false,
  supports_single_women boolean NOT NULL DEFAULT false,
  consent boolean NOT NULL DEFAULT false CHECK (consent = true),
  photos text[] NOT NULL DEFAULT '{}',
  mouth_x real NOT NULL DEFAULT 0.5,
  mouth_y real NOT NULL DEFAULT 0.72,
  voice_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.twin_doctors TO authenticated;
GRANT ALL ON public.twin_doctors TO service_role;
ALTER TABLE public.twin_doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read consented twins" ON public.twin_doctors FOR SELECT TO authenticated USING (consent OR owner_id = auth.uid());
CREATE POLICY "owner insert" ON public.twin_doctors FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner update" ON public.twin_doctors FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner delete" ON public.twin_doctors FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.twin_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.twin_doctors(id) ON DELETE CASCADE,
  doc_name text NOT NULL,
  section text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.twin_chunks(doctor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.twin_chunks TO authenticated;
GRANT ALL ON public.twin_chunks TO service_role;
ALTER TABLE public.twin_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read chunks" ON public.twin_chunks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.twin_doctors d WHERE d.id = doctor_id AND (d.consent OR d.owner_id = auth.uid())));
CREATE POLICY "owner write chunks" ON public.twin_chunks FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.twin_doctors d WHERE d.id = doctor_id AND d.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.twin_doctors d WHERE d.id = doctor_id AND d.owner_id = auth.uid()));

CREATE TABLE public.twin_patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  display_name text NOT NULL,
  reason text NOT NULL DEFAULT 'exploring',
  diagnosis text NOT NULL DEFAULT '',
  medication text NOT NULL DEFAULT '',
  knowledge_level text NOT NULL DEFAULT 'new',
  preferences text[] NOT NULL DEFAULT '{}',
  preferred_language text NOT NULL DEFAULT '',
  values_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.twin_patients TO authenticated;
GRANT ALL ON public.twin_patients TO service_role;
ALTER TABLE public.twin_patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own patients" ON public.twin_patients FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.twin_nurse_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  doctor_id uuid NOT NULL REFERENCES public.twin_doctors(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.twin_patients(id) ON DELETE SET NULL,
  patient_name text NOT NULL DEFAULT '',
  question text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.twin_nurse_reviews TO authenticated;
GRANT ALL ON public.twin_nurse_reviews TO service_role;
ALTER TABLE public.twin_nurse_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert own review" ON public.twin_nurse_reviews FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "read reviews" ON public.twin_nurse_reviews FOR SELECT TO authenticated USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.twin_doctors d WHERE d.id = doctor_id AND d.owner_id = auth.uid()));
CREATE POLICY "delete reviews" ON public.twin_nurse_reviews FOR DELETE TO authenticated USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.twin_doctors d WHERE d.id = doctor_id AND d.owner_id = auth.uid()));