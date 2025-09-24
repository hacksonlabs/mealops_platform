-- supabase/migrations/010_receipts.sql
-- Receipt RPC + helper view (uses existing RLS; no bypass)

create or replace function public.get_order_receipt(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  -- RLS/ownership gate
  if not exists (
    select 1
    from public.meal_orders mo
    where mo.id = p_order_id
      and (
        public.is_team_member(mo.team_id)
        or public.is_team_coach(mo.team_id)
        or public.is_team_admin(mo.team_id)
        or mo.created_by = auth.uid()
      )
  ) then
    raise exception 'permission denied for receipt';
  end if;

  with ob as (
    select
      mo.*,
      coalesce(mo.api_order_id, 'ORD-'||substr(mo.id::text,1,8)) as order_number,
      t.name  as team_name,
      t.sport as sport,
      t.gender as gender,
      r.name  as restaurant_name,
      r.address as restaurant_address,
      pm.card_name,
      pm.last_four,
      up.first_name as placed_by_first_name,
      up.last_name  as placed_by_last_name,
      up.email      as placed_by_email,
      up.phone      as placed_by_phone,
      up.school_name as placed_by_school_name
    from public.meal_orders mo
    left join public.teams t            on t.id = mo.team_id
    left join public.restaurants r      on r.id = mo.restaurant_id
    left join public.payment_methods pm on pm.id = mo.payment_method_id
    left join public.user_profiles up   on up.id = mo.created_by
    where mo.id = p_order_id
  ),

  -- ---------- TYPED ITEMS (normalized path) ----------
  moi_opts as (
    select
      c.order_item_id,
      jsonb_agg(
        jsonb_build_object(
          'name',        io.name,
          'option_id',   io.option_id,
          'quantity',    io.quantity,
          'price_cents', coalesce(io.price_cents,0)
        )
        order by io.name
      ) as options_json,
      coalesce(sum(coalesce(io.price_cents,0) * io.quantity),0)::int as options_total_cents
    from public.meal_order_item_customizations c
    join public.meal_order_item_options io on io.customization_id = c.id
    where c.order_item_id in (select id from public.meal_order_items where order_id = p_order_id)
    group by c.order_item_id
  ),
  li_moi as (
    select
      i.id,
      i.name,
      greatest(i.quantity,1) as quantity,
      coalesce(i.product_marked_price_cents,0)::int as base_price_cents,
      coalesce(o.options_total_cents,0)::int as options_total_cents,
      (coalesce(i.product_marked_price_cents,0) + coalesce(o.options_total_cents,0))::int as unit_price_cents,
      ((coalesce(i.product_marked_price_cents,0) + coalesce(o.options_total_cents,0)) * greatest(i.quantity,1))::int as line_total_cents,
      coalesce(o.options_json, '[]'::jsonb) as options
    from public.meal_order_items i
    left join moi_opts o on o.order_item_id = i.id
    where i.order_id = p_order_id
  ),

  lines as (
    select * from li_moi
  ),
  tot as (
    select coalesce(sum(line_total_cents),0)::int as computed_subtotal_cents
    from lines
  ),
  fees as (
    select
      ob.*,
      (select computed_subtotal_cents from tot) as computed_subtotal_cents,
      floor(
        coalesce((select computed_subtotal_cents from tot),0)
        * coalesce(ob.added_fee_percent_bps,0) / 10000.0
      )::int as added_fee_percent_amount_cents
    from ob
  )
  select jsonb_build_object(
    'order_id', f.id,
    'order_number', f.order_number,
    'title', f.title,
    'team', f.team_name,
    'sport', f.sport,
    'gender', f.gender,
    'restaurant', jsonb_strip_nulls(jsonb_build_object(
      'name', f.restaurant_name,
      'address', f.restaurant_address
    )),
    'status', f.order_status,
    'scheduled_for', f.scheduled_date,
    'fulfillment_method', f.fulfillment_method,
    'delivery_address',
      case when f.fulfillment_method = 'delivery' then
        jsonb_strip_nulls(jsonb_build_object(
          'line1', f.delivery_address_line1,
          'line2', f.delivery_address_line2,
          'city',  f.delivery_city,
          'state', f.delivery_state,
          'zip',   f.delivery_zip,
          'instructions', f.delivery_instructions
        ))
      else null end,
    'placed_by', jsonb_strip_nulls(jsonb_build_object(
      'first_name', f.placed_by_first_name,
      'last_name',  f.placed_by_last_name,
      'email',      f.placed_by_email,
      'phone',      f.placed_by_phone,
      'school_name', f.placed_by_school_name
    )),
    'payment', jsonb_strip_nulls(jsonb_build_object(
      'card_name', f.card_name,
      'last_four', f.last_four,
      'currency', f.currency_code,
      'payment_status', f.payment_status
    )),
    'items', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'name', l.name,
          'quantity', l.quantity,
          'base_price_cents', l.base_price_cents,
          'options_total_cents', l.options_total_cents,
          'unit_price_cents', l.unit_price_cents,
          'line_total_cents', l.line_total_cents,
          'options', l.options
        ) order by l.name)
       from lines l),
      '[]'::jsonb
    ),
    'fees', jsonb_strip_nulls(jsonb_build_object(
      'delivery_fee_cents', f.delivery_fee_cents,
      'service_fee_cents',  f.service_fee_cents,
      'small_order_fee_cents', f.small_order_fee_cents,
      'sales_tax_cents',    f.sales_tax_cents,
      'added_fee_flat_cents', f.added_fee_flat_cents,
      'added_fee_percent_bps', f.added_fee_percent_bps,
      'added_fee_percent_amount_cents', f.added_fee_percent_amount_cents
    )),
    'tips', jsonb_strip_nulls(jsonb_build_object(
      'driver_tip_cents', f.driver_tip_cents,
      'pickup_tip_cents', f.pickup_tip_cents
    )),
    'totals', jsonb_build_object(
      -- Subtotal from normalized line items
      'subtotal_cents', (select computed_subtotal_cents from tot),
      'total_without_tips_cents',
          (select computed_subtotal_cents from tot)
        + coalesce(f.delivery_fee_cents,0)
        + coalesce(f.service_fee_cents,0)
        + coalesce(f.small_order_fee_cents,0)
        + coalesce(f.sales_tax_cents,0)
        + coalesce(f.added_fee_flat_cents,0)
        + coalesce(f.added_fee_percent_amount_cents,0),
      'tip_cents',    coalesce(f.tip_cents,0),
      'total_with_tip_cents',
          ( (select computed_subtotal_cents from tot)
            + coalesce(f.delivery_fee_cents,0)
            + coalesce(f.service_fee_cents,0)
            + coalesce(f.small_order_fee_cents,0)
            + coalesce(f.sales_tax_cents,0)
            + coalesce(f.added_fee_flat_cents,0)
            + coalesce(f.added_fee_percent_amount_cents,0)
          )
          + coalesce(f.tip_cents,0)
    ),
    'split', CASE
      WHEN split_meta.total_children > 0 AND f.is_split_child THEN
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'child',
          'position', coalesce(split_meta.child_position, 1),
          'total', split_meta.total_children
        ))
      WHEN split_meta.total_children > 0 THEN
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'parent',
          'total', split_meta.total_children
        ))
      ELSE NULL::jsonb
    END,
    'timestamps', jsonb_strip_nulls(jsonb_build_object(
      'created_at', f.created_at,
      'updated_at', f.updated_at,
      'estimated_delivery_at', f.estimated_delivery_at,
      'expected_arrival_at',   f.expected_arrival_at,
      'actual_delivery_at',    f.actual_delivery_at
    )),
    'links', jsonb_strip_nulls(jsonb_build_object(
      'tracking', f.tracking_link
    ))
  )
  into result
  from fees f
  left join lateral (
    select
      (
        select count(*)::int
        from public.meal_order_splits s
        where s.parent_order_id = coalesce(f.parent_order_id, f.id)
      ) as total_children,
      CASE
        WHEN f.is_split_child THEN
          coalesce(
            ((regexp_match(f.title, 'Part\s+(\d+)'))[1])::int,
            (
              select ranked.rn
              from (
                select s.child_order_id,
                       row_number() over (order by s.created_at, s.child_order_id) as rn
                from public.meal_order_splits s
                where s.parent_order_id = f.parent_order_id
              ) ranked
              where ranked.child_order_id = f.id
            )
          )
        ELSE NULL
      END as child_position
  ) split_meta on true;

  return result;
