-- Location: supabase/migrations/20250808193438_mealops_complete_schema.sql
-- Schema Analysis: Fresh project - no existing schema
-- Integration Type: Complete new schema creation
-- Dependencies: None (fresh project)

-- 1. Extensions & Types
CREATE TYPE public.user_role AS ENUM ('admin', 'coach', 'player');
CREATE TYPE public.order_status AS ENUM ('draft', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.poll_status AS ENUM ('active', 'completed', 'expired');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE public.location_type AS ENUM ('school', 'hotel', 'gym', 'venue', 'other');

-- 2. Core Tables
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,  
    school_name TEXT NOT NULL,
    phone TEXT,
    allergies TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sport TEXT,
    conference_name TEXT,
    gender TEXT,
    coach_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT,
    allergies TEXT,
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

CREATE TABLE public.saved_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    location_type public.location_type DEFAULT 'school'::public.location_type,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES public.saved_locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cuisine_type TEXT,
    phone TEXT,
    is_favorite BOOLEAN DEFAULT false,
    supports_catering BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    card_name TEXT NOT NULL,
    last_four TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.meal_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.saved_locations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    scheduled_date TIMESTAMPTZ NOT NULL,
    order_status public.order_status DEFAULT 'draft'::public.order_status,
    payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
    total_amount DECIMAL(10,2),
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.meal_orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    price DECIMAL(8,2),
    special_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.meal_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    poll_status public.poll_status DEFAULT 'active'::public.poll_status,
    target_roles public.user_role[] DEFAULT ARRAY['player'::public.user_role],
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES public.meal_polls(id) ON DELETE CASCADE,
    restaurant_name TEXT NOT NULL,
    cuisine_type TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES public.meal_polls(id) ON DELETE CASCADE,
    option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(poll_id, user_id)
);

CREATE TABLE public.order_spreadsheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    restaurant_name TEXT,
    spreadsheet_data JSONB NOT NULL,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Essential Indexes
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_teams_coach_id ON public.teams(coach_id);
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_saved_locations_team_id ON public.saved_locations(team_id);
CREATE INDEX idx_restaurants_location_id ON public.restaurants(location_id);
CREATE INDEX idx_meal_orders_team_id ON public.meal_orders(team_id);
CREATE INDEX idx_meal_orders_scheduled_date ON public.meal_orders(scheduled_date);
CREATE INDEX idx_meal_orders_status ON public.meal_orders(order_status);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_user_id ON public.order_items(user_id);
CREATE INDEX idx_meal_polls_team_id ON public.meal_polls(team_id);
CREATE INDEX idx_meal_polls_status ON public.meal_polls(poll_status);
CREATE INDEX idx_poll_votes_poll_id ON public.poll_votes(poll_id);
CREATE INDEX idx_payment_methods_team_id ON public.payment_methods(team_id);

-- 4. Functions (must be before RLS policies)

-- Drop the old functions if they exist
DROP FUNCTION IF EXISTS public.handle_new_user_profile CASCADE;

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
                END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

CREATE OR REPLACE FUNCTION public.get_user_team_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT tm.team_id
FROM public.team_members tm
WHERE tm.user_id = auth.uid()
LIMIT 1
$$;

-- 5. Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_spreadsheets ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Pattern 1: Core user table (user_profiles)
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Allow inserts from auth system"
ON public.user_profiles
FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

-- Pattern 2: Team-based access for teams
CREATE POLICY "team_members_view_teams"
ON public.teams
FOR SELECT
TO authenticated
USING (public.is_team_member(id) OR coach_id = auth.uid());

CREATE POLICY "coaches_manage_teams"
ON public.teams
FOR ALL
TO authenticated
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

-- Pattern 2: Team membership management
CREATE POLICY "team_members_view_memberships"
ON public.team_members
FOR SELECT
TO authenticated
USING (public.is_team_member(team_id) OR public.is_team_admin(team_id));

CREATE POLICY "coaches_manage_memberships"
ON public.team_members
FOR ALL
TO authenticated
USING (public.is_team_admin(team_id))
WITH CHECK (public.is_team_admin(team_id));

