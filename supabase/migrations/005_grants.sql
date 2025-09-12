-- supabase/migrations/005_grants
-- Base grants so PostgREST (and the 'authenticated' role) can see/insert
grant usage on schema public to authenticated;
grant select, insert on table public.notifications to authenticated;
-- this helps avoid permission errors
grant usage, select on all sequences in schema public to authenticated;

GRANT UPDATE (read_at) ON public.notifications TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

GRANT EXECUTE ON FUNCTION public.request_order_cancellation(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.finalize_order_cancellation(UUID, BOOLEAN, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_order_cancellation(UUID, BOOLEAN, TEXT, JSONB) TO service_role;

grant execute on function public.is_coach_of_team(uuid) to authenticated, anon;
grant execute on function public.is_member_of_cart(uuid) to authenticated, anon;