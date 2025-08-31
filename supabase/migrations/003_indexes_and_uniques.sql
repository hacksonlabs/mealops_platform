-- supabase/migrations/003_indexes_and_uniques
-- Essential Indexes
CREATE INDEX idx_teams_coach_id ON public.teams(coach_id);
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_members_team_id_active ON public.team_members(team_id, is_active);
CREATE INDEX idx_saved_locations_team_id ON public.saved_locations(team_id);
CREATE INDEX idx_team_members_team_user_role ON public.team_members(team_id, user_id, role);

-- Restaurants indexes
CREATE INDEX idx_restaurants_name ON public.restaurants(name);
CREATE INDEX idx_restaurants_location_id ON public.restaurants(location_id);
CREATE INDEX idx_restaurants_api_source ON public.restaurants(api_source);
CREATE INDEX idx_restaurants_api ON public.restaurants (api_source, api_id);

-- menu_items indexes
CREATE INDEX idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);

CREATE INDEX idx_meal_orders_team_id ON public.meal_orders(team_id);
CREATE INDEX idx_meal_orders_scheduled_date ON public.meal_orders(scheduled_date);
CREATE INDEX idx_meal_orders_status ON public.meal_orders(order_status);
CREATE INDEX idx_meal_orders_api_order_id ON public.meal_orders(api_order_id);
CREATE INDEX idx_meal_orders_api_source_quote ON public.meal_orders(api_source, api_quote_id);
CREATE INDEX meal_orders_team_id_scheduled_date_idx ON public.meal_orders(team_id, scheduled_date DESC);

-- normalized item tables indexes
CREATE INDEX idx_meal_order_items_order_id ON public.meal_order_items(order_id);
CREATE INDEX idx_meal_order_item_customizations_item_id ON public.meal_order_item_customizations(order_item_id);
CREATE INDEX idx_meal_order_item_options_customization_id ON public.meal_order_item_options(customization_id);

-- order_items indexes
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_user_id ON public.order_items(user_id);
CREATE INDEX idx_order_items_menu_item_id ON public.order_items(menu_item_id);
CREATE INDEX idx_order_items_order_user ON public.order_items(order_id, user_id);
CREATE INDEX idx_order_items_team_member_id ON public.order_items(team_member_id);
CREATE INDEX order_items_order_id_idx ON public.order_items(order_id);

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

CREATE INDEX idx_location_addresses_location_id ON public.location_addresses(location_id);
CREATE INDEX idx_location_addresses_address_type ON public.location_addresses(address_type);
CREATE INDEX idx_location_addresses_is_primary ON public.location_addresses(is_primary);

CREATE INDEX notifications_team_id_created_at_idx ON public.notifications(team_id, created_at desc);