-- Pattern 2: Team-based resources
CREATE POLICY "team_members_access_locations"
ON public.saved_locations
FOR ALL
TO authenticated
USING (public.is_team_member(team_id))
WITH CHECK (public.is_team_member(team_id));

CREATE POLICY "team_members_access_restaurants"
ON public.restaurants
FOR SELECT
TO authenticated
USING (public.is_team_member((SELECT team_id FROM public.saved_locations WHERE id = location_id)));

CREATE POLICY "team_members_manage_restaurants"
ON public.restaurants
FOR ALL
TO authenticated
USING (public.is_team_member((SELECT team_id FROM public.saved_locations WHERE id = location_id)))
WITH CHECK (public.is_team_member((SELECT team_id FROM public.saved_locations WHERE id = location_id)));

CREATE POLICY "team_members_access_payment_methods"
ON public.payment_methods
FOR ALL
TO authenticated
USING (public.is_team_member(team_id))
WITH CHECK (public.is_team_member(team_id));

CREATE POLICY "team_members_access_orders"
ON public.meal_orders
FOR ALL
TO authenticated
USING (public.is_team_member(team_id))
WITH CHECK (public.is_team_member(team_id));

CREATE POLICY "team_members_manage_order_items"
ON public.order_items
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR public.is_team_member((SELECT team_id FROM public.meal_orders WHERE id = order_id)))
WITH CHECK (user_id = auth.uid() OR public.is_team_member((SELECT team_id FROM public.meal_orders WHERE id = order_id)));

CREATE POLICY "team_members_access_polls"
ON public.meal_polls
FOR ALL
TO authenticated
USING (public.is_team_member(team_id))
WITH CHECK (public.is_team_member(team_id));

CREATE POLICY "team_members_view_poll_options"
ON public.poll_options
FOR SELECT
TO authenticated
USING (public.is_team_member((SELECT team_id FROM public.meal_polls WHERE id = poll_id)));

CREATE POLICY "coaches_manage_poll_options"
ON public.poll_options
FOR ALL
TO authenticated
USING (public.is_team_admin((SELECT team_id FROM public.meal_polls WHERE id = poll_id)))
WITH CHECK (public.is_team_admin((SELECT team_id FROM public.meal_polls WHERE id = poll_id)));

CREATE POLICY "users_manage_own_votes"
ON public.poll_votes
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "team_members_access_spreadsheets"
ON public.order_spreadsheets
FOR ALL
TO authenticated
USING (public.is_team_member(team_id))
WITH CHECK (public.is_team_member(team_id));

-- 7. Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_user_auth_change
AFTER INSERT OR UPDATE OF email_confirmed_at, raw_user_meta_data ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();


-- 8. Mock Data
DO $$
DECLARE
    coach_uuid UUID := gen_random_uuid();
    player1_uuid UUID := gen_random_uuid();
    player2_uuid UUID := gen_random_uuid();
    team_uuid UUID := gen_random_uuid();
    location_uuid UUID := gen_random_uuid();
    restaurant_uuid UUID := gen_random_uuid();
    payment_method_uuid UUID := gen_random_uuid();
    order_uuid UUID := gen_random_uuid();
    poll_uuid UUID := gen_random_uuid();
    option1_uuid UUID := gen_random_uuid();
    option2_uuid UUID := gen_random_uuid();
    coach_name TEXT;
    coach_email TEXT;
    player1_name TEXT;
    player1_email TEXT;
    player2_name TEXT;
    player2_email TEXT;
