-- supabase/migrations/009_mock_data.sql
-- Mock data (no saved_locations / no location_id / no order_items)
DO $$
DECLARE
  -- core ids
  coach_uuid          UUID := gen_random_uuid();
  team_uuid           UUID := gen_random_uuid();

  -- restaurants (10)
  pizza_rest_uuid     UUID := gen_random_uuid();
  burger_rest_uuid    UUID := gen_random_uuid();
  taco_rest_uuid      UUID := gen_random_uuid();
  sushi_rest_uuid     UUID := gen_random_uuid();
  thai_rest_uuid      UUID := gen_random_uuid();
  med_rest_uuid       UUID := gen_random_uuid();
  salad_rest_uuid     UUID := gen_random_uuid();
  bagel_rest_uuid     UUID := gen_random_uuid();
  bbq_rest_uuid       UUID := gen_random_uuid();
  vegan_rest_uuid     UUID := gen_random_uuid();

  -- menu items (at least one per restaurant)
  pizza_margh_uuid    UUID := gen_random_uuid();
  pizza_bbq_uuid      UUID := gen_random_uuid();
  burger_classic_uuid UUID := gen_random_uuid();
  burger_house_uuid   UUID := gen_random_uuid();
  taco_alpast_uuid    UUID := gen_random_uuid();
  taco_carnitas_uuid  UUID := gen_random_uuid();
  sushi_combo_uuid    UUID := gen_random_uuid();
  sushi_spicy_uuid    UUID := gen_random_uuid();
  thai_padthai_uuid   UUID := gen_random_uuid();
  thai_green_uuid     UUID := gen_random_uuid();
  med_shawarma_uuid   UUID := gen_random_uuid();
  med_falafel_uuid    UUID := gen_random_uuid();
  salad_cobb_uuid     UUID := gen_random_uuid();
  salad_bowl_uuid     UUID := gen_random_uuid();
  bagel_lox_uuid      UUID := gen_random_uuid();
  bagel_bfast_uuid    UUID := gen_random_uuid();
  bbq_brisket_uuid    UUID := gen_random_uuid();
  bbq_ribs_uuid       UUID := gen_random_uuid();
  vegan_bowl_uuid     UUID := gen_random_uuid();
  vegan_wrap_uuid     UUID := gen_random_uuid();

  -- payments
  pm_team_uuid        UUID := gen_random_uuid();
  pm_pcard_uuid       UUID := gen_random_uuid();
  pm_booster_uuid     UUID := gen_random_uuid();

  -- orders (8 total)
  comp1_uuid          UUID := gen_random_uuid(); -- completed (last week)
  comp2_uuid          UUID := gen_random_uuid(); -- completed (last week)
  sched1_uuid         UUID := gen_random_uuid(); -- next week
  sched2_uuid         UUID := gen_random_uuid(); -- next week
  sched3_uuid         UUID := gen_random_uuid(); -- next week
  sched4_uuid         UUID := gen_random_uuid(); -- next week
  cancel1_uuid        UUID := gen_random_uuid(); -- canceled
  cancel2_uuid        UUID := gen_random_uuid(); -- canceled

  -- team members (coach + 12 players = 13)
  coach_tm_id UUID := gen_random_uuid();
  tm_01 UUID := gen_random_uuid(); tm_02 UUID := gen_random_uuid(); tm_03 UUID := gen_random_uuid();
  tm_04 UUID := gen_random_uuid(); tm_05 UUID := gen_random_uuid(); tm_06 UUID := gen_random_uuid();
  tm_07 UUID := gen_random_uuid(); tm_08 UUID := gen_random_uuid(); tm_09 UUID := gen_random_uuid();
  tm_10 UUID := gen_random_uuid(); tm_11 UUID := gen_random_uuid(); tm_12 UUID := gen_random_uuid();

  -- a couple of customization ids (illustrative)
  cust_a UUID; cust_b UUID; cust_c UUID;

  coach_name  TEXT := 'Coach Johnson';
  coach_email TEXT := 'coach@team.edu';
