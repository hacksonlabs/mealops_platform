-- supabase/migrations/009_mock_data
-- Mock Data (aligned across order_items + normalized snapshot tables)
DO $$
DECLARE
  -- core ids
  coach_uuid          UUID := gen_random_uuid();
  team_uuid           UUID := gen_random_uuid();

  -- locations
  loc_campus_uuid     UUID := gen_random_uuid();
  loc_office_uuid     UUID := gen_random_uuid();
  loc_hotel_uuid      UUID := gen_random_uuid();
  loc_sanmarcos_uuid  UUID := gen_random_uuid();

  -- restaurants
  pizza_rest_uuid     UUID := gen_random_uuid();
  burger_rest_uuid    UUID := gen_random_uuid();
  taco_rest_uuid          UUID := gen_random_uuid();
  sushi_rest_uuid         UUID := gen_random_uuid();
  thai_rest_uuid          UUID := gen_random_uuid();
  med_rest_uuid           UUID := gen_random_uuid();
  salad_rest_uuid         UUID := gen_random_uuid();
  bagel_rest_uuid         UUID := gen_random_uuid();
  bbq_rest_uuid           UUID := gen_random_uuid();
  vegan_rest_uuid         UUID := gen_random_uuid();

  -- menu items (base)
  pizza_item_uuid     UUID := gen_random_uuid(); -- Margherita
  salad_item_uuid     UUID := gen_random_uuid(); -- Caesar
  burger_item_uuid    UUID := gen_random_uuid(); -- Classic Cheeseburger

  -- extra menu items added to align all order lines
  bbq_pizza_item_uuid         UUID := gen_random_uuid(); -- BBQ Chicken Pizza
  blt_sandwich_item_uuid      UUID := gen_random_uuid(); -- BLT Sandwich
  house_hamburger_item_uuid   UUID := gen_random_uuid(); -- House Hamburger
  blt_cheeseburger_item_uuid  UUID := gen_random_uuid(); -- BLT Cheeseburger
  house_salad_item_uuid       UUID := gen_random_uuid(); -- House Salad
  hamburger_item_uuid         UUID := gen_random_uuid(); -- Hamburger

  taco_al_pastor_uuid     UUID := gen_random_uuid();
  taco_carnitas_uuid      UUID := gen_random_uuid();
  sushi_combo_uuid        UUID := gen_random_uuid();
  sushi_spicy_tuna_uuid   UUID := gen_random_uuid();
  thai_pad_thai_uuid      UUID := gen_random_uuid();
  thai_green_curry_uuid   UUID := gen_random_uuid();
  med_shawarma_uuid       UUID := gen_random_uuid();
  med_falafel_uuid        UUID := gen_random_uuid();
  salad_cobb_uuid         UUID := gen_random_uuid();
  salad_bowl_uuid         UUID := gen_random_uuid();
  bagel_lox_uuid          UUID := gen_random_uuid();
  bagel_breakfast_uuid    UUID := gen_random_uuid();
  bbq_brisket_uuid        UUID := gen_random_uuid();
  bbq_ribs_uuid           UUID := gen_random_uuid();
  vegan_bowl_uuid         UUID := gen_random_uuid();
  vegan_wrap_uuid         UUID := gen_random_uuid();

  -- payments
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

  -- team members
  coach_tm_id UUID := gen_random_uuid();
  tm_01 UUID := gen_random_uuid(); tm_02 UUID := gen_random_uuid(); tm_03 UUID := gen_random_uuid();
  tm_04 UUID := gen_random_uuid(); tm_05 UUID := gen_random_uuid(); tm_06 UUID := gen_random_uuid();
  tm_07 UUID := gen_random_uuid(); tm_08 UUID := gen_random_uuid(); tm_09 UUID := gen_random_uuid();
  tm_10 UUID := gen_random_uuid();

  -- meal_order_items ids (so we can insert customizations/options deterministically)
  m01 UUID := gen_random_uuid(); m02 UUID := gen_random_uuid(); m03 UUID := gen_random_uuid();
  m04 UUID := gen_random_uuid(); m05 UUID := gen_random_uuid(); m06 UUID := gen_random_uuid();
  m07 UUID := gen_random_uuid(); m08 UUID := gen_random_uuid(); m09 UUID := gen_random_uuid();
  m10 UUID := gen_random_uuid(); m11 UUID := gen_random_uuid(); m12 UUID := gen_random_uuid();
  m13 UUID := gen_random_uuid(); m14 UUID := gen_random_uuid(); m15 UUID := gen_random_uuid();
  m16 UUID := gen_random_uuid(); m17 UUID := gen_random_uuid();

  coach_name  TEXT := 'Coach Johnson';
  coach_email TEXT := 'coach@team.edu';
