-- supabase/migrations/009_mock_data
-- Mock Data
DO $$
DECLARE
  -- core ids
  coach_uuid          UUID := gen_random_uuid();
  team_uuid           UUID := gen_random_uuid();

  -- locations (use distinct ids!)
  loc_campus_uuid     UUID := gen_random_uuid();
  loc_office_uuid     UUID := gen_random_uuid();
  loc_hotel_uuid      UUID := gen_random_uuid();
  loc_sanmarcos_uuid  UUID := gen_random_uuid();

  -- restaurants & menu items
  pizza_rest_uuid     UUID := gen_random_uuid();
  pizza_item_uuid     UUID := gen_random_uuid();
  salad_item_uuid     UUID := gen_random_uuid();
  burger_rest_uuid    UUID := gen_random_uuid();
  burger_item_uuid    UUID := gen_random_uuid();

  -- payments (3 different forms)
  pm_team_uuid        UUID := gen_random_uuid();
  pm_pcard_uuid       UUID := gen_random_uuid();
  pm_booster_uuid     UUID := gen_random_uuid();

  -- orders
  completed_order_uuid UUID := gen_random_uuid();
  scheduled_order_uuid UUID := gen_random_uuid();
  this_week_order_1    UUID := gen_random_uuid();
  this_week_order_2    UUID := gen_random_uuid();
  pending_order_uuid   UUID := gen_random_uuid();
  cancelled_order_uuid UUID := gen_random_uuid();

  -- groups
  grp_players_uuid    UUID := gen_random_uuid();
  grp_coaches_uuid    UUID := gen_random_uuid();

  -- team_member row ids (explicit so we can reference them from order_items)
  coach_tm_id UUID := gen_random_uuid();
  tm_01 UUID := gen_random_uuid(); tm_02 UUID := gen_random_uuid(); tm_03 UUID := gen_random_uuid();
  tm_04 UUID := gen_random_uuid(); tm_05 UUID := gen_random_uuid(); tm_06 UUID := gen_random_uuid();
  tm_07 UUID := gen_random_uuid(); tm_08 UUID := gen_random_uuid(); tm_09 UUID := gen_random_uuid();
  tm_10 UUID := gen_random_uuid();

  -- other
  mo_item_1 UUID;
  cz_size UUID;
  cz_toppings UUID;

  coach_name  TEXT := 'Coach Johnson';
  coach_email TEXT := 'coach@team.edu';
