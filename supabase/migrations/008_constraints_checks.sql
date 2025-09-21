-- supabase/migrations/008_constraints_checks
ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS menu_items_api_id_key;
ALTER TABLE public.menu_items ADD CONSTRAINT uq_menu_items_restaurant_api UNIQUE (restaurant_id, api_id);
ALTER TABLE public.meal_order_items
  ADD CONSTRAINT ck_meal_order_items_qty_pos CHECK (quantity > 0),
  ADD CONSTRAINT ck_meal_order_items_price_nonneg CHECK (product_marked_price_cents IS NULL OR product_marked_price_cents >= 0);
ALTER TABLE public.meal_order_item_options
  ADD CONSTRAINT ck_meal_order_item_options_price_nonneg CHECK (price_cents >= 0),
  ADD CONSTRAINT ck_meal_order_item_options_qty_pos CHECK (quantity > 0);
ALTER TABLE public.poll_options
  ADD CONSTRAINT uq_poll_options_poll_id_id UNIQUE (poll_id, id);
ALTER TABLE public.poll_votes
  ADD CONSTRAINT fk_poll_votes_poll_option_pair
  FOREIGN KEY (poll_id, option_id)
  REFERENCES public.poll_options (poll_id, id)
  ON DELETE CASCADE;

ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_api_id_key;
ALTER TABLE public.restaurants ADD CONSTRAINT uq_restaurants_api UNIQUE (api_source, api_id);

ALTER TABLE public.meal_cart_items
  DROP CONSTRAINT IF EXISTS cart_items_cart_id_fkey,
  ADD CONSTRAINT cart_items_cart_id_fkey
    FOREIGN KEY (cart_id) REFERENCES public.meal_carts(id) ON DELETE CASCADE;

ALTER TABLE public.meal_cart_members
  ADD CONSTRAINT meal_cart_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.meal_cart_members
  ADD CONSTRAINT meal_cart_members_cart_id_member_id_key
  UNIQUE (cart_id, member_id);

ALTER TABLE public.meal_cart_item_assignees
  ADD CONSTRAINT ck_assignee_unit_qty_pos CHECK (unit_qty > 0);