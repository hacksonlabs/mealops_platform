-- supabase/migrations/009_mock_data
-- Mock Data
DO $$
DECLARE
    coach_uuid UUID := gen_random_uuid();
    player1_uuid UUID := gen_random_uuid();
    player2_uuid UUID := gen_random_uuid();
    team_uuid UUID := gen_random_uuid();
    location_uuid UUID := gen_random_uuid();

    -- restaurants & menu items
    pizza_palace_rest_uuid UUID := gen_random_uuid();
    pizza_menu_item_uuid UUID := gen_random_uuid();
    salad_menu_item_uuid UUID := gen_random_uuid();
    burger_joint_rest_uuid UUID := gen_random_uuid();
    burger_menu_item_uuid UUID := gen_random_uuid();

    payment_method_uuid UUID := gen_random_uuid();
    completed_order_uuid UUID := gen_random_uuid();
    scheduled_order_uuid UUID := gen_random_uuid();
    this_week_order_1 UUID := gen_random_uuid();
    this_week_order_2 UUID := gen_random_uuid();

    poll_uuid UUID := gen_random_uuid();
    option1_uuid UUID := gen_random_uuid();
    option2_uuid UUID := gen_random_uuid();
    api_integration_ubereats_uuid UUID := gen_random_uuid();

    grp_players_uuid UUID := gen_random_uuid();
    grp_coaches_uuid UUID := gen_random_uuid();
    coach_tm_id UUID;
    player1_tm_id UUID;
    player2_tm_id UUID;

    existing_location_id UUID;

    mo_item_1 UUID;
    cz_size UUID;
    cz_toppings UUID;

    coach_name TEXT := 'Coach Johnson';
    coach_email TEXT := 'coach@team.edu';
    player1_name TEXT := 'Alex Smith';
    player1_email TEXT := 'player1@team.edu';
    player2_name TEXT := 'Taylor Davis';
    player2_email TEXT := 'player2@team.edu';