BEGIN
  -- Seed auth user (note: this requires adequate privileges; in Supabase production prefer auth.create_user)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES (
    coach_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    coach_email, crypt('password123', gen_salt('bf', 10)), now(),
    now(), now(),
    jsonb_build_object('data', jsonb_build_object('firstName','Coach','lastName','Johnson','schoolName','University A','allergies',''), 'email', coach_email, 'email_verified', true, 'phone_verified', false),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_profiles (id, email, first_name, last_name, school_name, is_active)
  VALUES (coach_uuid, coach_email, 'Coach', 'Johnson', 'University A', true)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    school_name = EXCLUDED.school_name,
    updated_at = now();

  -- Team
  INSERT INTO public.teams (id, name, sport, conference_name, gender, coach_id)
  VALUES (team_uuid, 'Warriors', 'Basketball', 'PAC-12', 'womens', coach_uuid);

  -- Team members
  INSERT INTO public.team_members (id, team_id, user_id, role, full_name, email, phone_number, birthday)
  VALUES (coach_tm_id, team_uuid, coach_uuid, 'coach', coach_name, coach_email, '(408) 439-2894', '1980-09-03');

  INSERT INTO public.team_members (id, team_id, user_id, role, full_name, email, phone_number, birthday) VALUES
    (tm_01, team_uuid, NULL, 'player', 'Alex Smith',        'player+1@team.edu',  '(555) 100-0001', '2000-01-10'),
    (tm_02, team_uuid, NULL, 'player', 'Taylor Davis',      'player+2@team.edu',  '(555) 100-0002', '2000-02-10'),
    (tm_03, team_uuid, NULL, 'player', 'Jordan Lee',        'player+3@team.edu',  '(555) 100-0003', '2000-03-10'),
    (tm_04, team_uuid, NULL, 'player', 'Riley Chen',        'player+4@team.edu',  '(555) 100-0004', '2000-04-10'),
    (tm_05, team_uuid, NULL, 'player', 'Casey Nguyen',      'player+5@team.edu',  '(555) 100-0005', '2000-05-10'),
    (tm_06, team_uuid, NULL, 'player', 'Morgan Patel',      'player+6@team.edu',  '(555) 100-0006', '2000-06-10'),
    (tm_07, team_uuid, NULL, 'player', 'Samir Johnson',     'player+7@team.edu',  '(555) 100-0007', '2000-07-10'),
    (tm_08, team_uuid, NULL, 'player', 'Jamie Martinez',    'player+8@team.edu',  '(555) 100-0008', '2000-08-10'),
    (tm_09, team_uuid, NULL, 'player', 'Parker Thompson',   'player+9@team.edu',  '(555) 100-0009', '2000-09-10'),
    (tm_10, team_uuid, NULL, 'player', 'Avery Robinson',    'player+10@team.edu', '(555) 100-0010', '2000-10-10');

  -- Locations (distinct IDs)
  INSERT INTO public.saved_locations (id, team_id, name, address, location_type)
  VALUES (loc_campus_uuid,    team_uuid, 'Campus Gym',     '456 University Dr, Anytown, CA 90210', 'school'::public.location_type);

  INSERT INTO public.saved_locations (id, team_id, name, address, location_type)
  VALUES (loc_office_uuid,    team_uuid, 'Coaches Office', '50 College Dr, Anytown, CA 90210',     'school'::public.location_type);

  INSERT INTO public.saved_locations (id, team_id, name, address, location_type)
  VALUES (loc_hotel_uuid,     team_uuid, 'San Diego Hyatt','101 Hotel Dr, Anytown, CA 90210',      'school'::public.location_type);

  INSERT INTO public.saved_locations (id, team_id, name, address, location_type)
  VALUES (loc_sanmarcos_uuid, team_uuid, 'San Marcos Gym', '13 San Marcos Dr, Anytown, CA 90210',  'school'::public.location_type);

  -- API Integration
  INSERT INTO public.api_integrations (id, provider_name, api_key, base_url)
  VALUES (gen_random_uuid(), 'ubereats', 'YOUR_UBEREATS_API_KEY', 'https://api.ubereats.com');

  -- Restaurants (tie them to locations)
  INSERT INTO public.restaurants (
    id, location_id, name, cuisine_type, phone_number, is_favorite, supports_catering,
    api_id, api_source, address, image_url, rating, delivery_fee, minimum_order, is_available
  ) VALUES
    (pizza_rest_uuid,  loc_campus_uuid, 'Pizza Palace', 'Italian',  '(123) 456-7890', true,  true,  'ubereats_pizza_palace_123', 'ubereats', '789 Main St, Anytown, CA 90210', 'https://example.com/pizza_palace.jpg', 4.5, 2.99, 15.00, true),
    (burger_rest_uuid, loc_office_uuid, 'Burger Joint', 'American', '(987) 654-3210', false, false, 'ubereats_burger_joint_456', 'ubereats', '101 Oak Ave, Anytown, CA 90210', 'https://example.com/burger_joint.jpg',  4.2, 1.99, 10.00, true);

  -- Menu items
  INSERT INTO public.menu_items (id, restaurant_id, api_id, name, description, price, category, image_url, is_available, options_json) VALUES
    (pizza_item_uuid, pizza_rest_uuid,  'pizza_palace_margherita', 'Margherita Pizza', 'Classic Margherita with fresh basil', 15.99, 'Pizzas', 'https://example.com/margherita.jpg', true,
     '{"sizes":[{"name":"Small","price":13.99},{"name":"Medium","price":15.99},{"name":"Large","price":17.99}],"toppings":[{"name":"Pepperoni","price":2.00},{"name":"Mushrooms","price":1.50}]}'::jsonb),
    (salad_item_uuid, pizza_rest_uuid,  'pizza_palace_caesar_salad', 'Caesar Salad', 'Fresh Caesar salad with croutons', 12.01, 'Salads', 'https://example.com/caesar_salad.jpg', true,
     '{"dressings":[{"name":"Caesar"},{"name":"Ranch"}]}'::jsonb);

  INSERT INTO public.menu_items (id, restaurant_id, api_id, name, description, price, category, image_url, is_available)
  VALUES (burger_item_uuid, burger_rest_uuid, 'burger_joint_classic', 'Classic Cheeseburger', 'Classic cheeseburger with fries', 14.50, 'Burgers', 'https://example.com/classic_burger.jpg', true);

  -- Payment methods (3 different forms)
  INSERT INTO public.payment_methods (id, team_id, card_name, last_four, is_default, created_by) VALUES
    (pm_team_uuid,    team_uuid, 'Team Card - Basketball', '4242', true,  coach_uuid),
    (pm_pcard_uuid,   team_uuid, 'Head Coach Card',        '1881', false, coach_uuid),
    (pm_booster_uuid, team_uuid, 'Athletic Dept Visa',     '0099', false, coach_uuid);

  -- ================
  -- ORDERS (6 total)
  -- ================

  -- 1) COMPLETED, delivery, lunch — Team Card, Coaches Office
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, location_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    delivery_instructions, estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount
  ) VALUES (
    completed_order_uuid, team_uuid, pizza_rest_uuid, loc_office_uuid,
    'Team Lunch - Last Week', 'Post-game meal for the team (completed)', 'lunch'::public.meal_type,
    NOW() - INTERVAL '4 days', 'completed', pm_team_uuid, 'completed', coach_uuid,
    'UBEREATS-ORDER-XYZ789', 'ubereats', 'delivery',
    '50 College Dr', 'Anytown', 'CA', '90210',
    'Leave at front desk with security', NOW() - INTERVAL '3 days 1 hour',
    4599, 299, 150, 0, 414,
    5462, 800, 6262, 800, 0,
    2.99, 1.50, 62.62
  );

  INSERT INTO public.order_items (order_id, team_member_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options) VALUES
    (completed_order_uuid, tm_01, pizza_item_uuid, 'Margherita Pizza', 1, 15.99, 'No olives',  '{"size":"Medium","toppings":["Pepperoni"]}'::jsonb),
    (completed_order_uuid, tm_02, pizza_item_uuid, 'BBQ Chicken Pizza', 1, 17.99, 'Extra cheese', '{"size":"Large","toppings":["Extra Cheese"]}'::jsonb),
    (completed_order_uuid, coach_tm_id, salad_item_uuid, 'Caesar Salad', 1, 12.01, 'Side of ranch', '{"dressing":"Ranch"}'::jsonb);

  -- Example snapshot rows
  INSERT INTO public.meal_order_items (order_id, product_id, name, description, image_url, notes, quantity, product_marked_price_cents)
  VALUES (completed_order_uuid,'pizza_palace_margherita','Margherita Pizza','Medium',NULL,'No olives',1,1599) RETURNING id INTO mo_item_1;

  INSERT INTO public.meal_order_item_customizations (order_item_id, name) VALUES (mo_item_1, 'Size') RETURNING id INTO cz_size;
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  VALUES (cz_size, 'size_medium', 'Medium', 0, 1, '{}'::jsonb);

  INSERT INTO public.meal_order_item_customizations (order_item_id, name) VALUES (mo_item_1, 'Toppings') RETURNING id INTO cz_toppings;
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  VALUES (cz_toppings, 'top_pepperoni', 'Pepperoni', 200, 1, '{}'::jsonb);

  -- 2) SCHEDULED, delivery, dinner — Head Coach Card, Hotel
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, location_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount
  ) VALUES (
    scheduled_order_uuid, team_uuid, burger_rest_uuid, loc_hotel_uuid,
    'Team Dinner - Next Week', 'Weekly team dinner for practice', 'dinner'::public.meal_type,
    NOW() + INTERVAL '7 days', 'scheduled', pm_pcard_uuid, 'pending', coach_uuid,
    'UBEREATS-ORDER-ABC123', 'ubereats', 'delivery',
    '101 Hotel Dr', 'Anytown', 'CA', '90210',
    NOW() + INTERVAL '7 days 2 hours',
    8700, 350, 200, 0, 725,
    9975, 1200, 11175, 1200, 0,
    3.50, 2.00, 111.75
  );

  INSERT INTO public.order_items (order_id, team_member_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options) VALUES
    (scheduled_order_uuid, tm_01, burger_item_uuid, 'Classic Cheeseburger', 2, 14.50, 'No pickles',  '{"buns":"sesame","cheese":"cheddar"}'::jsonb),
    (scheduled_order_uuid, tm_02, burger_item_uuid, 'Hamburger', 1, 13.50, 'Extra onion rings', '{"buns":"brioche"}'::jsonb),
    (scheduled_order_uuid, tm_03, burger_item_uuid, 'BLT Sandwich', 1, 10.50, NULL, '{"buns":"brioche"}'::jsonb),
    (scheduled_order_uuid, tm_04, burger_item_uuid, 'Classic Cheeseburger', 1, 14.50, NULL, '{"buns":"sesame"}'::jsonb),
    (scheduled_order_uuid, tm_05, burger_item_uuid, 'House Hamburger', 1, 15.50, NULL, '{"buns":"sesame"}'::jsonb);

  -- 3) THIS WEEK #1, delivery, lunch — Booster Visa, San Marcos Gym
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, location_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    delivery_instructions, estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount
  ) VALUES (
    this_week_order_1, team_uuid, pizza_rest_uuid, loc_sanmarcos_uuid,
    'Film Session Lunch', 'Lunch during film session', 'lunch'::public.meal_type,
    NOW() + INTERVAL '1 day', 'scheduled', pm_booster_uuid, 'pending', coach_uuid,
    'UBEREATS-ORDER-THISWEEK-1', 'ubereats', 'delivery',
    '13 San Marcos', 'Anytown', 'CA', '90210',
    'Call when arriving', NOW() + INTERVAL '1 day 90 minutes',
    6801, 299, 150, 0, 612,
    7862, 1000, 8862, 1000, 0,
    2.99, 1.50, 88.62
  );

  INSERT INTO public.order_items (order_id, team_member_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options) VALUES
    (this_week_order_1, tm_06, pizza_item_uuid, 'Burger Special', 2, 15.99, 'Well done',  '{"size":"Medium"}'::jsonb),
    (this_week_order_1, coach_tm_id, salad_item_uuid, 'Caesar Salad', 1, 12.01, 'Dressing on side', '{"dressing":"Caesar"}'::jsonb),
    (this_week_order_1, tm_07, salad_item_uuid, 'House Salad', 2, 13.01, NULL, '{"dressing":"Caesar"}'::jsonb);

  -- 4) THIS WEEK #2, pickup, snack — Head Coach Card, Campus Gym
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, location_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount
  ) VALUES (
    this_week_order_2, team_uuid, burger_rest_uuid, loc_campus_uuid,
    'Shootaround Snacks', 'Pre-practice snacks', 'snack'::public.meal_type,
    NOW() + INTERVAL '3 days', 'scheduled', pm_pcard_uuid, 'pending', coach_uuid,
    'UBEREATS-ORDER-THISWEEK-2', 'ubereats', 'pickup',
    '456 University Dr', 'Anytown', 'CA', '90210',
    NOW() + INTERVAL '3 days 2 hours',
    7250, 0, 100, 0, 653,
    8003, 700, 8703, 0, 700,
    0, 1.00, 87.03
  );

  INSERT INTO public.order_items (order_id, team_member_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options) VALUES
    (this_week_order_2, tm_08, burger_item_uuid, 'Classic Cheeseburger', 3, 14.50, 'No pickles',  '{"buns":"sesame"}'::jsonb),
    (this_week_order_2, tm_09, burger_item_uuid, 'BLT Cheeseburger', 1, 14.50, NULL,          '{"buns":"sesame"}'::jsonb),
    (this_week_order_2, tm_10, burger_item_uuid, 'Hamburger', 1, 14.50, NULL,                  '{"buns":"brioche"}'::jsonb);

  -- 5) PENDING CONFIRMATION, delivery, lunch — Team Card, Campus Gym
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, location_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount
  ) VALUES (
    pending_order_uuid, team_uuid, pizza_rest_uuid, loc_campus_uuid,
    'Film Breakdown Lunch', 'Lunch – sandwiches & salads (pending confirmation)', 'lunch'::public.meal_type,
    NOW() + INTERVAL '2 days', 'pending_confirmation', pm_team_uuid, 'pending', coach_uuid,
    'UBEREATS-ORDER-PEND-001', 'ubereats', 'delivery',
    '456 University Dr', 'Anytown', 'CA', '90210',
    NOW() + INTERVAL '2 days 90 minutes',
    6398, 299, 150, 0, 600,
    7447, 800, 8247, 800, 0,
    2.99, 1.50, 82.47
  );

  INSERT INTO public.order_items (order_id, team_member_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options) VALUES
    (pending_order_uuid, tm_08, pizza_item_uuid,  'Margherita Pizza', 1, 15.99, 'No olives',     '{"size":"Medium"}'::jsonb),
    (pending_order_uuid, tm_09, salad_item_uuid,  'Caesar Salad',     1, 12.01, 'Light dressing','{"dressing":"Caesar"}'::jsonb),
    (pending_order_uuid, tm_10, pizza_item_uuid,  'Margherita Pizza', 2, 17.99, 'Extra basil',   '{"size":"Large"}'::jsonb);

  -- 6) CANCELLED, pickup, dinner — Booster Visa, Coaches Office
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, location_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount
  ) VALUES (
    cancelled_order_uuid, team_uuid, burger_rest_uuid, loc_office_uuid,
    'Road Trip Dinner - Canceled', 'Bus delayed; canceled order', 'dinner'::public.meal_type,
    NOW() - INTERVAL '1 day', 'cancelled', pm_booster_uuid, 'voided', coach_uuid,
    'UBEREATS-ORDER-CAN-001', 'ubereats', 'pickup',
    '101 Oak Ave', 'Anytown', 'CA', '90210',
    NOW() - INTERVAL '1 day 30 minutes',
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0
  );

  INSERT INTO public.order_items (order_id, team_member_id, menu_item_id, item_name, quantity, price)
  VALUES (cancelled_order_uuid, coach_tm_id, burger_item_uuid, 'Classic Cheeseburger', 1, 14.50);

  -- Addresses for the Campus Gym (example)
  INSERT INTO public.location_addresses (location_id, name, address, address_type, is_primary, notes) VALUES
    (loc_campus_uuid, 'Main Entrance',   '123 School Ave - Main Building', 'school'::public.location_type, true,  'Primary delivery entrance with security desk'),
    (loc_campus_uuid, 'Athletic Center', '123 School Ave - Athletic Wing', 'gym'::public.location_type,    false, 'Delivery through gym entrance during events'),
    (loc_campus_uuid, 'Student Union',   '123 School Ave - Student Center','venue'::public.location_type,  false, 'Catering deliveries to main desk');

EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'Foreign key error: %', SQLERRM;
  WHEN unique_violation THEN
    RAISE NOTICE 'Unique constraint error: %', SQLERRM;
  WHEN OTHERS THEN
    RAISE NOTICE 'Unexpected error: %', SQLERRM;
END $$;