CREATE TYPE public.app_role AS ENUM ('admin','publisher','subscriber','clinic_staff');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text, first_name text, last_name text,
  legacy_user_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.legacy_user_map (
  legacy_user_id text PRIMARY KEY,
  email text NOT NULL,
  auth_user_id uuid,
  linked_at timestamptz,
  imported_profile jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON public.legacy_user_map TO service_role;
ALTER TABLE public.legacy_user_map ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'subscriber') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.care_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE, name text NOT NULL, description text,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.care_programs TO anon, authenticated;
GRANT ALL ON public.care_programs TO service_role;
ALTER TABLE public.care_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public programs readable" ON public.care_programs FOR SELECT TO anon, authenticated USING (is_public);

CREATE TABLE public.care_program_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  program_id uuid NOT NULL REFERENCES public.care_programs(id) ON DELETE CASCADE,
  care_role text NOT NULL DEFAULT 'patient',
  treatment_stage text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, program_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_program_memberships TO authenticated;
GRANT ALL ON public.care_program_memberships TO service_role;
ALTER TABLE public.care_program_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memberships" ON public.care_program_memberships FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  program_id uuid NOT NULL REFERENCES public.care_programs(id) ON DELETE CASCADE,
  care_role text NOT NULL DEFAULT 'patient',
  last_mode text NOT NULL DEFAULT 'text',
  summary text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, program_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultations TO authenticated;
GRANT ALL ON public.consultations TO service_role;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own consultations" ON public.consultations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.consultation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  sender text NOT NULL, content text NOT NULL,
  mode text NOT NULL DEFAULT 'text', care_role text,
  provenance text NOT NULL DEFAULT 'ai_generated',
  safety jsonb, sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.consultation_messages (consultation_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.consultation_messages TO authenticated;
GRANT ALL ON public.consultation_messages TO service_role;
ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages read" ON public.consultation_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultations c WHERE c.id = consultation_id AND c.user_id = auth.uid()));
CREATE POLICY "own messages insert" ON public.consultation_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.consultations c WHERE c.id = consultation_id AND c.user_id = auth.uid()));
CREATE POLICY "own messages delete" ON public.consultation_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultations c WHERE c.id = consultation_id AND c.user_id = auth.uid()));

CREATE TABLE public.patient_context_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  kind text NOT NULL, content text NOT NULL,
  provenance text NOT NULL DEFAULT 'patient_reported',
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.patient_context_entries TO authenticated;
GRANT ALL ON public.patient_context_entries TO service_role;
ALTER TABLE public.patient_context_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own context read" ON public.patient_context_entries FOR SELECT TO authenticated USING (patient_id = auth.uid());
CREATE POLICY "own reported insert" ON public.patient_context_entries FOR INSERT TO authenticated WITH CHECK (patient_id = auth.uid() AND provenance = 'patient_reported');
CREATE POLICY "own context delete" ON public.patient_context_entries FOR DELETE TO authenticated USING (patient_id = auth.uid() AND provenance <> 'verified_clinical');

CREATE TABLE public.simulated_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  category text NOT NULL, summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.simulated_escalations TO authenticated;
GRANT ALL ON public.simulated_escalations TO service_role;
ALTER TABLE public.simulated_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own escalations" ON public.simulated_escalations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultations c WHERE c.id = consultation_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.consultations c WHERE c.id = consultation_id AND c.user_id = auth.uid()));

INSERT INTO public.care_programs (slug, name, description) VALUES
 ('ivf-care','IVF Care','An AI fertility companion for people going through IVF and the partners who support them.'),
 ('egg-freezing','Social Egg Freezing','Elective egg freezing, from first questions to using frozen eggs.');