BEGIN
    -- Create auth users with required fields.
    -- IMPORTANT: For the trigger to work as expected, raw_user_meta_data
    -- must contain the profile fields (fullName, schoolName, etc.)
    -- and email_confirmed_at must be set to a timestamp if you want the profile created immediately.
    INSERT INTO auth.users (
        id, instance_id, aud, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES
        (coach_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'coach@team.edu', crypt('password123', gen_salt('bf', 10)), now(), now(), now(),
         -- CORRECTED raw_user_meta_data: Added 'data' nesting, 'email', 'email_verified', 'phone_verified', 'phone', 'allergies'
         '{"data": {"firstName": "Coach", "lastName": "Johnson", "schoolName": "University A", "allergies": ""}, "email": "coach@team.edu", "email_verified": true, "phone_verified": false}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (player1_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'player1@team.edu', crypt('password123', gen_salt('bf', 10)), now(), now(), now(),
         -- CORRECTED raw_user_meta_data
         '{"data": {"firstName": "Alex", "lastName": "Smith", "schoolName": "University A", "allergies": "Peanuts"}, "email": "player1@team.edu", "email_verified": true, "phone_verified": false}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (player2_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'player2@team.edu', crypt('password123', gen_salt('bf', 10)), now(), now(), now(),
         -- CORRECTED raw_user_meta_data
         '{"data": {"firstName": "Taylor", "lastName": "Davis", "schoolName": "University A", "allergies": ""}, "email": "player2@team.edu", "email_verified": true, "phone_verified": false}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null);

    
     PERFORM pg_sleep(1);

    -- Get user data from user_profiles table
    SELECT first_name || ' ' || last_name, email INTO coach_name, coach_email FROM public.user_profiles WHERE id = coach_uuid;
    SELECT first_name || ' ' || last_name, email INTO player1_name, player1_email FROM public.user_profiles WHERE id = player1_uuid;
    SELECT first_name || ' ' || last_name, email INTO player2_name, player2_email FROM public.user_profiles WHERE id = player2_uuid;

    -- Create team and team structure
    INSERT INTO public.teams (id, name, sport, conference_name, gender, coach_id) VALUES
        (team_uuid, 'Warriors Basketball', 'Basketball', 'PAC-12', 'womens', coach_uuid);

    -- Correctly insert into team_members with non-null values for full_name and email
    INSERT INTO public.team_members (team_id, user_id, role, full_name, email) VALUES
        (team_uuid, coach_uuid, 'coach', coach_name, coach_email),
        (team_uuid, player1_uuid, 'player', player1_name, player1_email),
        (team_uuid, player2_uuid, 'player', player2_name, player2_email);
    -- Create locations and restaurants
    INSERT INTO public.saved_locations (id, team_id, name, address, location_type) VALUES
        (location_uuid, team_uuid, 'School Campus', '123 School Ave', 'school'::public.location_type);

    INSERT INTO public.restaurants (id, location_id, name, cuisine_type, is_favorite, supports_catering) VALUES
        (restaurant_uuid, location_uuid, 'Pizza Palace', 'Italian', true, true);

    -- Create payment method
    INSERT INTO public.payment_methods (id, team_id, card_name, last_four, is_default, created_by) VALUES
        (payment_method_uuid, team_uuid, 'Team Card - Basketball', '4242', true, coach_uuid);

    -- Create sample order
    INSERT INTO public.meal_orders (id, team_id, restaurant_id, location_id, title, scheduled_date, order_status, payment_method_id, total_amount, created_by) VALUES
        (order_uuid, team_uuid, restaurant_uuid, location_uuid, 'Team Lunch - Friday', NOW() + INTERVAL '3 days', 'scheduled'::public.order_status, payment_method_uuid, 45.99, coach_uuid);

    INSERT INTO public.order_items (order_id, user_id, item_name, quantity, price) VALUES
        (order_uuid, player1_uuid, 'Margherita Pizza', 1, 15.99),
        (order_uuid, player2_uuid, 'Pepperoni Pizza', 1, 17.99),
        (order_uuid, coach_uuid, 'Caesar Salad', 1, 12.01);

    -- Create sample poll
    INSERT INTO public.meal_polls (id, team_id, title, description, expires_at, created_by) VALUES
        (poll_uuid, team_uuid, 'Next Week Dinner Choice', 'Choose our restaurant for next Friday dinner', NOW() + INTERVAL '2 days', coach_uuid);

    INSERT INTO public.poll_options (id, poll_id, restaurant_name, cuisine_type, description) VALUES
        (option1_uuid, poll_uuid, 'Subway', 'American', 'Fresh sandwiches and salads'),
        (option2_uuid, poll_uuid, 'Panda Express', 'Chinese', 'Asian cuisine with variety');

    INSERT INTO public.poll_votes (poll_id, option_id, user_id) VALUES
        (poll_uuid, option1_uuid, player1_uuid);

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key error: %', SQLERRM;
    WHEN unique_violation THEN
        RAISE NOTICE 'Unique constraint error: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Unexpected error: %', SQLERRM;
END $$;