BEGIN
    -- Create auth users (bcrypt via pgcrypto). Keep role/aud='authenticated'
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES
        (coach_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         coach_email, crypt('password123', gen_salt('bf', 10)), now(),
         now(), now(),
         jsonb_build_object('data', jsonb_build_object('firstName','Coach','lastName','Johnson','schoolName','University A','allergies',''), 'email', coach_email, 'email_verified', true, 'phone_verified', false),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (player1_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         player1_email, crypt('password123', gen_salt('bf', 10)), now(),
         now(), now(),
         jsonb_build_object('data', jsonb_build_object('firstName','Alex','lastName','Smith','schoolName','University A','allergies','Peanuts'), 'email', player1_email, 'email_verified', true, 'phone_verified', false),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (player2_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         player2_email, crypt('password123', gen_salt('bf', 10)), now(),
         now(), now(),
         jsonb_build_object('data', jsonb_build_object('firstName','Taylor','lastName','Davis','schoolName','University A','allergies',''), 'email', player2_email, 'email_verified', true, 'phone_verified', false),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
    ON CONFLICT (id) DO NOTHING;

    -- Deterministic profile upsert (don’t rely on auth trigger timing)
    INSERT INTO public.user_profiles (id, email, first_name, last_name, school_name, is_active)
    VALUES
      (coach_uuid,   coach_email,   'Coach',  'Johnson', 'University A', true),
      (player1_uuid, player1_email, 'Alex',   'Smith',   'University A', true),
      (player2_uuid, player2_email, 'Taylor', 'Davis',   'University A', true)
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          school_name = EXCLUDED.school_name,
          updated_at = now();

    -- Team & members (coach_id needs user_profiles row present — satisfied above)
    INSERT INTO public.teams (id, name, sport, conference_name, gender, coach_id)
    VALUES (team_uuid, 'Warriors', 'Basketball', 'PAC-12', 'womens', coach_uuid);

    INSERT INTO public.team_members (team_id, user_id, role, full_name, email, phone_number, birthday)
    VALUES
      (team_uuid, coach_uuid,  'coach',  coach_name,  coach_email,  '(408) 439-2894', '1980-09-03'),
      (team_uuid, player1_uuid,'player', player1_name,player1_email,'(555) 987-6543', '2000-09-06'),
      (team_uuid, player2_uuid,'player', player2_name,player2_email,'(555) 111-2222', '2001-08-30');

    SELECT id INTO coach_tm_id
    FROM public.team_members
    WHERE team_id = team_uuid AND user_id = coach_uuid;

    SELECT id INTO player1_tm_id
    FROM public.team_members
    WHERE team_id = team_uuid AND user_id = player1_uuid;

    SELECT id INTO player2_tm_id
    FROM public.team_members
    WHERE team_id = team_uuid AND user_id = player2_uuid;

    -- Create member groups (explicit created_by avoids trigger/auth.uid() being NULL)
    INSERT INTO public.member_groups (id, team_id, name, created_by)
    VALUES
      (grp_players_uuid, team_uuid, 'Players',  coach_uuid),
      (grp_coaches_uuid, team_uuid, 'Coaches',  coach_uuid);

    -- Add members to groups
    INSERT INTO public.member_group_members (group_id, member_id) VALUES
      (grp_players_uuid, player1_tm_id),
      (grp_players_uuid, player2_tm_id),
      (grp_coaches_uuid, coach_tm_id);

    -- Location
    INSERT INTO public.saved_locations (id, team_id, name, address, location_type)
    VALUES (location_uuid, team_uuid, 'School Campus Dorms', '456 University Dr, Anytown, CA 90210', 'school'::public.location_type);

     -- API Integrations
    INSERT INTO public.api_integrations (id, provider_name, api_key, base_url)
    VALUES (api_integration_ubereats_uuid, 'ubereats', 'YOUR_UBEREATS_API_KEY', 'https://api.ubereats.com');

    -- Restaurants
    INSERT INTO public.restaurants (id, location_id, name, cuisine_type, phone_number, is_favorite, supports_catering, api_id, api_source, address, image_url, rating, delivery_fee, minimum_order, is_available) VALUES
      (pizza_palace_rest_uuid, location_uuid, 'Pizza Palace', 'Italian', '(123) 456-7890', true,  true,  'ubereats_pizza_palace_123', 'ubereats', '789 Main St, Anytown, CA 90210', 'https://example.com/pizza_palace.jpg', 4.5, 2.99, 15.00, true),
      (burger_joint_rest_uuid, location_uuid, 'Burger Joint',  'American','(987) 654-3210', false, false, 'ubereats_burger_joint_456',  'ubereats', '101 Oak Ave, Anytown, CA 90210', 'https://example.com/burger_joint.jpg',  4.2, 1.99, 10.00, true);

    -- Menu items
    INSERT INTO public.menu_items
      (id, restaurant_id, api_id, name, description, price, category, image_url, is_available, options_json)
    VALUES
      (pizza_menu_item_uuid, pizza_palace_rest_uuid, 'pizza_palace_margherita', 'Margherita Pizza', 'Classic Margherita with fresh basil', 15.99, 'Pizzas', 'https://example.com/margherita.jpg', true,
       '{"sizes":[{"name":"Small","price":13.99},{"name":"Medium","price":15.99},{"name":"Large","price":17.99}],"toppings":[{"name":"Pepperoni","price":2.00},{"name":"Mushrooms","price":1.50}]}'::jsonb),
      (salad_menu_item_uuid, pizza_palace_rest_uuid, 'pizza_palace_caesar_salad', 'Caesar Salad', 'Fresh Caesar salad with croutons', 12.01, 'Salads', 'https://example.com/caesar_salad.jpg', true,
       '{"dressings":[{"name":"Caesar"},{"name":"Ranch"}]}'::jsonb);

    INSERT INTO public.menu_items
      (id, restaurant_id, api_id, name, description, price, category, image_url, is_available)
    VALUES
      (burger_menu_item_uuid, burger_joint_rest_uuid, 'burger_joint_classic', 'Classic Cheeseburger', 'Classic cheeseburger with fries', 14.50, 'Burgers', 'https://example.com/classic_burger.jpg', true);

    -- Payment method 
    INSERT INTO public.payment_methods (id, team_id, card_name, last_four, is_default, created_by)
    VALUES (payment_method_uuid, team_uuid, 'Team Card - Basketball', '4242', true, coach_uuid);

    -- Completed order 
    INSERT INTO public.meal_orders (
        id, team_id, restaurant_id, location_id, title, description,
        scheduled_date, order_status, payment_method_id, total_amount, payment_status, created_by,
        api_order_id, api_source, delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip,
        delivery_instructions, estimated_delivery_at, delivery_fee_charged, service_fee_charged
    ) VALUES
      (completed_order_uuid, team_uuid, pizza_palace_rest_uuid, location_uuid,
       'Team Lunch - Last Week', 'Post-game meal for the team (completed)',
       NOW() - INTERVAL '4 days', 'completed', payment_method_uuid, 45.99, 'completed', coach_uuid,
       'UBEREATS-ORDER-XYZ789', 'ubereats', '456 University Dr', 'Dorm Room 302', 'Anytown', 'CA', '90210',
       'Leave at front desk with security', NOW() - INTERVAL '3 days 1 hour', 2.99, 1.50);
    INSERT INTO public.order_items (order_id, user_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options) VALUES
      (completed_order_uuid, player1_uuid, pizza_menu_item_uuid, 'Margherita Pizza', 1, 15.99, 'No olives', '{"size":"Medium","toppings":["Pepperoni"]}'::jsonb),
      (completed_order_uuid, player2_uuid, pizza_menu_item_uuid, 'Margherita Pizza', 1, 17.99, 'Extra cheese', '{"size":"Large","toppings":["Extra Cheese"]}'::jsonb),
      (completed_order_uuid, coach_uuid,   salad_menu_item_uuid, 'Caesar Salad',     1, 12.01, 'Side of ranch', '{"dressing":"Ranch"}'::jsonb);

    -- Scheduled order
    INSERT INTO public.meal_orders (
        id, team_id, restaurant_id, location_id, title, description,
        scheduled_date, order_status, payment_method_id, total_amount, payment_status, created_by,
        api_order_id, api_source, delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip,
        delivery_instructions, estimated_delivery_at, delivery_fee_charged, service_fee_charged
    ) VALUES
      (scheduled_order_uuid, team_uuid, burger_joint_rest_uuid, location_uuid,
       'Team Dinner - Next Week', 'Weekly team dinner for practice',
       NOW() + INTERVAL '7 days', 'scheduled', payment_method_uuid, 65.25, 'pending', coach_uuid,
       'UBEREATS-ORDER-ABC123', 'ubereats', '456 University Dr', 'Field House', 'Anytown', 'CA', '90210',
       'Deliver to side entrance of field house', NOW() + INTERVAL '7 days 2 hours', 3.50, 2.00);

    INSERT INTO public.order_items (order_id, user_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options) VALUES
      (scheduled_order_uuid, player1_uuid, burger_menu_item_uuid, 'Classic Cheeseburger', 2, 14.50, 'No pickles', '{"buns":"sesame","cheese":"cheddar"}'::jsonb),
      (scheduled_order_uuid, player2_uuid, burger_menu_item_uuid, 'Classic Cheeseburger', 1, 14.50, 'Extra onion rings', '{"buns":"brioche"}'::jsonb);

    -- Two orders this week
     INSERT INTO public.meal_orders (
        id, team_id, restaurant_id, location_id, title, description,
        scheduled_date, order_status, payment_method_id, total_amount, payment_status, created_by,
        api_order_id, api_source, delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip,
        delivery_instructions, estimated_delivery_at, delivery_fee_charged, service_fee_charged
    ) VALUES
      (this_week_order_1, team_uuid, pizza_palace_rest_uuid, location_uuid,
       'Film Session Lunch', 'Lunch during film session',
       NOW() + INTERVAL '1 day', 'scheduled', payment_method_uuid, 58.97, 'pending', coach_uuid,
       'UBEREATS-ORDER-THISWEEK-1', 'ubereats', '456 University Dr', 'Athletics Office', 'Anytown', 'CA', '90210',
       'Call when arriving', NOW() + INTERVAL '1 day 90 minutes', 2.99, 1.50),
      (this_week_order_2, team_uuid, burger_joint_rest_uuid, location_uuid,
       'Shootaround Snacks', 'Pre-practice snacks',
       NOW() + INTERVAL '3 days', 'scheduled', payment_method_uuid, 43.50, 'pending', coach_uuid,
       'UBEREATS-ORDER-THISWEEK-2', 'ubereats', '456 University Dr', 'Field House', 'Anytown', 'CA', '90210',
       'Deliver to side entrance', NOW() + INTERVAL '3 days 2 hours', 1.99, 1.00);

    INSERT INTO public.order_items (order_id, user_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options) VALUES
      (this_week_order_1, player1_uuid, pizza_menu_item_uuid,  'Margherita Pizza', 2, 15.99, 'Well done',  '{"size":"Medium"}'::jsonb),
      (this_week_order_1, coach_uuid,   salad_menu_item_uuid,  'Caesar Salad',     1, 12.01, 'Dressing on side', '{"dressing":"Caesar"}'::jsonb),
      (this_week_order_2, player2_uuid, burger_menu_item_uuid, 'Classic Cheeseburger', 3, 14.50, 'No pickles',  '{"buns":"sesame"}'::jsonb);

    INSERT INTO public.meal_order_items (order_id, product_id, name, description, image_url, notes, quantity, product_marked_price_cents)
    VALUES (completed_order_uuid,'pizza_palace_margherita','Margherita Pizza','Medium',NULL,'No olives',1,1599)
    RETURNING id INTO mo_item_1;

    -- Customization: Size -> Medium (no upcharge)
    INSERT INTO public.meal_order_item_customizations (order_item_id, name)
    VALUES (mo_item_1, 'Size')
    RETURNING id INTO cz_size;

    INSERT INTO public.meal_order_item_options (
        customization_id, option_id, name, price_cents, quantity, metadata
    )
    VALUES (cz_size, 'size_medium', 'Medium', 0, 1, '{}'::jsonb);

    -- Customization: Toppings -> Pepperoni (+$2.00)
    INSERT INTO public.meal_order_item_customizations (order_item_id, name)
    VALUES (mo_item_1, 'Toppings')
    RETURNING id INTO cz_toppings;

    INSERT INTO public.meal_order_item_options (customization_id, option_id, name, price_cents, quantity, metadata)
    VALUES (cz_toppings, 'top_pepperoni', 'Pepperoni', 200, 1, '{}'::jsonb);

    -- Poll
    INSERT INTO public.meal_polls (id, team_id, title, description, expires_at, created_by)
    VALUES (poll_uuid, team_uuid, 'Next Week Dinner Choice', 'Choose our restaurant for next Friday dinner', NOW() + INTERVAL '2 days', coach_uuid);

    INSERT INTO public.poll_options (id, poll_id, restaurant_name, cuisine_type, description) VALUES
      (option1_uuid, poll_uuid, 'Subway',        'American', 'Fresh sandwiches and salads'),
      (option2_uuid, poll_uuid, 'Panda Express', 'Chinese',  'Asian cuisine with variety');

    INSERT INTO public.poll_votes (poll_id, option_id, user_id)
    VALUES (poll_uuid, option1_uuid, player1_uuid);

    -- Get an existing location ID
    SELECT id INTO existing_location_id FROM public.saved_locations LIMIT 1;
    
    -- Add sample addresses if location exists
    IF existing_location_id IS NOT NULL THEN
        INSERT INTO public.location_addresses (location_id, name, address, address_type, is_primary, notes)
        VALUES
            (existing_location_id, 'Main Entrance', '123 School Ave - Main Building', 'school'::public.location_type, true, 'Primary delivery entrance with security desk'),
            (existing_location_id, 'Athletic Center', '123 School Ave - Athletic Wing', 'gym'::public.location_type, false, 'Delivery through gym entrance during events'),
            (existing_location_id, 'Student Union', '123 School Ave - Student Center', 'venue'::public.location_type, false, 'Catering deliveries to main desk');
    END IF;

EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'Foreign key error: %', SQLERRM;
  WHEN unique_violation THEN
    RAISE NOTICE 'Unique constraint error: %', SQLERRM;
  WHEN OTHERS THEN
    RAISE NOTICE 'Unexpected error: %', SQLERRM;
END $$;