BEGIN
  -- Seed auth user (basic, acceptable for local dev)
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

  -- Team + members
  INSERT INTO public.teams (id, name, sport, conference_name, gender, coach_id)
  VALUES (team_uuid, 'Warriors', 'Basketball', 'PAC-12', 'womens', coach_uuid);

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

  -- Locations
  INSERT INTO public.saved_locations (id, team_id, name, address, location_type) VALUES
    (loc_campus_uuid,    team_uuid, 'Campus Gym',     '456 University Dr, Anytown, CA 90210', 'school'::public.location_type),
    (loc_office_uuid,    team_uuid, 'Coaches Office', '50 College Dr, Anytown, CA 90210',     'school'::public.location_type),
    (loc_hotel_uuid,     team_uuid, 'San Diego Hyatt','101 Hotel Dr, Anytown, CA 90210',      'school'::public.location_type),
    (loc_sanmarcos_uuid, team_uuid, 'San Marcos Gym', '13 San Marcos Dr, Anytown, CA 90210',  'school'::public.location_type);

  -- API Integration
  INSERT INTO public.api_integrations (id, provider_name, api_key, base_url)
  VALUES (gen_random_uuid(), 'ubereats', 'YOUR_UBEREATS_API_KEY', 'https://api.ubereats.com');

  -- Restaurants
  INSERT INTO public.restaurants (
    id, location_id, name, cuisine_type, phone_number, is_favorite, supports_catering,
    api_id, api_source, address, image_url, rating, delivery_fee, minimum_order, is_available, supported_providers, provider_restaurant_ids
  ) VALUES
    (pizza_rest_uuid,  loc_campus_uuid, 'Pizza Palace', 'Italian',  '(123) 456-7890', true,  true,  'ubereats_pizza_palace_123', 'ubereats', '1325 Sunnyvale Saratoga Rd, Sunnyvale, CA 94087', 'https://images.pexels.com/photos/1146760/pexels-photo-1146760.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', 4.5, 2.99, 15.00, true, ARRAY['grubhub','ubereats','doordash'],jsonb_build_object('grubhub',  'gh_pizza_palace_123', 'ubereats', 'ubereats_pizza_palace_123', 'doordash', 'dd_pizza_palace_123')),
    (burger_rest_uuid, loc_office_uuid, 'Burger Joint', 'American', '(987) 654-3210', false, false, 'ubereats_burger_joint_456', 'ubereats', '2310 Homestead Rd, Los Altos, CA 94024', 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',  4.2, 1.99, 10.00, true, ARRAY['grubhub'], '{}'::jsonb),
    (taco_rest_uuid,  loc_campus_uuid,    'Taqueria El Sol',      'Mexican',      '(408) 555-1201', false, true,  'ubereats_taqueria_el_sol_001',  'ubereats', '1111 El Camino Real, Santa Clara, CA 95050',     'https://images.pexels.com/photos/461198/pexels-photo-461198.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',   4.4, 2.49, 10.00, true, ARRAY['grubhub'], '{}'::jsonb),
    (sushi_rest_uuid, loc_office_uuid,    'Sushi Kai',            'Japanese',     '(650) 555-2202', false, false, 'ubereats_sushi_kai_001',         'ubereats', '250 Castro St, Mountain View, CA 94041',         'https://images.pexels.com/photos/20980242/pexels-photo-20980242/free-photo-of-close-up-of-a-sushi-platter-on-a-table.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',      4.7, 4.99, 15.00, true, ARRAY['grubhub'], '{}'::jsonb),
    (thai_rest_uuid,  loc_hotel_uuid,     'Thai Spice Kitchen',   'Thai',         '(408) 555-3303', false, true,  'ubereats_thai_spice_kitchen_001','ubereats', '1020 N Mathilda Ave, Sunnyvale, CA 94089',        'https://images.pexels.com/photos/2367793/pexels-photo-2367793.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',       4.5, 3.49, 12.00, true, ARRAY['grubhub'], '{}'::jsonb),
    (med_rest_uuid,   loc_sanmarcos_uuid, 'Mediterranean Grill',  'Mediterranean','(669) 555-4404', false, true,  'ubereats_mediterranean_grill_001','ubereats','20688 Stevens Creek Blvd, Cupertino, CA 95014',  'https://images.pexels.com/photos/32870/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',        4.6, 2.99, 12.00, true, ARRAY['grubhub'], '{}'::jsonb),
    (salad_rest_uuid, loc_campus_uuid,    'Green Leaf Salads',    'Healthy',      '(408) 555-5505', false, false, 'ubereats_green_leaf_salads_001', 'ubereats', '650 W El Camino Real, Sunnyvale, CA 94087',       'https://images.pexels.com/photos/1059905/pexels-photo-1059905.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',     4.3, 1.99,  8.00, true, ARRAY['grubhub'], '{}'::jsonb),
    (bagel_rest_uuid, loc_office_uuid,    'Bagel Barn & Deli',    'Breakfast',    '(650) 555-6606', false, false, 'ubereats_bagel_barn_001',        'ubereats', '4546 El Camino Real, Los Altos, CA 94022',        'https://images.pexels.com/photos/1247065/pexels-photo-1247065.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',     4.1, 0.00,  0.00, true, ARRAY['grubhub'], '{}'::jsonb),
    (bbq_rest_uuid,   loc_hotel_uuid,     'Smokehouse BBQ',       'BBQ',          '(408) 555-7707', false, true,  'ubereats_smokehouse_bbq_001',    'ubereats', '1001 S Wolfe Rd, Sunnyvale, CA 94086',            'https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',        4.2, 3.99, 20.00, true, ARRAY['grubhub'], '{}'::jsonb),
    (vegan_rest_uuid, loc_sanmarcos_uuid, 'Plant Kitchen',        'Vegan',        '(669) 555-8808', true,  false, 'ubereats_plant_kitchen_001',     'ubereats', '1275 W El Camino Real, Sunnyvale, CA 94087',      'https://images.pexels.com/photos/236813/pexels-photo-236813.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',      4.8, 2.49, 10.00, true, ARRAY['grubhub'], '{}'::jsonb);

  -- Menu items (complete)
  INSERT INTO public.menu_items (id, restaurant_id, api_id, name, description, price, category, image_url, is_available, options_json) VALUES
    (pizza_item_uuid, pizza_rest_uuid,  'pizza_palace_margherita', 'Margherita Pizza', 'Classic Margherita with fresh basil', 15.99, 'Pizzas', 'https://images.pexels.com/photos/1146760/pexels-photo-1146760.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true,
     '{"sizes":[{"name":"Small","price":13.99},{"name":"Medium","price":15.99},{"name":"Large","price":17.99}],"toppings":[{"name":"Pepperoni","price":2.00},{"name":"Mushrooms","price":1.50}]}'::jsonb),
    (salad_item_uuid, pizza_rest_uuid,  'pizza_palace_caesar_salad', 'Caesar Salad', 'Fresh Caesar salad with croutons', 12.01, 'Salads', 'https://images.pexels.com/photos/1059905/pexels-photo-1059905.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true,
     '{"dressings":[{"name":"Caesar"},{"name":"Ranch"}]}'::jsonb),
    (taco_al_pastor_uuid, taco_rest_uuid, 'taqueria_el_sol_al_pastor_tacos', 'Tacos Al Pastor', 'Three tacos with pineapple & cilantro', 12.50, 'Tacos',  'https://images.pexels.com/photos/461198/pexels-photo-461198.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true,
     '{"tortilla":["corn","flour"],"salsa":["mild","medium","hot"]}'::jsonb),
    (taco_carnitas_uuid,  taco_rest_uuid, 'taqueria_el_sol_carnitas_burrito','Carnitas Burrito','Slow-cooked pork, rice, beans',          11.75, 'Burritos','https://images.pexels.com/photos/461198/pexels-photo-461198.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',       true,
     '{"add_ons":[{"name":"Guacamole","price":1.75},{"name":"Sour Cream","price":0.75}]}'::jsonb),
    (sushi_combo_uuid,      sushi_rest_uuid, 'sushi_kai_combo_a',      'Sushi Combo A',    'Chef''s selection of 8 nigiri + roll', 22.00, 'Combos', 'https://images.pexels.com/photos/20980242/pexels-photo-20980242/free-photo-of-close-up-of-a-sushi-platter-on-a-table.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true,
     '{"wasabi":["yes","no"],"ginger":true}'::jsonb),
    (thai_pad_thai_uuid,    thai_rest_uuid,  'thai_spice_pad_thai',    'Pad Thai',         'Rice noodles, egg, peanuts', 14.25, 'Noodles', 'https://images.pexels.com/photos/2367793/pexels-photo-2367793.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true,
     '{"protein":["chicken","tofu","shrimp"],"spice_level":["mild","med","hot"]}'::jsonb),
    (thai_green_curry_uuid, thai_rest_uuid,  'thai_spice_green_curry', 'Green Curry',      'Coconut milk, basil, veggies', 15.50, 'Curry', 'https://images.pexels.com/photos/20822695/pexels-photo-20822695/free-photo-of-thai-food.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true,
     '{"protein":["chicken","tofu"],"rice":["jasmine","brown"]}'::jsonb),
    (med_shawarma_uuid, med_rest_uuid, 'med_grill_shawarma_wrap', 'Chicken Shawarma Wrap', 'Marinated chicken, garlic sauce', 12.99, 'Wraps',   'https://images.pexels.com/photos/236813/pexels-photo-236813.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true,
     '{"sides":["fries","salad"],"add_ons":[{"name":"Hummus","price":1.50}]}'::jsonb),
    (salad_cobb_uuid, salad_rest_uuid, 'green_leaf_cobb', 'Cobb Salad', 'Bacon, egg, avocado, blue cheese', 12.25, 'Salads', 'https://images.pexels.com/photos/1059905/pexels-photo-1059905.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true,
     '{"dressings":["ranch","balsamic","caesar"]}'::jsonb);

  INSERT INTO public.menu_items (id, restaurant_id, api_id, name, description, price, category, image_url, is_available) VALUES
    (burger_item_uuid,           burger_rest_uuid, 'burger_joint_classic',   'Classic Cheeseburger', 'Classic cheeseburger with fries', 14.50, 'Burgers', 'https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true),
    (bbq_pizza_item_uuid,        pizza_rest_uuid,  'pizza_palace_bbq_chx',   'BBQ Chicken Pizza',    'BBQ chicken, red onions, cilantro',     17.99, 'Pizzas', 'https://images.pexels.com/photos/1146760/pexels-photo-1146760.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true),
    (blt_sandwich_item_uuid,     burger_rest_uuid, 'burger_joint_blt',       'BLT Sandwich',         'Bacon, lettuce, tomato',                10.50, 'Sandwiches', 'https://images.pexels.com/photos/6397356/pexels-photo-6397356.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true),
    (house_hamburger_item_uuid,  burger_rest_uuid, 'burger_joint_house',     'House Hamburger',      'Signature house hamburger',             15.50, 'Burgers', 'https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true),
    (blt_cheeseburger_item_uuid, burger_rest_uuid, 'burger_joint_blt_cb',    'BLT Cheeseburger',     'BLT + cheese',                          14.50, 'Burgers', 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true),
    (house_salad_item_uuid,      pizza_rest_uuid,  'pizza_palace_house_sal', 'House Salad',          'Mixed greens, veggies',                 13.01, 'Salads', 'https://images.pexels.com/photos/1059905/pexels-photo-1059905.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true),
    (hamburger_item_uuid,        burger_rest_uuid, 'burger_joint_hamburger', 'Hamburger',            'Classic hamburger',                      13.50, 'Burgers', 'https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true),
    (sushi_spicy_tuna_uuid, sushi_rest_uuid, 'sushi_kai_spicy_tuna',   'Spicy Tuna Roll',      'Fresh tuna with spicy mayo', 9.50,  'Rolls',  'https://images.pexels.com/photos/20980242/pexels-photo-20980242/free-photo-of-close-up-of-a-sushi-platter-on-a-table.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',  true),
    (med_falafel_uuid,      med_rest_uuid,   'med_grill_falafel_platter','Falafel Platter',   'Falafel, hummus, pita, salad', 13.75, 'Platters','https://images.pexels.com/photos/1059905/pexels-photo-1059905.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',    true),
    (salad_bowl_uuid,       salad_rest_uuid, 'green_leaf_bowl',        'Power Bowl',          'Quinoa, roasted veggies, tahini', 11.50, 'Bowls', 'https://images.pexels.com/photos/1059905/pexels-photo-1059905.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',      true),
    (bagel_lox_uuid,        bagel_rest_uuid, 'bagel_barn_lox',         'Lox & Cream Cheese',  'Smoked salmon on toasted bagel', 9.75,  'Bagels','https://images.pexels.com/photos/6397356/pexels-photo-6397356.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',        true),
    (bagel_breakfast_uuid,  bagel_rest_uuid, 'bagel_barn_breakfast',   'Breakfast Bagel',     'Egg, cheese, choice of meat',    7.95,  'Bagels','https://images.pexels.com/photos/1247065/pexels-photo-1247065.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true),
    (bbq_brisket_uuid,      bbq_rest_uuid,   'smokehouse_brisket_plate','Smoked Brisket Plate','12-hr smoked brisket, 2 sides', 19.99, 'Plates','https://images.pexels.com/photos/1352296/pexels-photo-1352296.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',   true),
    (bbq_ribs_uuid,         bbq_rest_uuid,   'smokehouse_ribs_half',   'Half Rack Ribs',      'Dry rub pork ribs, choice of sauce', 21.50, 'Plates','https://images.pexels.com/photos/1352296/pexels-photo-1352296.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',  true),
    (vegan_bowl_uuid,       vegan_rest_uuid, 'plant_kitchen_buddha_bowl','Buddha Bowl',      'Brown rice, tofu, veggies, tahini', 12.25, 'Bowls', 'https://images.pexels.com/photos/1059905/pexels-photo-1059905.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true),
    (vegan_wrap_uuid,       vegan_rest_uuid, 'plant_kitchen_avocado_wrap','Avocado Veggie Wrap','Avocado, hummus, sprouts',      10.50, 'Wraps', 'https://images.pexels.com/photos/236813/pexels-photo-236813.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', true);

  -- Payment methods
  INSERT INTO public.payment_methods (id, team_id, card_name, last_four, is_default, created_by) VALUES
    (pm_team_uuid,    team_uuid, 'Team Card - Basketball', '4242', true,  coach_uuid),
    (pm_pcard_uuid,   team_uuid, 'Head Coach Card',        '1881', false, coach_uuid),
    (pm_booster_uuid, team_uuid, 'Athletic Dept Visa',     '0099', false, coach_uuid);

  -- ===========================
  -- ORDERS + order_items (legacy authoritative)
  -- ===========================

  -- 1) COMPLETED (Pizza Palace, delivery)
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
    -- UPDATED: base(45.99) + options(5.50) = 51.49
    5149, 299, 150, 0, 414,
    6012, 800, 6812, 800, 0,
    2.99, 1.50, 68.12
  );

  INSERT INTO public.order_items (order_id, team_member_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options) VALUES
    (completed_order_uuid, tm_01, pizza_item_uuid,        'Margherita Pizza', 1, 15.99, 'No olives',
      '["Medium","Pepperoni"]'::jsonb),
    (completed_order_uuid, tm_02, bbq_pizza_item_uuid,    'BBQ Chicken Pizza', 1, 17.99, 'Extra cheese',
      '["Large","Extra Cheese"]'::jsonb),
    (completed_order_uuid, coach_tm_id, salad_item_uuid,  'Caesar Salad',     1, 12.01, 'Side of ranch',
      '["Ranch Dressing"]'::jsonb);

  -- 2) SCHEDULED (Burger Joint, delivery)
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
    8300, 350, 200, 0, 725,
    9575, 1200, 10775, 1200, 0,
    3.50, 2.00, 107.75
  );

  INSERT INTO public.order_items (order_id, team_member_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options) VALUES
    (scheduled_order_uuid, tm_01, burger_item_uuid,          'Classic Cheeseburger', 2, 14.50, 'No pickles',
      '["Sesame Bun","Cheddar Cheese"]'::jsonb),
    (scheduled_order_uuid, tm_02, hamburger_item_uuid,       'Hamburger',            1, 13.50, 'Extra onion rings',
      '["Brioche Bun"]'::jsonb),
    (scheduled_order_uuid, tm_03, blt_sandwich_item_uuid,    'BLT Sandwich',         1, 10.50, NULL,
      '["Brioche Bread"]'::jsonb),
    (scheduled_order_uuid, tm_04, burger_item_uuid,          'Classic Cheeseburger', 1, 14.50, NULL,
      '["Sesame Bun"]'::jsonb),
    (scheduled_order_uuid, tm_05, house_hamburger_item_uuid, 'House Hamburger',      1, 15.50, NULL,
      '["Sesame Bun"]'::jsonb);

  -- 3) THIS WEEK #1 (Pizza Palace, delivery)
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
    7001, 299, 150, 0, 612,
    8062, 1000, 9062, 1000, 0,
    2.99, 1.50, 90.62
  );

  INSERT INTO public.order_items (order_id, team_member_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options) VALUES
    (this_week_order_1, tm_06, pizza_item_uuid,        'Margherita Pizza', 2, 15.99, 'Well done',
      '["Medium"]'::jsonb),
    (this_week_order_1, coach_tm_id, salad_item_uuid,  'Caesar Salad',     1, 12.01, 'Dressing on side',
      '["Caesar Dressing"]'::jsonb),
    (this_week_order_1, tm_07, house_salad_item_uuid,  'House Salad',      2, 13.01, NULL,
      '["Caesar Dressing"]'::jsonb);

  -- 4) THIS WEEK #2 (Burger Joint, pickup)
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
    (this_week_order_2, tm_08, burger_item_uuid,           'Classic Cheeseburger', 3, 14.50, 'No pickles',
      '["Sesame Bun"]'::jsonb),
    (this_week_order_2, tm_09, blt_cheeseburger_item_uuid, 'BLT Cheeseburger',     1, 14.50, NULL,
      '["Sesame Bun"]'::jsonb),
    (this_week_order_2, tm_10, hamburger_item_uuid,        'Hamburger',            1, 14.50, NULL,
      '["Brioche Bun"]'::jsonb);

  -- 5) PENDING CONFIRMATION (Pizza Palace, delivery)
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
    (pending_order_uuid, tm_08, pizza_item_uuid,        'Margherita Pizza', 1, 15.99, 'No olives',
      '["Medium"]'::jsonb),
    (pending_order_uuid, tm_09, salad_item_uuid,        'Caesar Salad',     1, 12.01, 'Light dressing',
      '["Caesar Dressing"]'::jsonb),
    (pending_order_uuid, tm_10, pizza_item_uuid,        'Margherita Pizza', 2, 17.99, 'Extra basil',
      '["Large"]'::jsonb);

  -- 6) CANCELLED (Burger Joint, pickup)
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

  INSERT INTO public.order_items (order_id, team_member_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options)
  VALUES (cancelled_order_uuid, coach_tm_id, burger_item_uuid, 'Classic Cheeseburger', 1, 14.50, NULL, '["Sesame Bun"]'::jsonb);

  -- ============================================
  -- MIRROR order_items INTO normalized snapshots
  -- ============================================

  -- 1) COMPLETED
  INSERT INTO public.meal_order_items (id, order_id, product_id, name, description, image_url, notes, quantity, product_marked_price_cents)
  VALUES
    (m01, completed_order_uuid, 'pizza_palace_margherita', 'Margherita Pizza', NULL, NULL, 'No olives', 1, 1599),
    (m02, completed_order_uuid, 'pizza_palace_bbq_chx',    'BBQ Chicken Pizza', NULL, NULL, 'Extra cheese', 1, 1799),
    (m03, completed_order_uuid, 'pizza_palace_caesar_salad','Caesar Salad', NULL, NULL, 'Side of ranch', 1, 1201);

  -- m01 options
  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES
    (gen_random_uuid(), m01, 'Size'),
    (gen_random_uuid(), m01, 'Toppings');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, v.option_id, v.name, v.price_cents, 1, '{}'::jsonb
  FROM (VALUES
    ('Size','size_medium','Medium',0),
    ('Toppings','top_pepperoni','Pepperoni',200)
  ) AS v(group_name, option_id, name, price_cents)
  JOIN public.meal_order_item_customizations c ON c.order_item_id = m01 AND c.name = v.group_name;

  -- m02 options
  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES
    (gen_random_uuid(), m02, 'Size'),
    (gen_random_uuid(), m02, 'Cheese');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, v.option_id, v.name, v.price_cents, 1, '{}'::jsonb
  FROM (VALUES
    ('Size','size_large','Large',200),
    ('Cheese','top_xcheese','Extra Cheese',150)
  ) AS v(group_name, option_id, name, price_cents)
  JOIN public.meal_order_item_customizations c ON c.order_item_id = m02 AND c.name = v.group_name;

  -- m03 options
  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES
    (gen_random_uuid(), m03, 'Dressing');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'dress_ranch', 'Ranch Dressing', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c
  WHERE c.order_item_id = m03 AND c.name = 'Dressing';

  -- 2) SCHEDULED
  INSERT INTO public.meal_order_items (id, order_id, product_id, name, quantity, product_marked_price_cents)
  VALUES
    (m04, scheduled_order_uuid, 'burger_joint_classic',  'Classic Cheeseburger', 2, 1450),
    (m05, scheduled_order_uuid, 'burger_joint_hamburger','Hamburger',            1, 1350),
    (m06, scheduled_order_uuid, 'burger_joint_blt',      'BLT Sandwich',         1, 1050),
    (m07, scheduled_order_uuid, 'burger_joint_classic',  'Classic Cheeseburger', 1, 1450),
    (m08, scheduled_order_uuid, 'burger_joint_house',    'House Hamburger',      1, 1550);

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES
    (gen_random_uuid(), m04, 'Bun'),
    (gen_random_uuid(), m04, 'Cheese');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, v.option_id, v.name, 0, 1, '{}'::jsonb
  FROM (VALUES
    ('Bun','bun_sesame','Sesame Bun'),
    ('Cheese','cheddar','Cheddar Cheese')
  ) AS v(group_name, option_id, name)
  JOIN public.meal_order_item_customizations c ON c.order_item_id = m04 AND c.name = v.group_name;

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES (gen_random_uuid(), m05, 'Bun');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'bun_brioche', 'Brioche Bun', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c WHERE c.order_item_id = m05 AND c.name = 'Bun';

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES (gen_random_uuid(), m06, 'Bread');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'bread_brioche', 'Brioche Bread', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c WHERE c.order_item_id = m06 AND c.name = 'Bread';

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES (gen_random_uuid(), m07, 'Bun');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'bun_sesame', 'Sesame Bun', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c WHERE c.order_item_id = m07 AND c.name = 'Bun';

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES (gen_random_uuid(), m08, 'Bun');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'bun_sesame', 'Sesame Bun', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c WHERE c.order_item_id = m08 AND c.name = 'Bun';

  -- 3) THIS WEEK #1
  INSERT INTO public.meal_order_items (id, order_id, product_id, name, quantity, product_marked_price_cents)
  VALUES
    (m09, this_week_order_1, 'pizza_palace_margherita', 'Margherita Pizza', 2, 1599),
    (m10, this_week_order_1, 'pizza_palace_caesar_salad','Caesar Salad',     1, 1201),
    (m11, this_week_order_1, 'pizza_palace_house_sal',   'House Salad',      2, 1301);

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES (gen_random_uuid(), m09, 'Size');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'size_medium', 'Medium', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c WHERE c.order_item_id = m09 AND c.name = 'Size';

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES (gen_random_uuid(), m10, 'Dressing');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'dress_caesar', 'Caesar Dressing', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c WHERE c.order_item_id = m10 AND c.name = 'Dressing';

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES (gen_random_uuid(), m11, 'Dressing');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'dress_caesar', 'Caesar Dressing', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c WHERE c.order_item_id = m11 AND c.name = 'Dressing';

  -- 4) THIS WEEK #2
  INSERT INTO public.meal_order_items (id, order_id, product_id, name, quantity, product_marked_price_cents)
  VALUES
    (m12, this_week_order_2, 'burger_joint_classic',   'Classic Cheeseburger', 3, 1450),
    (m13, this_week_order_2, 'burger_joint_blt_cb',    'BLT Cheeseburger',     1, 1450),
    (m14, this_week_order_2, 'burger_joint_hamburger', 'Hamburger',            1, 1450);

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES (gen_random_uuid(), m12, 'Bun');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'bun_sesame', 'Sesame Bun', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c WHERE c.order_item_id = m12 AND c.name = 'Bun';

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES (gen_random_uuid(), m13, 'Bun');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'bun_sesame', 'Sesame Bun', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c WHERE c.order_item_id = m13 AND c.name = 'Bun';

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES (gen_random_uuid(), m14, 'Bun');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'bun_brioche', 'Brioche Bun', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c WHERE c.order_item_id = m14 AND c.name = 'Bun';

  -- 5) PENDING
  INSERT INTO public.meal_order_items (id, order_id, product_id, name, quantity, product_marked_price_cents)
  VALUES
    (m15, pending_order_uuid, 'pizza_palace_margherita', 'Margherita Pizza', 1, 1599),
    (m16, pending_order_uuid, 'pizza_palace_caesar_salad','Caesar Salad',     1, 1201),
    (m17, pending_order_uuid, 'pizza_palace_margherita', 'Margherita Pizza', 2, 1799);

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES (gen_random_uuid(), m15, 'Size');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'size_medium', 'Medium', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c WHERE c.order_item_id = m15 AND c.name = 'Size';

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES (gen_random_uuid(), m16, 'Dressing');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'dress_caesar', 'Caesar Dressing', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c WHERE c.order_item_id = m16 AND c.name = 'Dressing';

  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name) VALUES (gen_random_uuid(), m17, 'Size');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'size_large', 'Large', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c WHERE c.order_item_id = m17 AND c.name = 'Size';

  -- 6) CANCELLED
  INSERT INTO public.meal_order_items (id, order_id, product_id, name, quantity, product_marked_price_cents)
  VALUES (gen_random_uuid(), cancelled_order_uuid, 'burger_joint_classic', 'Classic Cheeseburger', 1, 1450);
  INSERT INTO public.meal_order_item_customizations (id, order_item_id, name)
  VALUES (gen_random_uuid(), (SELECT id FROM public.meal_order_items WHERE order_id = cancelled_order_uuid LIMIT 1), 'Bun');
  INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
  SELECT c.id, 'bun_sesame', 'Sesame Bun', 0, 1, '{}'::jsonb
  FROM public.meal_order_item_customizations c
  WHERE c.order_item_id = (SELECT id FROM public.meal_order_items WHERE order_id = cancelled_order_uuid LIMIT 1)
    AND c.name = 'Bun';

  -- Addresses (unchanged)
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
