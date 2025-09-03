-- supabase/migrations/004_functions_and_triggers
-- Functions
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (
        id, email, first_name, last_name, school_name, allergies
    )
    VALUES (
        NEW.id,
        NEW.email,
        -- If email is confirmed, use raw_user_meta_data, otherwise empty string
        CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN COALESCE(NEW.raw_user_meta_data->'data'->>'firstName', '') ELSE '' END,
        CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN COALESCE(NEW.raw_user_meta_data->'data'->>'lastName', '') ELSE '' END,
        CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN COALESCE(NEW.raw_user_meta_data->'data'->>'schoolName', '') ELSE '' END,
        CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN COALESCE(NEW.raw_user_meta_data->'data'->>'allergies', '') ELSE '' END
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email, -- Always keep email in sync
        updated_at = CURRENT_TIMESTAMP,
        first_name = CASE
                        WHEN NEW.email_confirmed_at IS NOT NULL AND NEW.raw_user_meta_data->'data'->>'firstName' IS NOT NULL AND NEW.raw_user_meta_data->'data'->>'firstName' != ''
                        THEN NEW.raw_user_meta_data->'data'->>'firstName'
                        ELSE public.user_profiles.first_name
                    END,
        last_name = CASE
                        WHEN NEW.email_confirmed_at IS NOT NULL AND NEW.raw_user_meta_data->'data'->>'lastName' IS NOT NULL AND NEW.raw_user_meta_data->'data'->>'lastName' != ''
                        THEN NEW.raw_user_meta_data->'data'->>'lastName'
                        ELSE public.user_profiles.last_name
                    END,
        school_name = CASE
                        WHEN NEW.email_confirmed_at IS NOT NULL AND NEW.raw_user_meta_data->'data'->>'schoolName' IS NOT NULL AND NEW.raw_user_meta_data->'data'->>'schoolName' != ''
                        THEN NEW.raw_user_meta_data->'data'->>'schoolName'
                        ELSE public.user_profiles.school_name
                    END,
        allergies = CASE
                        WHEN NEW.email_confirmed_at IS NOT NULL AND NEW.raw_user_meta_data->'data'->>'allergies' IS NOT NULL AND NEW.raw_user_meta_data->'data'->>'allergies' != ''
                        THEN NEW.raw_user_meta_data->'data'->>'allergies'
                        ELSE public.user_profiles.allergies
                    END,
        phone = CASE
                    WHEN NEW.email_confirmed_at IS NOT NULL AND NEW.raw_user_meta_data->'data'->>'phone' IS NOT NULL AND NEW.raw_user_meta_data->'data'->>'phone' != ''
                    THEN NEW.raw_user_meta_data->'data'->>'phone'
                    ELSE public.user_profiles.phone
                END,
        birthday = CASE
                    WHEN NEW.email_confirmed_at IS NOT NULL AND NEW.raw_user_meta_data->'data'->>'birthday' IS NOT NULL AND NEW.raw_user_meta_data->'data'->>'birthday' != ''
                    THEN (NEW.raw_user_meta_data->'data'->>'birthday')::date
                    ELSE public.user_profiles.birthday
                END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- generic updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

create or replace function public.ensure_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;


CREATE OR REPLACE FUNCTION public.is_team_member(team_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_uuid 
    AND tm.user_id = auth.uid()
)
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(team_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_uuid 
    AND t.coach_id = auth.uid()
)
$$;

-- Any coach on the team (not just the main coach_id)
CREATE OR REPLACE FUNCTION public.is_team_coach(team_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1
  FROM public.team_members tm
  WHERE tm.team_id = team_uuid
    AND tm.user_id = auth.uid()
    AND tm.role = 'coach'::public.team_role
);
$$;

create or replace function public.is_a_coach(team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = team
      and tm.user_id = auth.uid()
      and tm.is_active = true
      and tm.role = 'coach'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_team_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
SELECT tm.team_id
FROM public.team_members tm
WHERE tm.user_id = auth.uid()
LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_access_location_address(location_address_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.location_addresses la
    JOIN public.saved_locations sl ON la.location_id = sl.id
    WHERE la.id = location_address_uuid
    AND public.is_team_member(sl.team_id)
)
$$;

-- finalize cancellation (called by jobs/webhooks)
CREATE OR REPLACE FUNCTION public.finalize_order_cancellation(
  p_order_id UUID,
  p_success  BOOLEAN,
  p_message  TEXT DEFAULT NULL,
  p_payload  JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.meal_orders%ROWTYPE;
  v_new_status public.order_status;
BEGIN
  SELECT * INTO v_order
  FROM public.meal_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF p_success THEN
    v_new_status := 'cancelled';
    UPDATE public.meal_orders
    SET order_status  = v_new_status,
        canceled_at   = COALESCE(canceled_at, NOW())
    WHERE id = v_order.id;

    INSERT INTO public.order_events(order_id, type, payload)
    VALUES (
      v_order.id, 'cancelled',
      jsonb_build_object('message', p_message, 'provider', p_payload)
    );
  ELSE
    v_new_status := 'cancel_failed';
    UPDATE public.meal_orders
    SET order_status = v_new_status
    WHERE id = v_order.id;

    INSERT INTO public.order_events(order_id, type, payload)
    VALUES (
      v_order.id, 'cancel_denied',
      jsonb_build_object('message', p_message, 'provider', p_payload)
    );
  END IF;

  RETURN jsonb_build_object('order_id', v_order.id, 'order_status', v_new_status);
END;
$$;

-- request cancellation (creator/coach/admin)
CREATE OR REPLACE FUNCTION public.request_order_cancellation(
  p_order_id UUID,
  p_reason   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.meal_orders%ROWTYPE;
BEGIN
  -- Load + lock the order
  SELECT * INTO v_order
  FROM public.meal_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  -- Authorization: creator OR coach/admin
  IF NOT (
    v_order.created_by = auth.uid()
    OR public.is_team_coach(v_order.team_id)
    OR public.is_team_admin(v_order.team_id)
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  -- If already terminal, no-op
  IF v_order.order_status IN ('completed','cancelled','failed') THEN
    RETURN jsonb_build_object(
      'order_id', v_order.id,
      'order_status', v_order.order_status,
      'no_change', TRUE
    );
  END IF;

  -- If not actually placed yet and still early, cancel immediately
  IF COALESCE(v_order.order_placed, FALSE) = FALSE
     AND v_order.order_status IN ('draft','scheduled') THEN

    UPDATE public.meal_orders
    SET order_status        = 'cancelled',
        canceled_at         = NOW(),
        cancel_requested_at = NOW(),
        cancel_requested_by = auth.uid(),
        cancel_reason       = COALESCE(p_reason, cancel_reason)
    WHERE id = v_order.id;

    INSERT INTO public.order_events(order_id, type, payload)
    VALUES (
      v_order.id, 'cancelled',
      jsonb_build_object('by', auth.uid(), 'reason', p_reason)
    );

    RETURN jsonb_build_object('order_id', v_order.id, 'order_status', 'cancelled');
  END IF;

  -- Otherwise: mark as cancellation requested (to be resolved async by provider)
  UPDATE public.meal_orders
  SET order_status        = 'cancellation_requested',
      cancel_requested_at = COALESCE(cancel_requested_at, NOW()),
      cancel_requested_by = COALESCE(cancel_requested_by, auth.uid()),
      cancel_reason       = COALESCE(p_reason, cancel_reason)
  WHERE id = v_order.id;

  INSERT INTO public.order_events(order_id, type, payload)
  VALUES (
    v_order.id, 'cancel_requested',
    jsonb_build_object('by', auth.uid(), 'reason', p_reason)
  );

  RETURN jsonb_build_object('order_id', v_order.id, 'order_status', 'cancellation_requested');
END;
$$;


ALTER FUNCTION public.is_team_member(UUID)    SET search_path = public;
ALTER FUNCTION public.is_team_admin(UUID)     SET search_path = public;
ALTER FUNCTION public.is_team_coach(UUID)     SET search_path = public;
ALTER FUNCTION public.handle_new_user_profile SET search_path = public;
ALTER FUNCTION public.ensure_created_by SET search_path = public;
ALTER FUNCTION public.set_updated_at     SET search_path = public;
ALTER FUNCTION public.can_access_location_address(uuid) SET search_path = public;


-- Triggers
drop trigger if exists trg_notifications_set_created_by on public.notifications;
create trigger trg_notifications_set_created_by
before insert on public.notifications
for each row execute function public.ensure_created_by();

DROP TRIGGER IF EXISTS trg_meal_orders_set_creator ON public.meal_orders;
CREATE TRIGGER trg_meal_orders_set_creator
BEFORE INSERT ON public.meal_orders
FOR EACH ROW EXECUTE FUNCTION public.ensure_created_by();

DROP TRIGGER IF EXISTS trg_payment_methods_set_creator ON public.payment_methods;
CREATE TRIGGER trg_payment_methods_set_creator
BEFORE INSERT ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.ensure_created_by();

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_teams_updated_at ON public.teams;
CREATE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_meal_orders_updated_at ON public.meal_orders;
CREATE TRIGGER trg_meal_orders_updated_at
BEFORE UPDATE ON public.meal_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_team_members_updated_at ON public.team_members;
CREATE TRIGGER trg_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_restaurants_updated_at     ON public.restaurants;
CREATE TRIGGER trg_restaurants_updated_at
BEFORE UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_menu_items_updated_at      ON public.menu_items;
CREATE TRIGGER trg_menu_items_updated_at
BEFORE UPDATE ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_api_integrations_updated_at ON public.api_integrations;
CREATE TRIGGER trg_api_integrations_updated_at
BEFORE UPDATE ON public.api_integrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_user_auth_change
AFTER INSERT OR UPDATE OF email_confirmed_at, raw_user_meta_data ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

DROP TRIGGER IF EXISTS trg_meal_polls_set_creator ON public.meal_polls;
CREATE TRIGGER trg_meal_polls_set_creator
BEFORE INSERT ON public.meal_polls
FOR EACH ROW EXECUTE FUNCTION public.ensure_created_by();

DROP TRIGGER IF EXISTS trg_member_groups_set_creator ON public.member_groups;
CREATE TRIGGER trg_member_groups_set_creator
BEFORE INSERT ON public.member_groups
FOR EACH ROW EXECUTE FUNCTION public.ensure_created_by();

DROP TRIGGER IF EXISTS trg_member_groups_updated_at ON public.member_groups;
CREATE TRIGGER trg_member_groups_updated_at
BEFORE UPDATE ON public.member_groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_location_addresses_updated_at ON public.location_addresses;
CREATE TRIGGER trg_location_addresses_updated_at
BEFORE UPDATE ON public.location_addresses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();