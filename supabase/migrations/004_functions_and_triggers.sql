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

-- Split by threshold in assignment order (preview or persist)
CREATE OR REPLACE FUNCTION public.split_order_simple(
  p_parent_order_id UUID,
  p_threshold_cents INTEGER DEFAULT NULL,
  p_preview BOOLEAN DEFAULT FALSE
) RETURNS TABLE(child_order_id UUID, split_index INT, total_cents INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_id UUID;
  v_restaurant_id UUID;
  v_title TEXT;
  v_scheduled_date TIMESTAMPTZ;
  v_status public.order_status;
  v_fulfillment_method TEXT;
  v_threshold INTEGER;
  v_can_manage BOOLEAN;

  v_child_id UUID;
  v_child_total INTEGER := 0;
  v_idx INT := 0;

  r RECORD;
  price INT;
  remaining INT;
  units_fit INT;
  use_units INT;

  -- Parent monetary fields for proportional allocation
  v_parent_subtotal INT := 0;
  v_parent_delivery INT := 0;
  v_parent_service  INT := 0;
  v_parent_small    INT := 0;
  v_parent_tax      INT := 0;
  v_parent_tip      INT := 0;
  v_parent_promo    INT := 0;
  v_parent_total_without INT := 0;
  v_parent_total_with    INT := 0;
  v_parent_driver_tip    INT := 0;
  v_parent_pickup_tip    INT := 0;

  v_sum_subtotal INT := 0;
  v_children_count INT := 0;
  v_i INT := 0;
  v_ratio NUMERIC := 0;

  -- per-child allocation holders
  child_subtotal INT := 0;
  child_delivery INT := 0;
  child_service  INT := 0;
  child_small    INT := 0;
  child_tax      INT := 0;
  child_tip      INT := 0;
  child_driver_tip INT := 0;
  child_pickup_tip INT := 0;
  child_promo    INT := 0;
  child_total_without INT := 0;
  child_total_with    INT := 0;

  -- running allocated counters to keep rounding balanced
  acc_delivery INT := 0;
  acc_service  INT := 0;
  acc_small    INT := 0;
  acc_tax      INT := 0;
  acc_tip      INT := 0;
  acc_driver_tip INT := 0;
  acc_pickup_tip INT := 0;
  acc_promo    INT := 0;
  acc_total_without INT := 0;
  acc_total_with    INT := 0;
BEGIN
  SELECT team_id, restaurant_id, title, scheduled_date, order_status, fulfillment_method,
         subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents,
         sales_tax_cents, tip_cents, promo_discount_cents,
         total_without_tips_cents, total_with_tip_cents,
         driver_tip_cents, pickup_tip_cents
    INTO v_team_id, v_restaurant_id, v_title, v_scheduled_date, v_status, v_fulfillment_method,
         v_parent_subtotal, v_parent_delivery, v_parent_service, v_parent_small,
         v_parent_tax, v_parent_tip, v_parent_promo,
         v_parent_total_without, v_parent_total_with,
         v_parent_driver_tip, v_parent_pickup_tip
  FROM public.meal_orders
  WHERE id = p_parent_order_id;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Parent order % not found', p_parent_order_id;
  END IF;

  v_parent_subtotal      := COALESCE(v_parent_subtotal, 0);
  v_parent_delivery      := COALESCE(v_parent_delivery, 0);
  v_parent_service       := COALESCE(v_parent_service, 0);
  v_parent_small         := COALESCE(v_parent_small, 0);
  v_parent_tax           := COALESCE(v_parent_tax, 0);
  v_parent_tip           := COALESCE(v_parent_tip, 0);
  v_parent_promo         := COALESCE(v_parent_promo, 0);
  v_parent_total_without := COALESCE(v_parent_total_without, 0);
  v_parent_total_with    := COALESCE(v_parent_total_with, 0);
  v_parent_driver_tip    := COALESCE(v_parent_driver_tip, 0);
  v_parent_pickup_tip    := COALESCE(v_parent_pickup_tip, 0);

  IF v_parent_total_without = 0 THEN
    v_parent_total_without := GREATEST(
      v_parent_subtotal + v_parent_delivery + v_parent_service + v_parent_small + v_parent_tax - v_parent_promo,
      0
    );
  END IF;
  IF v_parent_total_with = 0 THEN
    v_parent_total_with := GREATEST(v_parent_total_without + v_parent_tip, 0);
  END IF;

  SELECT (public.is_team_coach(v_team_id) OR public.is_team_admin(v_team_id) OR EXISTS(
            SELECT 1 FROM public.meal_orders WHERE id = p_parent_order_id AND created_by = auth.uid()
          ))
    INTO v_can_manage;
  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'Insufficient privileges to split this order';
  END IF;

  IF p_threshold_cents IS NULL THEN
    SELECT COALESCE((value->>'value')::INT, 25000) INTO v_threshold
    FROM public.app_settings WHERE key = 'split_threshold_cents';
    IF v_threshold IS NULL THEN v_threshold := 25000; END IF;
  ELSE
    v_threshold := p_threshold_cents;
  END IF;

  CREATE TEMP TABLE _children(
    id UUID,
    idx INT,
    total INT DEFAULT 0
  ) ON COMMIT DROP;

  v_child_id := NULL;
  v_child_total := 0;

  FOR r IN
    SELECT i.id, i.product_marked_price_cents::INT AS price_cents,
           COALESCE(i.quantity,1) AS qty,
           i.is_extra,
           i.team_member_id,
           COALESCE(tm.full_name,'') AS assignee_name,
           i.product_id, i.name, i.description, i.image_url, i.notes
    FROM public.meal_order_items i
    LEFT JOIN public.team_members tm ON tm.id = i.team_member_id
    WHERE i.order_id = p_parent_order_id
    ORDER BY
      CASE WHEN i.is_extra THEN 2 WHEN i.team_member_id IS NULL THEN 1 ELSE 0 END,
      assignee_name ASC,
      i.name ASC
  LOOP
    price := COALESCE(r.price_cents, 0);
    remaining := r.qty;

    -- open bucket helper
    PERFORM 1;
    IF (v_child_id IS NULL OR v_child_total >= v_threshold) THEN
      v_idx := v_idx + 1;
      IF NOT p_preview THEN
        INSERT INTO public.meal_orders (
          team_id, restaurant_id, title, meal_type, description, scheduled_date, order_status,
          payment_method_id, total_amount, payment_status, created_by, parent_order_id, is_split_child, split_group,
          fulfillment_method, delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip,
          delivery_latitude, delivery_longitude, delivery_instructions, user_pickup_notes
        )
        SELECT team_id, restaurant_id, v_title || ' • Part ' || v_idx, meal_type, description, scheduled_date, v_status,
               payment_method_id, 0, payment_status, created_by, p_parent_order_id, TRUE, 'simple',
               fulfillment_method, delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip,
               delivery_latitude, delivery_longitude, delivery_instructions, user_pickup_notes
        FROM public.meal_orders WHERE id = p_parent_order_id
        RETURNING id INTO v_child_id;

        INSERT INTO public.meal_order_splits(parent_order_id, child_order_id, split_group)
        VALUES (p_parent_order_id, v_child_id, 'simple');
      ELSE
        v_child_id := NULL; -- preview path
      END IF;
      INSERT INTO _children(id, idx, total) VALUES (v_child_id, v_idx, 0);
      v_child_total := 0;
    END IF;

    IF price <= 0 THEN
      IF NOT p_preview THEN
        INSERT INTO public.meal_order_items (order_id, team_member_id, product_id, name, description, image_url, notes, quantity, product_marked_price_cents, is_extra)
        VALUES (v_child_id, r.team_member_id, r.product_id, r.name, r.description, r.image_url, r.notes, remaining, r.price_cents, r.is_extra);
      END IF;
      UPDATE _children SET total = total + (price * remaining) WHERE idx = v_idx;
      v_child_total := v_child_total + (price * remaining);
      remaining := 0;
    ELSE
      WHILE remaining > 0 LOOP
        IF v_child_total + price > v_threshold THEN
          -- new bucket
          v_idx := v_idx + 1;
          IF NOT p_preview THEN
            INSERT INTO public.meal_orders (
              team_id, restaurant_id, title, meal_type, description, scheduled_date, order_status,
              payment_method_id, total_amount, payment_status, created_by, parent_order_id, is_split_child, split_group,
              fulfillment_method, delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip,
              delivery_latitude, delivery_longitude, delivery_instructions, user_pickup_notes
            )
            SELECT team_id, restaurant_id, v_title || ' • Part ' || v_idx, meal_type, description, scheduled_date, v_status,
                   payment_method_id, 0, payment_status, created_by, p_parent_order_id, TRUE, 'simple',
                   fulfillment_method, delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip,
                   delivery_latitude, delivery_longitude, delivery_instructions, user_pickup_notes
            FROM public.meal_orders WHERE id = p_parent_order_id
            RETURNING id INTO v_child_id;

            INSERT INTO public.meal_order_splits(parent_order_id, child_order_id, split_group)
            VALUES (p_parent_order_id, v_child_id, 'simple');
          ELSE
            v_child_id := NULL;
          END IF;
          INSERT INTO _children(id, idx, total) VALUES (v_child_id, v_idx, 0);
          v_child_total := 0;
        END IF;

        units_fit := GREATEST( (v_threshold - v_child_total) / price, 0 );
        IF units_fit <= 0 THEN
          units_fit := 1; -- force at least one unit to move to the next bucket
        END IF;
        use_units := LEAST(units_fit, remaining);

        IF NOT p_preview THEN
          INSERT INTO public.meal_order_items (order_id, team_member_id, product_id, name, description, image_url, notes, quantity, product_marked_price_cents, is_extra)
          VALUES (v_child_id, r.team_member_id, r.product_id, r.name, r.description, r.image_url, r.notes, use_units, r.price_cents, r.is_extra);
        END IF;

        UPDATE _children SET total = total + (price * use_units) WHERE idx = v_idx;
        v_child_total := v_child_total + (price * use_units);
        remaining := remaining - use_units;
      END LOOP;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(total), 0) INTO v_sum_subtotal FROM _children;
  SELECT COUNT(*) INTO v_children_count FROM _children;

  IF v_children_count = 0 THEN
    RETURN;
  END IF;

  v_i := 0;

  FOR r IN SELECT id, idx, total FROM _children ORDER BY idx LOOP
    v_i := v_i + 1;

    child_order_id := r.id; -- NULL in preview mode
    split_index := r.idx;

    child_subtotal := COALESCE(r.total, 0);
    total_cents := child_subtotal;

    IF v_sum_subtotal > 0 THEN
      v_ratio := child_subtotal::NUMERIC / v_sum_subtotal;
    ELSE
      v_ratio := 1::NUMERIC / v_children_count;
    END IF;

    -- allocate delivery fee
    child_delivery := 0;
    IF v_parent_delivery > 0 THEN
      IF v_i = v_children_count THEN
        child_delivery := v_parent_delivery - acc_delivery;
      ELSE
        child_delivery := ROUND(v_parent_delivery * v_ratio)::INT;
        child_delivery := GREATEST(child_delivery, 0);
        child_delivery := LEAST(child_delivery, v_parent_delivery - acc_delivery);
      END IF;
      acc_delivery := acc_delivery + child_delivery;
    END IF;

    -- allocate service fee
    child_service := 0;
    IF v_parent_service > 0 THEN
      IF v_i = v_children_count THEN
        child_service := v_parent_service - acc_service;
      ELSE
        child_service := ROUND(v_parent_service * v_ratio)::INT;
        child_service := GREATEST(child_service, 0);
        child_service := LEAST(child_service, v_parent_service - acc_service);
      END IF;
      acc_service := acc_service + child_service;
    END IF;

    -- allocate small-order fee
    child_small := 0;
    IF v_parent_small > 0 THEN
      IF v_i = v_children_count THEN
        child_small := v_parent_small - acc_small;
      ELSE
        child_small := ROUND(v_parent_small * v_ratio)::INT;
        child_small := GREATEST(child_small, 0);
        child_small := LEAST(child_small, v_parent_small - acc_small);
      END IF;
      acc_small := acc_small + child_small;
    END IF;

    -- allocate tax
    child_tax := 0;
    IF v_parent_tax > 0 THEN
      IF v_i = v_children_count THEN
        child_tax := v_parent_tax - acc_tax;
      ELSE
        child_tax := ROUND(v_parent_tax * v_ratio)::INT;
        child_tax := GREATEST(child_tax, 0);
        child_tax := LEAST(child_tax, v_parent_tax - acc_tax);
      END IF;
      acc_tax := acc_tax + child_tax;
    END IF;

    -- allocate promo discount (kept positive)
    child_promo := 0;
    IF v_parent_promo > 0 THEN
      IF v_i = v_children_count THEN
        child_promo := v_parent_promo - acc_promo;
      ELSE
        child_promo := ROUND(v_parent_promo * v_ratio)::INT;
        child_promo := GREATEST(child_promo, 0);
        child_promo := LEAST(child_promo, v_parent_promo - acc_promo);
      END IF;
      acc_promo := acc_promo + child_promo;
    END IF;

    child_driver_tip := 0;
    IF v_parent_driver_tip > 0 THEN
      IF v_i = v_children_count THEN
        child_driver_tip := v_parent_driver_tip - acc_driver_tip;
      ELSE
        child_driver_tip := ROUND(v_parent_driver_tip * v_ratio)::INT;
        child_driver_tip := GREATEST(child_driver_tip, 0);
        child_driver_tip := LEAST(child_driver_tip, v_parent_driver_tip - acc_driver_tip);
      END IF;
      acc_driver_tip := acc_driver_tip + child_driver_tip;
    END IF;

    child_pickup_tip := 0;
    IF v_parent_pickup_tip > 0 THEN
      IF v_i = v_children_count THEN
        child_pickup_tip := v_parent_pickup_tip - acc_pickup_tip;
      ELSE
        child_pickup_tip := ROUND(v_parent_pickup_tip * v_ratio)::INT;
        child_pickup_tip := GREATEST(child_pickup_tip, 0);
        child_pickup_tip := LEAST(child_pickup_tip, v_parent_pickup_tip - acc_pickup_tip);
      END IF;
      acc_pickup_tip := acc_pickup_tip + child_pickup_tip;
    END IF;

    -- derive overall tip from component tips when present, otherwise allocate from parent tip total
    child_tip := child_driver_tip + child_pickup_tip;
    IF child_tip = 0 AND v_parent_tip > 0 AND (v_parent_driver_tip + v_parent_pickup_tip) = 0 THEN
      IF v_i = v_children_count THEN
        child_tip := v_parent_tip - acc_tip;
      ELSE
        child_tip := ROUND(v_parent_tip * v_ratio)::INT;
        child_tip := GREATEST(child_tip, 0);
        child_tip := LEAST(child_tip, v_parent_tip - acc_tip);
      END IF;
    END IF;

    IF v_parent_tip > 0 AND (v_parent_driver_tip + v_parent_pickup_tip) > 0 AND v_i = v_children_count THEN
      child_tip := child_tip + (v_parent_tip - (acc_tip + child_tip));
    END IF;

    child_tip := GREATEST(child_tip, 0);
    acc_tip := acc_tip + child_tip;

    child_total_without := child_subtotal + child_delivery + child_service + child_small + child_tax - child_promo;
    IF v_parent_total_without > 0 AND v_i = v_children_count THEN
      child_total_without := child_total_without + (v_parent_total_without - (acc_total_without + child_total_without));
    END IF;
    child_total_without := GREATEST(child_total_without, 0);
    acc_total_without := acc_total_without + child_total_without;

    child_total_with := child_total_without + child_tip;
    IF v_parent_total_with > 0 AND v_i = v_children_count THEN
      child_total_with := child_total_with + (v_parent_total_with - (acc_total_with + child_total_with));
    END IF;
    child_total_with := GREATEST(child_total_with, 0);
    acc_total_with := acc_total_with + child_total_with;

    IF NOT p_preview AND child_order_id IS NOT NULL THEN
      UPDATE public.meal_orders
      SET subtotal_cents = child_subtotal,
          delivery_fee_cents = child_delivery,
          service_fee_cents = child_service,
          small_order_fee_cents = child_small,
          sales_tax_cents = child_tax,
          promo_discount_cents = CASE WHEN v_parent_promo > 0 THEN child_promo ELSE NULL END,
          tip_cents = child_tip,
          driver_tip_cents = child_driver_tip,
          pickup_tip_cents = child_pickup_tip,
          total_without_tips_cents = child_total_without,
          total_with_tip_cents = child_total_with,
          total_amount = (child_total_with::NUMERIC / 100)
      WHERE id = child_order_id;
    END IF;

    RETURN NEXT;
  END LOOP;

  RETURN;
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

