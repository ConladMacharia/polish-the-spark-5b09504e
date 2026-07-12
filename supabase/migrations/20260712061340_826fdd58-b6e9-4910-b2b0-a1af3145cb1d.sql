
-- Fix search_path on generate_claim_code
CREATE OR REPLACE FUNCTION public.generate_claim_code()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Revoke public execute on internal SECURITY DEFINER helpers.
-- RLS policies still call them because policies run as the table owner.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_can_access_patient(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_claim_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_claim_code() TO authenticated;
