ALTER TABLE public.people ADD COLUMN IF NOT EXISTS share_contact_card boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.set_contact_card_share(_on boolean)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $fn$ UPDATE public.people SET share_contact_card = _on WHERE user_id = auth.uid(); $fn$;
REVOKE ALL ON FUNCTION public.set_contact_card_share(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_contact_card_share(boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.contact_card(_code text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
  SELECT jsonb_build_object('full_name', p.full_name, 'organization', p.organization,
    'email', p.email, 'phone', p.phone, 'linkedin_url', p.linkedin_url)
  FROM public.people p
  WHERE upper(p.delegate_code) = upper(btrim(_code)) AND p.share_contact_card AND NOT p.is_placeholder
$fn$;
REVOKE ALL ON FUNCTION public.contact_card(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.contact_card(text) TO authenticated;