-- meal carts
CREATE OR REPLACE FUNCTION public.tg_touch_meal_carts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

create or replace function public.tg_cart_set_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  select tm.id into v_member_id
    from public.team_members tm
   where tm.team_id = NEW.team_id
     and tm.user_id = auth.uid()
   limit 1;

  if v_member_id is not null then
    if NEW.created_by_member_id is null then
      NEW.created_by_member_id := v_member_id;
    end if;
  end if;

  return NEW;
end;
$$;

create or replace function public.tg_cart_auto_membership_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  -- resolve current user's team_member for this team
  select tm.id into v_member_id
    from public.team_members tm
   where tm.team_id = NEW.team_id
     and tm.user_id = auth.uid()
   limit 1;

  if v_member_id is not null then
    insert into public.meal_cart_members (cart_id, member_id, role)
    values (NEW.id, v_member_id, 'owner')
    on conflict (cart_id, member_id) do nothing;
  end if;

  return NEW;  -- (ignored for AFTER, but conventional)
end;
$$;


-- lock ownership on cart items + touch updated_at
CREATE OR REPLACE FUNCTION public.tg_lock_item_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.added_by_member_id IS DISTINCT FROM OLD.added_by_member_id THEN
      RAISE EXCEPTION 'added_by_member_id cannot be changed';
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- fill added_by_member_id on INSERT if null and validate it belongs to cart team
-- Ensure we have the owner/team validation trigger for cart ITEMS
CREATE OR REPLACE FUNCTION public.tg_item_fill_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id  uuid;
  v_cart_team  uuid;
  v_member_team uuid;
