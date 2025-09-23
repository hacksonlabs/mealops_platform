-- supabase/migrations/003_indexes_and_uniques
-- Essential Indexes
CREATE INDEX idx_teams_coach_id ON public.teams(coach_id);
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_members_team_id_active ON public.team_members(team_id, is_active);
CREATE INDEX idx_team_members_team_user_role ON public.team_members(team_id, user_id, role);

-- Restaurants indexes
CREATE INDEX idx_restaurants_name ON public.restaurants(name);
CREATE INDEX idx_restaurants_api_source ON public.restaurants(api_source);
CREATE INDEX idx_restaurants_api ON public.restaurants (api_source, api_id);

-- menu_items indexes
create index idx_meal_orders_restaurant_id      on public.meal_orders(restaurant_id);
create index idx_meal_orders_restaurant_team    on public.meal_orders(restaurant_id, team_id);
CREATE INDEX idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);
CREATE INDEX idx_meal_orders_team_id ON public.meal_orders(team_id);
CREATE INDEX idx_meal_orders_scheduled_date ON public.meal_orders(scheduled_date);
CREATE INDEX idx_meal_orders_status ON public.meal_orders(order_status);
CREATE INDEX idx_meal_orders_api_order_id ON public.meal_orders(api_order_id);
CREATE INDEX idx_meal_orders_api_source_quote ON public.meal_orders(api_source, api_quote_id);
CREATE INDEX meal_orders_team_id_scheduled_date_idx ON public.meal_orders(team_id, scheduled_date DESC);

-- normalized item tables indexes
CREATE INDEX idx_meal_order_items_order_id ON public.meal_order_items(order_id);
CREATE INDEX idx_meal_order_items_is_extra ON public.meal_order_items(is_extra);
CREATE INDEX idx_meal_order_item_customizations_item_id ON public.meal_order_item_customizations(order_item_id);
CREATE INDEX idx_meal_order_item_options_customization_id ON public.meal_order_item_options(customization_id);

CREATE INDEX idx_meal_polls_team_id ON public.meal_polls(team_id);
CREATE INDEX idx_meal_polls_status ON public.meal_polls(poll_status);
CREATE INDEX idx_poll_votes_poll_id ON public.poll_votes(poll_id);
CREATE INDEX idx_payment_methods_team_id ON public.payment_methods(team_id);
CREATE UNIQUE INDEX uniq_team_member_email_per_team ON public.team_members (team_id, lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_member_groups_team_name ON public.member_groups (team_id, lower(name));
CREATE INDEX idx_member_groups_team_id ON public.member_groups(team_id);
CREATE INDEX idx_member_groups_created_by ON public.member_groups(created_by);

CREATE INDEX IF NOT EXISTS idx_mgm_group_id  ON public.member_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_mgm_member_id ON public.member_group_members(member_id);

CREATE INDEX notifications_team_id_created_at_idx ON public.notifications(team_id, created_at desc);

CREATE INDEX IF NOT EXISTS idx_meal_orders_cancel_requested_at
  ON public.meal_orders(cancel_requested_at);
CREATE INDEX IF NOT EXISTS idx_meal_orders_cancel_states
  ON public.meal_orders(order_status)
  WHERE order_status IN ('cancellation_requested','cancelled','cancel_failed');
CREATE INDEX IF NOT EXISTS idx_meal_orders_provider
  ON public.meal_orders(api_source, api_order_id);

CREATE INDEX IF NOT EXISTS idx_order_events_order_created
  ON public.order_events(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meal_carts_team ON public.meal_carts(team_id);
CREATE INDEX IF NOT EXISTS idx_meal_carts_restaurant ON public.meal_carts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_meal_carts_status ON public.meal_carts(status);

CREATE INDEX IF NOT EXISTS idx_cart_members_by_member ON public.meal_cart_members(member_id);
create index if not exists idx_meal_cart_members_cart_id on public.meal_cart_members(cart_id);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.meal_cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_member ON public.meal_cart_items(added_by_member_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cart_item_member
  ON public.meal_cart_item_assignees (cart_item_id, member_id)
  WHERE is_extra = false;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cart_item_extra
  ON public.meal_cart_item_assignees (cart_item_id)
  WHERE is_extra = true;
  
-- prevent duplicate member assignment to same item
CREATE UNIQUE INDEX IF NOT EXISTS uq_item_assignee_member
  ON public.meal_cart_item_assignees(cart_item_id, member_id)
  WHERE member_id IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_item_assignees_item ON public.meal_cart_item_assignees(cart_item_id);