BEGIN
  -- Seed auth user (simple local dev)
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
    jsonb_build_object(
      'data', jsonb_build_object('firstName','Coach','lastName','Johnson','schoolName','University A','allergies',''),
      'email', coach_email, 'email_verified', true, 'phone_verified', false
    ),
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

  -- Team + members
  INSERT INTO public.teams (id, name, sport, conference_name, gender, coach_id)
  VALUES (team_uuid, 'Warriors', 'Basketball', 'PAC-12', 'womens', coach_uuid);

  INSERT INTO public.team_members (id, team_id, user_id, role, full_name, email, phone_number, birthday)
  VALUES (coach_tm_id, team_uuid, coach_uuid, 'coach', coach_name, coach_email, '(408) 439-2894', '1980-09-03');

  INSERT INTO public.team_members (id, team_id, user_id, role, full_name, email, phone_number, birthday) VALUES
    (tm_01, team_uuid, NULL, 'player', 'Alex Smith',       'player+1@team.edu',  '(555) 100-0001', '2000-01-10'),
    (tm_02, team_uuid, NULL, 'player', 'Taylor Davis',     'player+2@team.edu',  '(555) 100-0002', '2000-02-10'),
    (tm_03, team_uuid, NULL, 'player', 'Jordan Lee',       'player+3@team.edu',  '(555) 100-0003', '2000-03-10'),
    (tm_04, team_uuid, NULL, 'player', 'Riley Chen',       'player+4@team.edu',  '(555) 100-0004', '2000-04-10'),
    (tm_05, team_uuid, NULL, 'player', 'Casey Nguyen',     'player+5@team.edu',  '(555) 100-0005', '2000-05-10'),
    (tm_06, team_uuid, NULL, 'player', 'Morgan Patel',     'player+6@team.edu',  '(555) 100-0006', '2000-06-10'),
    (tm_07, team_uuid, NULL, 'player', 'Samir Johnson',    'player+7@team.edu',  '(555) 100-0007', '2000-07-10'),
    (tm_08, team_uuid, NULL, 'player', 'Jamie Martinez',   'player+8@team.edu',  '(555) 100-0008', '2000-08-10'),
    (tm_09, team_uuid, NULL, 'player', 'Parker Thompson',  'player+9@team.edu',  '(555) 100-0009', '2000-09-10'),
    (tm_10, team_uuid, NULL, 'player', 'Avery Robinson',   'player+10@team.edu', '(555) 100-0010', '2000-10-10'),
    (tm_11, team_uuid, NULL, 'player', 'Dakota Williams',  'player+11@team.edu', '(555) 100-0011', '2000-11-10'),
    (tm_12, team_uuid, NULL, 'player', 'Charlie Hernandez','player+12@team.edu', '(555) 100-0012', '2000-12-10');

  -- API Integration
  INSERT INTO public.api_integrations (id, provider_name, api_key, base_url)
  VALUES (gen_random_uuid(), 'ubereats', 'YOUR_UBEREATS_API_KEY', 'https://api.ubereats.com')
  ON CONFLICT DO NOTHING;

  -- Restaurants (no location_id column in schema)
  INSERT INTO public.restaurants (
    id, name, cuisine_type, phone_number, is_favorite, supports_catering,
    api_id, api_source, address, image_url, rating, delivery_fee, minimum_order,
    is_available, supported_providers, provider_restaurant_ids
  ) VALUES
    (pizza_rest_uuid,  'Pizza Palace',        'Italian',      '(123) 456-7890', true,  true,  'pizza_palace_123',          'ubereats',
      '1325 Sunnyvale Saratoga Rd, Sunnyvale, CA 94087',
      'https://images.pexels.com/photos/1146760/pexels-photo-1146760.jpeg', 4.5, 299, 1500, true, ARRAY['grubhub','ubereats','doordash'],
      jsonb_build_object('grubhub','gh_pizza_palace_123','ubereats','pizza_palace_123','doordash','dd_pizza_palace_123')),
    (burger_rest_uuid, 'Burger Joint',        'American',     '(987) 654-3210', false, false, 'burger_joint_456',          'ubereats',
      '2310 Homestead Rd, Los Altos, CA 94024',
      'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg', 4.2, 199, 1000, true, ARRAY['grubhub'], '{}'::jsonb),
    (taco_rest_uuid,   'Taqueria El Sol',     'Mexican',      '(408) 555-1201', false, true,  'taqueria_el_sol_001',       'ubereats',
      '1111 El Camino Real, Santa Clara, CA 95050',
      'https://images.pexels.com/photos/461198/pexels-photo-461198.jpeg',   4.4, 249, 1000, true, ARRAY['grubhub'], '{}'::jsonb),
    (sushi_rest_uuid,  'Sushi Kai',           'Japanese',     '(650) 555-2202', false, false, 'sushi_kai_001',             'ubereats',
      '250 Castro St, Mountain View, CA 94041',
      'https://images.pexels.com/photos/20980242/pexels-photo-20980242.jpeg', 4.7, 499, 1500, true, ARRAY['grubhub'], '{}'::jsonb),
    (thai_rest_uuid,   'Thai Spice Kitchen',  'Thai',         '(408) 555-3303', false, true,  'thai_spice_kitchen_001',    'ubereats',
      '1020 N Mathilda Ave, Sunnyvale, CA 94089',
      'https://images.pexels.com/photos/2367793/pexels-photo-2367793.jpeg', 4.5, 349, 1200, true, ARRAY['grubhub'], '{}'::jsonb),
    (med_rest_uuid,    'Mediterranean Grill', 'Mediterranean','(669) 555-4404', false, true,  'mediterranean_grill_001',   'ubereats',
      '20688 Stevens Creek Blvd, Cupertino, CA 95014',
      'https://images.pexels.com/photos/32870/pexels-photo.jpg',             4.6, 299, 1200, true, ARRAY['grubhub'], '{}'::jsonb),
    (salad_rest_uuid,  'Green Leaf Salads',   'Healthy',      '(408) 555-5505', false, false, 'green_leaf_salads_001',     'ubereats',
      '650 W El Camino Real, Sunnyvale, CA 94087',
      'https://images.pexels.com/photos/1059905/pexels-photo-1059905.jpeg',  4.3, 199,  800, true, ARRAY['grubhub'], '{}'::jsonb),
    (bagel_rest_uuid,  'Bagel Barn & Deli',   'Breakfast',    '(650) 555-6606', false, false, 'bagel_barn_001',            'ubereats',
      '4546 El Camino Real, Los Altos, CA 94022',
      'https://images.pexels.com/photos/1247065/pexels-photo-1247065.jpeg',  4.1,   0,    0, true, ARRAY['grubhub'], '{}'::jsonb),
    (bbq_rest_uuid,    'Smokehouse BBQ',      'BBQ',          '(408) 555-7707', false, true,  'smokehouse_bbq_001',        'ubereats',
      '1001 S Wolfe Rd, Sunnyvale, CA 94086',
      'https://images.pexels.com/photos/1352296/pexels-photo-1352296.jpeg',  4.2, 399, 2000, true, ARRAY['grubhub'], '{}'::jsonb),
    (vegan_rest_uuid,  'Plant Kitchen',       'Vegan',        '(669) 555-8808', true,  false, 'plant_kitchen_001',         'ubereats',
      '1275 W El Camino Real, Sunnyvale, CA 94087',
      'https://images.pexels.com/photos/236813/pexels-photo-236813.jpeg',    4.8, 249, 1000, true, ARRAY['grubhub'], '{}'::jsonb);

  -- Menu items (unique per (restaurant_id, api_id))
  INSERT INTO public.menu_items (id, restaurant_id, api_id, name, description, price, category, image_url, is_available, options_json) VALUES
    (pizza_margh_uuid, pizza_rest_uuid, 'pizza_palace_margherita', 'Margherita Pizza', 'Classic with basil', 15.99, 'Pizzas', 'https://images.pexels.com/photos/1146760/pexels-photo-1146760.jpeg', true,
     '{"sizes":[{"name":"Small","price":13.99},{"name":"Medium","price":15.99},{"name":"Large","price":17.99}], "toppings":[{"name":"Pepperoni","price":2.00},{"name":"Mushrooms","price":1.50}]}'::jsonb),
    (pizza_bbq_uuid,   pizza_rest_uuid, 'pizza_palace_bbq',        'BBQ Chicken Pizza','BBQ chicken, onions, cilantro', 17.99, 'Pizzas', 'https://images.pexels.com/photos/1146760/pexels-photo-1146760.jpeg', true, '{}'::jsonb),
    (burger_classic_uuid, burger_rest_uuid, 'burger_joint_classic',   'Classic Cheeseburger','Cheeseburger with fries', 14.50, 'Burgers','https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg', true, '{}'::jsonb),
    (burger_house_uuid,   burger_rest_uuid, 'burger_joint_house',     'House Hamburger','Signature hamburger', 15.50, 'Burgers','https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg', true, '{}'::jsonb),
    (taco_alpast_uuid,   taco_rest_uuid, 'taqueria_el_sol_al_pastor','Tacos Al Pastor','3 tacos w/ pineapple', 12.50, 'Tacos','https://images.pexels.com/photos/461198/pexels-photo-461198.jpeg', true,
     '{"tortilla":["corn","flour"],"salsa":["mild","medium","hot"]}'::jsonb),
    (taco_carnitas_uuid, taco_rest_uuid, 'taqueria_el_sol_carnitas', 'Carnitas Burrito','Pork, rice, beans', 11.75, 'Burritos','https://images.pexels.com/photos/461198/pexels-photo-461198.jpeg', true, '{}'::jsonb),
    (sushi_combo_uuid,   sushi_rest_uuid,'sushi_kai_combo_a',        'Sushi Combo A','8 nigiri + roll', 22.00,'Combos','https://images.pexels.com/photos/20980242/pexels-photo-20980242.jpeg', true, '{}'::jsonb),
    (sushi_spicy_uuid,   sushi_rest_uuid,'sushi_kai_spicy_tuna',     'Spicy Tuna Roll','Tuna + spicy mayo', 9.50,'Rolls','https://images.pexels.com/photos/20980242/pexels-photo-20980242.jpeg', true, '{}'::jsonb),
    (thai_padthai_uuid,  thai_rest_uuid, 'thai_spice_pad_thai',      'Pad Thai','Rice noodles, egg, peanuts', 14.25,'Noodles','https://images.pexels.com/photos/2367793/pexels-photo-2367793.jpeg', true, '{}'::jsonb),
    (thai_green_uuid,    thai_rest_uuid, 'thai_spice_green_curry',   'Green Curry','Coconut milk, basil', 15.50,'Curry','https://images.pexels.com/photos/20822695/pexels-photo-20822695.jpeg', true, '{}'::jsonb),
    (med_shawarma_uuid,  med_rest_uuid,  'med_grill_shawarma',       'Chicken Shawarma Wrap','Marinated chicken', 12.99,'Wraps','https://images.pexels.com/photos/236813/pexels-photo-236813.jpeg', true, '{}'::jsonb),
    (med_falafel_uuid,   med_rest_uuid,  'med_grill_falafel',        'Falafel Platter','Falafel, hummus, pita', 13.75,'Platters','https://images.pexels.com/photos/236813/pexels-photo-236813.jpeg', true, '{}'::jsonb),
    (salad_cobb_uuid,    salad_rest_uuid,'green_leaf_cobb',          'Cobb Salad','Bacon, egg, avocado', 12.25,'Salads','https://images.pexels.com/photos/1059905/pexels-photo-1059905.jpeg', true, '{}'::jsonb),
    (salad_bowl_uuid,    salad_rest_uuid,'green_leaf_bowl',          'Power Bowl','Quinoa, roasted veggies', 11.50,'Bowls','https://images.pexels.com/photos/1059905/pexels-photo-1059905.jpeg', true, '{}'::jsonb),
    (bagel_lox_uuid,     bagel_rest_uuid,'bagel_barn_lox',           'Lox & Cream Cheese','Smoked salmon', 9.75,'Bagels','https://images.pexels.com/photos/6397356/pexels-photo-6397356.jpeg', true, '{}'::jsonb),
    (bagel_bfast_uuid,   bagel_rest_uuid,'bagel_barn_breakfast',     'Breakfast Bagel','Egg, cheese, meat', 7.95,'Bagels','https://images.pexels.com/photos/1247065/pexels-photo-1247065.jpeg', true, '{}'::jsonb),
    (bbq_brisket_uuid,   bbq_rest_uuid,  'smokehouse_brisket_plate', 'Smoked Brisket Plate','12-hr brisket', 19.99,'Plates','https://images.pexels.com/photos/1352296/pexels-photo-1352296.jpeg', true, '{}'::jsonb),
    (bbq_ribs_uuid,      bbq_rest_uuid,  'smokehouse_ribs_half',     'Half Rack Ribs','Dry rub', 21.50,'Plates','https://images.pexels.com/photos/1352296/pexels-photo-1352296.jpeg', true, '{}'::jsonb),
    (vegan_bowl_uuid,    vegan_rest_uuid,'plant_kitchen_buddha',     'Buddha Bowl','Brown rice, tofu, veggies', 12.25,'Bowls','https://images.pexels.com/photos/1059905/pexels-photo-1059905.jpeg', true, '{}'::jsonb),
    (vegan_wrap_uuid,    vegan_rest_uuid,'plant_kitchen_avocado',    'Avocado Veggie Wrap','Avocado, hummus', 10.50,'Wraps','https://images.pexels.com/photos/236813/pexels-photo-236813.jpeg', true, '{}'::jsonb);

  -- Payment methods (insert BEFORE orders so FK resolves)
  INSERT INTO public.payment_methods (id, team_id, card_name, last_four, is_default, created_by) VALUES
    (pm_team_uuid,    team_uuid, 'Team Card - Basketball', '4242', true,  coach_uuid),
    (pm_pcard_uuid,   team_uuid, 'Head Coach Card',        '1881', false, coach_uuid),
    (pm_booster_uuid, team_uuid, 'Athletic Dept Visa',     '0099', false, coach_uuid);

  -- ===========================
  -- ORDERS (8 total)
  --  - 2 completed last week
  --  - 4 scheduled next week
  --  - 2 canceled
  -- ===========================

  -- Completed #1 (last week, delivery) - Pizza Palace
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    delivery_instructions, estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount
  ) VALUES (
    comp1_uuid, team_uuid, pizza_rest_uuid,
    'Team Lunch - Last Week', 'Post-game meal (completed)', 'lunch'::public.meal_type,
    NOW() - INTERVAL '6 days - 30 minutes', 'completed', pm_team_uuid, 'completed', coach_uuid,
    'UE-ORD-COMP-001', 'ubereats', 'delivery',
    '50 College Dr', 'Anytown', 'CA', '90210',
    'Leave at front desk', NOW() - INTERVAL '6 days - 30 minutes',
    4623, 299, 150, 0, 420,
    5492, 800, 6292, 800, 0,
    2.99, 1.50, 62.92
  );

  -- Completed #2 (last week, pickup) - Taqueria
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount
  ) VALUES (
    comp2_uuid, team_uuid, taco_rest_uuid,
    'Late Practice Dinner - Last Week', 'Taco night (completed)', 'dinner'::public.meal_type,
    NOW() - INTERVAL '4 days - 15 minutes', 'completed', pm_pcard_uuid, 'completed', coach_uuid,
    'UE-ORD-COMP-002', 'ubereats', 'pickup',
    '101 Oak Ave', 'Anytown', 'CA', '90210',
    NOW() - INTERVAL '4 days - 15 minutes',
    2425, 0, 100, 0, 390,
    2915, 500, 3415, 0, 500,
    0, 1.00, 34.15
  );

  -- Scheduled #1 (next week, pickup) - Burger Joint
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount
  ) VALUES (
    sched1_uuid, team_uuid, burger_rest_uuid,
    'Team Dinner', 'Weekly team dinner', 'dinner'::public.meal_type,
     NOW() + INTERVAL '3 days 2 hours', 'scheduled', pm_pcard_uuid, 'pending', coach_uuid,
    'UE-ORD-SCHED-001', 'ubereats', 'pickup',
    '101 Hotel Dr', 'Anytown', 'CA', '90210',
    NOW() + INTERVAL '3 days 2 hours',
    5900, 0, 100, 0, 653,
    6653, 700, 7353, 0, 700,
    0, 1.00, 73.53
  );

  -- Scheduled #2 (next week, delivery) - Sushi Kai
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    delivery_instructions, estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount
  ) VALUES (
    sched2_uuid, team_uuid, sushi_rest_uuid,
    'Film Session Bento', 'Sushi combo + rolls', 'lunch'::public.meal_type,
    NOW() + INTERVAL '5 days 90 minutes', 'scheduled', pm_team_uuid, 'pending', coach_uuid,
    'UE-ORD-SCHED-002', 'ubereats', 'delivery',
    '50 College Dr', 'Anytown', 'CA', '90210',
    'Call when arriving', NOW() + INTERVAL '5 days 90 minutes',
    5050, 499, 150, 0, 720,
    6419, 0, 6419, 0, 0, 
    4.99, 1.50, 64.19
  );

  -- Scheduled #3 (next week, delivery) - Thai Spice
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    delivery_instructions, estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount
  ) VALUES (
    sched3_uuid, team_uuid, thai_rest_uuid,
    'Team Thai Night', 'Noodles + curry', 'dinner'::public.meal_type,
    NOW() + INTERVAL '7 days 2 hours', 'scheduled', pm_booster_uuid, 'pending', coach_uuid,
    'UE-ORD-SCHED-003', 'ubereats', 'delivery',
    '13 San Marcos', 'Anytown', 'CA', '90210',
    'Ring at back door', NOW() + INTERVAL '7 days 2 hours',
    4400, 349, 150, 0, 680,
    5579, 800, 6379, 800, 0,
    3.49, 1.50, 63.79
  );

  -- Scheduled #4 (next week, delivery) - Smokehouse BBQ
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    delivery_instructions, estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount
  ) VALUES (
    sched4_uuid, team_uuid, bbq_rest_uuid,
    'BBQ Feast', 'Brisket + ribs', 'dinner'::public.meal_type,
    NOW() + INTERVAL '12 days 2 hours', 'scheduled', pm_team_uuid, 'pending', coach_uuid,
    'UE-ORD-SCHED-004', 'ubereats', 'delivery',
    '456 University Dr', 'Anytown', 'CA', '90210',
    'Meet at loading dock', NOW() + INTERVAL '12 days 2 hours',
    6148, 399, 200, 0, 1150,
    7897, 1500, 9397, 1500, 0,
    3.99, 2.00, 93.97
  );

  -- Canceled #1 (pickup) - Bagel Barn
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount, cancel_reason, canceled_at
  ) VALUES (
    cancel1_uuid, team_uuid, bagel_rest_uuid,
    'Breakfast Run - Canceled', 'Bus delay; canceled', 'breakfast'::public.meal_type,
    NOW() - INTERVAL '1 day 30 minutes', 'cancelled', pm_booster_uuid, 'voided', coach_uuid,
    'UE-ORD-CAN-001', 'ubereats', 'pickup',
    '101 Oak Ave', 'Anytown', 'CA', '90210',
    NOW() - INTERVAL '1 day 30 minutes',
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 'Trip canceled', NOW() - INTERVAL '1 day'
  );

  -- Canceled #2 (delivery) - Green Leaf
  INSERT INTO public.meal_orders (
    id, team_id, restaurant_id, title, description, meal_type,
    scheduled_date, order_status, payment_method_id, payment_status, created_by,
    api_order_id, api_source, fulfillment_method,
    delivery_address_line1, delivery_city, delivery_state, delivery_zip,
    delivery_instructions, estimated_delivery_at,
    subtotal_cents, delivery_fee_cents, service_fee_cents, small_order_fee_cents, sales_tax_cents,
    total_without_tips_cents, tip_cents, total_with_tip_cents, driver_tip_cents, pickup_tip_cents,
    delivery_fee_charged, service_fee_charged, total_amount, cancel_reason, canceled_at
  ) VALUES (
    cancel2_uuid, team_uuid, salad_rest_uuid,
    'Salad Lunch - Canceled', 'Vendor issue; canceled', 'lunch'::public.meal_type,
    NOW() - INTERVAL '2 days 60 minutes', 'cancelled', pm_team_uuid, 'voided', coach_uuid,
    'UE-ORD-CAN-002', 'ubereats', 'delivery',
    '50 College Dr', 'Anytown', 'CA', '90210',
    'Text on arrival', NOW() - INTERVAL '2 days 60 minutes',
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 'Restaurant closed unexpectedly', NOW() - INTERVAL '2 days 10 min'
  );

  -- ===========================
  -- WHO ORDERED WHAT (meal_order_items with team_member_id)
  -- ===========================

  -- comp1 (Pizza Palace)
  INSERT INTO public.meal_order_items (id, order_id, team_member_id, product_id, name, notes, quantity, product_marked_price_cents)
  VALUES
    (gen_random_uuid(), comp1_uuid, tm_01, 'pizza_palace_margherita', 'Margherita Pizza', 'No olives', 1, 1599),
    (gen_random_uuid(), comp1_uuid, tm_02, 'pizza_palace_bbq',        'BBQ Chicken Pizza', 'Extra cheese', 1, 1799),
    (gen_random_uuid(), comp1_uuid, coach_tm_id, 'green_leaf_cobb',   'Cobb Salad', 'Side of ranch', 1, 1225);

  -- comp2 (Taqueria El Sol)
  INSERT INTO public.meal_order_items (id, order_id, team_member_id, product_id, name, quantity, product_marked_price_cents)
  VALUES
    (gen_random_uuid(), comp2_uuid, tm_03, 'taqueria_el_sol_al_pastor', 'Tacos Al Pastor', 1, 1250),
    (gen_random_uuid(), comp2_uuid, tm_04, 'taqueria_el_sol_carnitas',  'Carnitas Burrito', 1, 1175);

  -- sched1 (Burger Joint)
  INSERT INTO public.meal_order_items (id, order_id, team_member_id, product_id, name, quantity, product_marked_price_cents)
  VALUES
    (gen_random_uuid(), sched1_uuid, tm_01, 'burger_joint_classic', 'Classic Cheeseburger', 2, 1450),
    (gen_random_uuid(), sched1_uuid, tm_02, 'burger_joint_house',   'House Hamburger',      1, 1550),
    (gen_random_uuid(), sched1_uuid, tm_05, 'burger_joint_classic', 'Classic Cheeseburger', 1, 1450);

  -- sched2 (Sushi Kai)
  INSERT INTO public.meal_order_items (id, order_id, team_member_id, product_id, name, quantity, product_marked_price_cents)
  VALUES
    (gen_random_uuid(), sched2_uuid, tm_06, 'sushi_kai_combo_a',   'Sushi Combo A',   1, 2200),
    (gen_random_uuid(), sched2_uuid, tm_07, 'sushi_kai_spicy_tuna','Spicy Tuna Roll', 2,  950),
    (gen_random_uuid(), sched2_uuid, tm_08, 'sushi_kai_spicy_tuna','Spicy Tuna Roll', 1,  950);

  -- sched3 (Thai Spice)
  INSERT INTO public.meal_order_items (id, order_id, team_member_id, product_id, name, notes, quantity, product_marked_price_cents)
  VALUES
    (gen_random_uuid(), sched3_uuid, tm_09, 'thai_spice_pad_thai',   'Pad Thai', 'No peanuts', 1, 1425),
    (gen_random_uuid(), sched3_uuid, tm_10, 'thai_spice_green_curry','Green Curry', NULL, 1, 1550),
    (gen_random_uuid(), sched3_uuid, tm_11, 'thai_spice_pad_thai',   'Pad Thai', NULL, 1, 1425);

  -- sched4 (Smokehouse BBQ)
  INSERT INTO public.meal_order_items (id, order_id, team_member_id, product_id, name, quantity, product_marked_price_cents)
  VALUES
    (gen_random_uuid(), sched4_uuid, tm_12, 'smokehouse_brisket_plate','Smoked Brisket Plate', 1, 1999),
    (gen_random_uuid(), sched4_uuid, tm_03, 'smokehouse_ribs_half',    'Half Rack Ribs',       1, 2150),
    (gen_random_uuid(), sched4_uuid, tm_04, 'smokehouse_brisket_plate','Smoked Brisket Plate', 1, 1999);

  -- cancel1 (Bagel Barn) - canceled but we can still seed a line for realism
  INSERT INTO public.meal_order_items (id, order_id, team_member_id, product_id, name, quantity, product_marked_price_cents)
  VALUES (gen_random_uuid(), cancel1_uuid, coach_tm_id, 'bagel_barn_lox', 'Lox & Cream Cheese', 1, 975);

  -- cancel2 (Green Leaf) - canceled
  INSERT INTO public.meal_order_items (id, order_id, team_member_id, product_id, name, quantity, product_marked_price_cents)
  VALUES (gen_random_uuid(), cancel2_uuid, tm_05, 'green_leaf_cobb', 'Cobb Salad', 1, 1225);

  -- A few example customizations/options (showing the typed tables). Use one item from sched1 and one from sched2.
  -- Find any single line from sched1
  SELECT id INTO cust_a FROM public.meal_order_items WHERE order_id = sched1_uuid LIMIT 1;
  IF cust_a IS NOT NULL THEN
    cust_b := gen_random_uuid();
    INSERT INTO public.meal_order_item_customizations (id, order_item_id, name)
    VALUES (cust_b, cust_a, 'Bun');
    INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
    VALUES (cust_b, 'bun_sesame', 'Sesame Bun', 0, 1, '{}'::jsonb);
  END IF;

  -- Add a customization to one sushi roll
  SELECT id INTO cust_c FROM public.meal_order_items WHERE order_id = sched2_uuid AND name = 'Spicy Tuna Roll' LIMIT 1;
  IF cust_c IS NOT NULL THEN
    INSERT INTO public.meal_order_item_customizations (id, order_item_id, name)
    VALUES (gen_random_uuid(), cust_c, 'Extras');
    INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
    SELECT c.id, 'extra_wasabi', 'Extra Wasabi', 0, 1, '{}'::jsonb
    FROM public.meal_order_item_customizations c
    WHERE c.order_item_id = cust_c AND c.name = 'Extras';
  END IF;

EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'Foreign key error: %', SQLERRM;
  WHEN unique_violation THEN
    RAISE NOTICE 'Unique constraint error: %', SQLERRM;
  WHEN OTHERS THEN
    RAISE NOTICE 'Unexpected error: %', SQLERRM;
END $$;