BEGIN
  SELECT team_id INTO v_cart_team FROM public.meal_carts WHERE id = NEW.cart_id;
  IF v_cart_team IS NULL THEN
    RAISE EXCEPTION 'Cart % not found', NEW.cart_id;
  END IF;

  SELECT tm.id INTO v_member_id
    FROM public.team_members tm
   WHERE tm.user_id = auth.uid()
     AND tm.team_id = v_cart_team
   LIMIT 1;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this cart''s team';
  END IF;

  INSERT INTO public.meal_cart_members (cart_id, member_id, user_id)
  VALUES (NEW.cart_id, v_member_id, auth.uid())
  ON CONFLICT (cart_id, member_id) DO UPDATE
    SET user_id = COALESCE(meal_cart_members.user_id, EXCLUDED.user_id);

  IF NEW.added_by_member_id IS NULL THEN
    NEW.added_by_member_id := v_member_id;
  END IF;

  -- Validate owner belongs to the same team as the cart
  SELECT team_id INTO v_member_team FROM public.team_members WHERE id = NEW.added_by_member_id;

  IF v_cart_team IS DISTINCT FROM v_member_team THEN
    RAISE EXCEPTION 'Item owner must belong to the same team as the cart';
  END IF;

  RETURN NEW;
END;
$$;

