CREATE OR REPLACE FUNCTION public.twin_status_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'published' OR NEW.is_demo THEN NEW.status := 'review'; NEW.is_demo := false; END IF;
  ELSE
    IF NEW.status = 'published' AND OLD.status <> 'published' THEN RAISE EXCEPTION 'Only an admin can publish a twin'; END IF;
    NEW.is_demo := OLD.is_demo;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER twin_status_guard BEFORE INSERT OR UPDATE ON public.twin_doctors FOR EACH ROW EXECUTE FUNCTION public.twin_status_guard();