end;
$$;

grant execute on function public.get_order_receipt(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Flat line-item view (CSV/admin)
-- Only normalized items (meal_order_items). No legacy fallback.
create or replace view public.v_order_receipt_lines
WITH (security_invoker = true) AS
select
  mo.id as order_id,
  mo.title,
  mo.order_status,
  mo.payment_status,
  mo.currency_code,
  t.name as team_name,
  r.name as restaurant_name,
  i.name as item_name,
  greatest(i.quantity,1) as quantity,
  coalesce(i.product_marked_price_cents,0)::int as base_price_cents,
  coalesce(sum(io.price_cents * io.quantity),0)::int as options_total_cents,
  (coalesce(i.product_marked_price_cents,0)
    + coalesce(sum(io.price_cents * io.quantity),0))::int as unit_price_cents,
  ((coalesce(i.product_marked_price_cents,0)
    + coalesce(sum(io.price_cents * io.quantity),0)) * greatest(i.quantity,1))::int as line_total_cents,
  i.created_at as item_created_at
from public.meal_orders mo
join public.meal_order_items i on i.order_id = mo.id
left join public.meal_order_item_customizations c on c.order_item_id = i.id
left join public.meal_order_item_options io on io.customization_id = c.id
left join public.teams t on t.id = mo.team_id
left join public.restaurants r on r.id = mo.restaurant_id
group by mo.id, mo.title, mo.order_status, mo.payment_status, mo.currency_code,
         t.name, r.name, i.id;

-- Helpful index for options rollups
create index if not exists idx_meal_order_item_options_customization_id_qty
  on public.meal_order_item_options(customization_id, quantity);