-- Helper: is current user a coach of a given team?
create or replace function public.is_coach_of_team(p_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v boolean;
begin
  select exists (
    select 1
      from public.team_members tm
     where tm.team_id = p_team_id
       and tm.user_id = auth.uid()
       and tm.role = 'coach'
  ) into v;
  return v;
end $$;

create or replace function public.is_member_of_cart(p_cart_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v boolean;
begin
  select exists (
    select 1
      from public.meal_cart_members m
      left join public.team_members tm on tm.id = m.member_id
     where m.cart_id = p_cart_id
       and (
         m.user_id = auth.uid()           -- <--  recognize session linked in cart-members
         or tm.user_id = auth.uid()       -- “owner/rostered user” path
       )
  ) into v;
  return v;
end $$;


CREATE OR REPLACE FUNCTION public.tg_validate_cart_creator_team()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_member_team uuid;
BEGIN
  IF NEW.created_by_member_id IS NOT NULL THEN
    SELECT team_id INTO v_member_team
      FROM public.team_members
     WHERE id = NEW.created_by_member_id;

    IF v_member_team IS NULL THEN
      RAISE EXCEPTION 'created_by_member_id % is not a valid team member', NEW.created_by_member_id;
    END IF;

    IF v_member_team IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'created_by_member_id must belong to the same team as the cart';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

create or replace function public.join_cart_as_member(p_cart_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_member_id uuid;
begin
  select team_id into v_team_id from public.meal_carts where id = p_cart_id;
  if v_team_id is null then
    raise exception 'Cart not found';
  end if;

  select tm.id into v_member_id
    from public.team_members tm
   where tm.team_id = v_team_id
     and tm.user_id = auth.uid()
   limit 1;

  if v_member_id is null then
    raise exception 'You are not a member of this team';
  end if;

  insert into public.meal_cart_members (cart_id, member_id)
  values (p_cart_id, v_member_id)
  on conflict (cart_id, member_id) do nothing;
end;
$$;

create or replace function public.join_cart_with_email(
  p_cart_id uuid,
  p_email   text
)
returns table (
  member_id uuid,
  full_name text,
  email     text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id   uuid;
  v_member_id uuid;
  v_full_name text;
  v_email     text;
begin
  select team_id into v_team_id
  from public.meal_carts
  where id = p_cart_id;

  if v_team_id is null then
    raise exception 'Cart not found';
  end if;

  select tm.id, tm.full_name, tm.email
    into v_member_id, v_full_name, v_email
  from public.team_members tm
  where tm.team_id = v_team_id
    and lower(trim(tm.email)) = lower(trim(p_email))
  limit 1;

  if v_member_id is null then
    raise exception 'No team member with that email on this team';
  end if;

  insert into public.meal_cart_members (cart_id, member_id, user_id)
  values (p_cart_id, v_member_id, auth.uid())
  on conflict on constraint meal_cart_members_cart_id_member_id_key do update
    set user_id = coalesce(public.meal_cart_members.user_id, excluded.user_id);

  member_id := v_member_id;
  full_name := v_full_name;
  email     := coalesce(v_email, p_email);
  return next;
end;
$$;


-- Enforce member/team consistency on meal_cart_items.
CREATE OR REPLACE FUNCTION public.tg_item_member_team_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_team uuid;
  v_member_team uuid;
BEGIN
  IF NEW.member_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT team_id INTO v_cart_team FROM public.meal_carts WHERE id = NEW.cart_id;
  IF v_cart_team IS NULL THEN
    RAISE EXCEPTION 'Cart % not found', NEW.cart_id;
  END IF;

  SELECT team_id INTO v_member_team FROM public.team_members WHERE id = NEW.member_id;
  IF v_member_team IS NULL THEN
    RAISE EXCEPTION 'Team member % not found', NEW.member_id;
  END IF;

  IF v_cart_team IS DISTINCT FROM v_member_team THEN
    RAISE EXCEPTION 'Assigned member must belong to the same team as the cart';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.is_team_member(UUID)    SET search_path = public;
ALTER FUNCTION public.is_team_admin(UUID)     SET search_path = public;
ALTER FUNCTION public.is_team_coach(UUID)     SET search_path = public;
ALTER FUNCTION public.handle_new_user_profile SET search_path = public;
ALTER FUNCTION public.ensure_created_by SET search_path = public;
ALTER FUNCTION public.set_updated_at     SET search_path = public;

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

DROP TRIGGER IF EXISTS trg_saved_trips_set_creator ON public.saved_trips;
CREATE TRIGGER trg_saved_trips_set_creator
BEFORE INSERT ON public.saved_trips
FOR EACH ROW EXECUTE FUNCTION public.ensure_created_by();

DROP TRIGGER IF EXISTS trg_saved_trips_updated_at ON public.saved_trips;
CREATE TRIGGER trg_saved_trips_updated_at
BEFORE UPDATE ON public.saved_trips
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_saved_locations_set_creator ON public.saved_locations;
CREATE TRIGGER trg_saved_locations_set_creator
BEFORE INSERT ON public.saved_locations
FOR EACH ROW EXECUTE FUNCTION public.ensure_created_by();

DROP TRIGGER IF EXISTS trg_saved_locations_updated_at ON public.saved_locations;
CREATE TRIGGER trg_saved_locations_updated_at
BEFORE UPDATE ON public.saved_locations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-fill created_by on insert
DROP TRIGGER IF EXISTS trg_order_events_set_created_by ON public.order_events;
CREATE TRIGGER trg_order_events_set_created_by
BEFORE INSERT ON public.order_events
FOR EACH ROW EXECUTE FUNCTION public.ensure_created_by();

DROP TRIGGER IF EXISTS trg_touch_meal_carts ON public.meal_carts;
CREATE TRIGGER trg_touch_meal_carts
BEFORE UPDATE ON public.meal_carts
FOR EACH ROW
EXECUTE FUNCTION public.tg_touch_meal_carts();

-- BEFORE trigger: set creator
drop trigger if exists trg_cart_set_creator on public.meal_carts;
create trigger trg_cart_set_creator
before insert on public.meal_carts
for each row execute function public.tg_cart_set_creator();

-- AFTER trigger: add membership (FK-safe)
drop trigger if exists trg_cart_auto_membership_after on public.meal_carts;
create trigger trg_cart_auto_membership_after
after insert on public.meal_carts
for each row execute function public.tg_cart_auto_membership_after();

DROP TRIGGER IF EXISTS trg_lock_item_owner ON public.meal_cart_items;
CREATE TRIGGER trg_lock_item_owner
BEFORE UPDATE ON public.meal_cart_items
FOR EACH ROW
EXECUTE FUNCTION public.tg_lock_item_owner();

DROP TRIGGER IF EXISTS trg_item_fill_owner ON public.meal_cart_items;
CREATE TRIGGER trg_item_fill_owner
BEFORE INSERT ON public.meal_cart_items
FOR EACH ROW
EXECUTE FUNCTION public.tg_item_fill_owner();

DROP TRIGGER IF EXISTS trg_validate_cart_creator_team_ins ON public.meal_carts;
CREATE TRIGGER trg_validate_cart_creator_team_ins
BEFORE INSERT ON public.meal_carts
FOR EACH ROW
EXECUTE FUNCTION public.tg_validate_cart_creator_team();

DROP TRIGGER IF EXISTS trg_validate_cart_creator_team_upd ON public.meal_carts;
CREATE TRIGGER trg_validate_cart_creator_team_upd
BEFORE UPDATE OF team_id, created_by_member_id ON public.meal_carts
FOR EACH ROW
EXECUTE FUNCTION public.tg_validate_cart_creator_team();

DROP TRIGGER IF EXISTS trg_item_member_team ON public.meal_cart_items;
CREATE TRIGGER trg_item_member_team
BEFORE INSERT OR UPDATE OF member_id, cart_id
ON public.meal_cart_items
FOR EACH ROW
EXECUTE FUNCTION public.tg_item_member_team_check();
