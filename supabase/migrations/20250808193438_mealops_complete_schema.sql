-- Location: supabase/migrations/20250808193438_mealops_complete_schema.sql
-- Schema Analysis: Extending existing schema for API integration
-- Integration Type: Modifications and new table creation
-- Dependencies: None (fresh project based on previous state)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Extensions & Types (UPDATED)
CREATE TYPE public.team_role AS ENUM ('player', 'coach', 'staff');
CREATE TYPE public.order_status AS ENUM ('draft', 'scheduled', 'pending_confirmation', 'confirmed', 'preparing', 'out_for_delivery', 'completed', 'cancelled', 'failed'); -- Added more granular statuses
CREATE TYPE public.poll_status AS ENUM ('active', 'completed', 'expired');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE public.location_type AS ENUM ('school', 'hotel', 'gym', 'venue', 'other');
CREATE TYPE public.api_source_type AS ENUM ('ubereats', 'mealme', 'manual'); -- NEW: To specify which API or if manually added

-- 2. Core Tables (UPDATED)
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,  
    school_name TEXT NOT NULL,
    phone TEXT,
    allergies TEXT,
    birthday DATE,
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
    role public.team_role NOT NULL DEFAULT 'player',
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT,
    allergies TEXT,
    birthday DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
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

-- UPDATED: restaurants table with API integration fields and restored location_id
CREATE TABLE public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES public.saved_locations(id) ON DELETE CASCADE, -- Restored as per user's base schema
    name TEXT NOT NULL,
    cuisine_type TEXT,
    phone_number TEXT, -- Renamed from 'phone' for consistency
    is_favorite BOOLEAN DEFAULT false,
    supports_catering BOOLEAN DEFAULT false,
    notes TEXT,
    -- NEW API Integration Fields
    api_id TEXT UNIQUE, -- Unique ID from the external API (e.g., UberEats restaurant ID)
    api_source public.api_source_type, -- Which API this restaurant data came from
    address TEXT, -- Main address, might be from API, can be derived from location_id too
    image_url TEXT, -- URL for restaurant logo/banner
    website_url TEXT,
    rating DECIMAL(2,1), -- Average rating from the API
    delivery_fee DECIMAL(8,2),
    minimum_order DECIMAL(8,2),
    is_available BOOLEAN DEFAULT TRUE, -- Current availability from API
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP -- Added updated_at
);

-- NEW: menu_items table
CREATE TABLE public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    api_id TEXT UNIQUE, -- Unique ID for the menu item from the external API
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(8,2) NOT NULL,
    category TEXT, -- e.g., 'Main Dishes', 'Sides', 'Drinks'
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    options_json JSONB, -- Store complex menu options as raw JSON from the API (e.g., sizes, toppings)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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

-- UPDATED: meal_orders table with API integration fields
CREATE TABLE public.meal_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.saved_locations(id) ON DELETE SET NULL, -- Keeping this for internal location tracking
    title TEXT NOT NULL,
    description TEXT,
    scheduled_date TIMESTAMPTZ NOT NULL, -- The time the user wants the order for
    order_status public.order_status DEFAULT 'draft'::public.order_status,
    payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
    total_amount DECIMAL(10,2),
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    -- NEW API Integration Fields
    api_order_id TEXT UNIQUE, -- The ID returned by the external API for this order
    api_source public.api_source_type, -- Which API the order was placed through
    delivery_address_line1 TEXT NOT NULL,
    delivery_address_line2 TEXT,
    delivery_city TEXT NOT NULL,
    delivery_state TEXT NOT NULL,
    delivery_zip TEXT NOT NULL,
    delivery_instructions TEXT,
    estimated_delivery_at TIMESTAMPTZ, -- API's estimated delivery time
    actual_delivery_at TIMESTAMPTZ, -- Actual delivery time
    delivery_fee_charged DECIMAL(8,2),
    service_fee_charged DECIMAL(8,2)
);

-- UPDATED: order_items table to link to menu_items
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.meal_orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL, -- NEW: Link to structured menu item
    item_name TEXT NOT NULL, -- Kept as a fallback/display name for now
    quantity INTEGER DEFAULT 1,
    price DECIMAL(8,2), -- Price at the time of order
    special_instructions TEXT,
    selected_options JSONB, -- NEW: Store selected options/modifications (e.g., "no onions", "extra cheese")
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.meal_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    poll_status public.poll_status DEFAULT 'active'::public.poll_status,
    target_roles public.team_role[] DEFAULT ARRAY['player'::public.team_role],
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

-- NEW: api_integrations table for managing API keys/tokens
CREATE TABLE public.api_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name public.api_source_type NOT NULL UNIQUE,
    api_key TEXT, -- Should be securely managed (e.g., env variables, encrypted)
    secret_key TEXT,
    auth_token TEXT,
    token_expires_at TIMESTAMPTZ,
    base_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- 3. Essential Indexes (UPDATED)
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_teams_coach_id ON public.teams(coach_id);
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_members_team_id_active ON public.team_members(team_id, is_active);
CREATE INDEX idx_saved_locations_team_id ON public.saved_locations(team_id);

-- UPDATED: Restaurants indexes
CREATE INDEX idx_restaurants_name ON public.restaurants(name);
CREATE INDEX idx_restaurants_location_id ON public.restaurants(location_id); -- Restored index
CREATE INDEX idx_restaurants_api_id ON public.restaurants(api_id); -- NEW
CREATE INDEX idx_restaurants_api_source ON public.restaurants(api_source); -- NEW

-- NEW: menu_items indexes
CREATE INDEX idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);
CREATE INDEX idx_menu_items_api_id ON public.menu_items(api_id);

CREATE INDEX idx_meal_orders_team_id ON public.meal_orders(team_id);
CREATE INDEX idx_meal_orders_scheduled_date ON public.meal_orders(scheduled_date);
CREATE INDEX idx_meal_orders_status ON public.meal_orders(order_status);
CREATE INDEX idx_meal_orders_api_order_id ON public.meal_orders(api_order_id); -- NEW

-- UPDATED: order_items indexes
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_user_id ON public.order_items(user_id);
CREATE INDEX idx_order_items_menu_item_id ON public.order_items(menu_item_id); -- NEW

CREATE INDEX idx_meal_polls_team_id ON public.meal_polls(team_id);
CREATE INDEX idx_meal_polls_status ON public.meal_polls(poll_status);
CREATE INDEX idx_poll_votes_poll_id ON public.poll_votes(poll_id);
CREATE INDEX idx_payment_methods_team_id ON public.payment_methods(team_id);
CREATE UNIQUE INDEX uniq_team_member_email_per_team
    ON public.team_members (team_id, lower(email));

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

-- attach to tables that have updated_at
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

-- NEW: Triggers for new tables
CREATE TRIGGER trg_restaurants_updated_at
BEFORE UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_menu_items_updated_at
BEFORE UPDATE ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_api_integrations_updated_at
BEFORE UPDATE ON public.api_integrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


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
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY; -- NEW
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_spreadsheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY; -- NEW

-- 6. RLS Policies (UPDATED)
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


-- ------------------------------
-- RESTAURANTS (RLS)
-- ------------------------------
DROP POLICY IF EXISTS "team_members_view_restaurants"   ON public.restaurants;
DROP POLICY IF EXISTS "coaches_insert_restaurants"      ON public.restaurants;
DROP POLICY IF EXISTS "coaches_update_restaurants"      ON public.restaurants;
DROP POLICY IF EXISTS "coaches_delete_restaurants"      ON public.restaurants;

-- Team members (incl. coach) can read restaurants tied to their team's saved_locations
CREATE POLICY "team_members_view_restaurants"
ON public.restaurants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.saved_locations sl
    WHERE sl.id = restaurants.location_id
      AND (public.is_team_member(sl.team_id) OR public.is_team_admin(sl.team_id))
  )
);

-- Coach can INSERT a restaurant if its location belongs to their team
CREATE POLICY "coaches_insert_restaurants"
ON public.restaurants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.saved_locations sl
    WHERE sl.id = restaurants.location_id
      AND public.is_team_admin(sl.team_id)
  )
);

-- Coach can UPDATE if the row (old) is theirs; new row (with check) must also be theirs
CREATE POLICY "coaches_update_restaurants"
ON public.restaurants
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.saved_locations sl
    WHERE sl.id = restaurants.location_id       -- old row in USING
      AND public.is_team_admin(sl.team_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.saved_locations sl
    WHERE sl.id = restaurants.location_id       -- new row in WITH CHECK
      AND public.is_team_admin(sl.team_id)
  )
);

-- Coach can DELETE only their team’s restaurants
CREATE POLICY "coaches_delete_restaurants"
ON public.restaurants
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.saved_locations sl
    WHERE sl.id = restaurants.location_id
      AND public.is_team_admin(sl.team_id)
  )
);

-- ------------------------------
-- MENU ITEMS (RLS)
-- ------------------------------
DROP POLICY IF EXISTS "team_members_access_menu_items"  ON public.menu_items;
DROP POLICY IF EXISTS "coaches_insert_menu_items"       ON public.menu_items;
DROP POLICY IF EXISTS "coaches_update_menu_items"       ON public.menu_items;
DROP POLICY IF EXISTS "coaches_delete_menu_items"       ON public.menu_items;

-- Team members can read menu items if their team owns the restaurant’s location
CREATE POLICY "team_members_access_menu_items"
ON public.menu_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    JOIN public.saved_locations sl ON sl.id = r.location_id
    WHERE r.id = menu_items.restaurant_id
      AND (public.is_team_member(sl.team_id) OR public.is_team_admin(sl.team_id))
  )
);

-- Coach can INSERT menu items only for restaurants under their team
CREATE POLICY "coaches_insert_menu_items"
ON public.menu_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    JOIN public.saved_locations sl ON sl.id = r.location_id
    WHERE r.id = menu_items.restaurant_id
      AND public.is_team_admin(sl.team_id)
  )
);

-- Coach can UPDATE only items that belong to their team (old row) and remain so (new row)
CREATE POLICY "coaches_update_menu_items"
ON public.menu_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    JOIN public.saved_locations sl ON sl.id = r.location_id
    WHERE r.id = menu_items.restaurant_id        -- old row
      AND public.is_team_admin(sl.team_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    JOIN public.saved_locations sl ON sl.id = r.location_id
    WHERE r.id = menu_items.restaurant_id        -- new row
      AND public.is_team_admin(sl.team_id)
  )
);

-- Coach can DELETE only items under their team
CREATE POLICY "coaches_delete_menu_items"
ON public.menu_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    JOIN public.saved_locations sl ON sl.id = r.location_id
    WHERE r.id = menu_items.restaurant_id
      AND public.is_team_admin(sl.team_id)
  )
);



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

-- UPDATED: RLS for order_items, now referencing menu_items
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

-- NEW: RLS for api_integrations (only coaches or service_role can manage)
CREATE POLICY "coaches_view_api_integrations"
ON public.api_integrations
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.teams WHERE coach_id = auth.uid()));

CREATE POLICY "coaches_insert_api_integrations"
ON public.api_integrations
FOR INSERT
TO authenticated, service_role
WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams WHERE coach_id = auth.uid())
);

CREATE POLICY "coaches_update_api_integrations"
ON public.api_integrations
FOR UPDATE
TO authenticated, service_role
USING (EXISTS (SELECT 1 FROM public.teams WHERE coach_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.teams WHERE coach_id = auth.uid()));

CREATE POLICY "coaches_delete_api_integrations"
ON public.api_integrations
FOR DELETE
TO authenticated, service_role
USING (EXISTS (SELECT 1 FROM public.teams WHERE coach_id = auth.uid()));


-- 7. Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_user_auth_change
AFTER INSERT OR UPDATE OF email_confirmed_at, raw_user_meta_data ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();



-- 8. Mock Data (UPDATED)
DO $$
DECLARE
    coach_uuid UUID := gen_random_uuid();
    player1_uuid UUID := gen_random_uuid();
    player2_uuid UUID := gen_random_uuid();
    team_uuid UUID := gen_random_uuid();
    location_uuid UUID := gen_random_uuid();
    
    -- API-specific restaurant and menu item UUIDs for mock data
    pizza_palace_rest_uuid UUID := gen_random_uuid();
    pizza_menu_item_uuid UUID := gen_random_uuid();
    salad_menu_item_uuid UUID := gen_random_uuid();
    burger_joint_rest_uuid UUID := gen_random_uuid();
    burger_menu_item_uuid UUID := gen_random_uuid();

    payment_method_uuid UUID := gen_random_uuid();
    completed_order_uuid UUID := gen_random_uuid();
    scheduled_order_uuid UUID := gen_random_uuid();
    order_uuid UUID := gen_random_uuid();
    poll_uuid UUID := gen_random_uuid();
    option1_uuid UUID := gen_random_uuid();
    option2_uuid UUID := gen_random_uuid();
    api_integration_ubereats_uuid UUID := gen_random_uuid();

    coach_name TEXT;
    coach_email TEXT;
    player1_name TEXT;
    player1_email TEXT;
    player2_name TEXT;
    player2_email TEXT;
BEGIN
    -- Create auth users with required fields.
    -- IMPORTANT: For the trigger to work as expected, raw_user_meta_data
    -- must contain the profile fields (firstName, lastName, schoolName, etc.)
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
    INSERT INTO public.team_members (team_id, user_id, role, full_name, email, phone_number, birthday) VALUES
        (team_uuid, coach_uuid, 'coach', coach_name, coach_email, '(555) 123-4567', '1980-01-15'),
        (team_uuid, player1_uuid, 'player', player1_name, player1_email, '(555) 987-6543', '2000-03-20'),
        (team_uuid, player2_uuid, 'player', player2_name, player2_email, '(555) 111-2222', '2001-07-01');

    -- Create locations
    INSERT INTO public.saved_locations (id, team_id, name, address, location_type) VALUES
        (location_uuid, team_uuid, 'School Campus Dorms', '456 University Dr, Anytown, CA 90210', 'school'::public.location_type);
    
    -- NEW: API Integrations
    INSERT INTO public.api_integrations (id, provider_name, api_key, base_url) VALUES
        (api_integration_ubereats_uuid, 'ubereats', 'YOUR_UBEREATS_API_KEY', 'https://api.ubereats.com');

    -- UPDATED: Create restaurants with API data, linking to saved_location
    INSERT INTO public.restaurants (id, location_id, name, cuisine_type, phone_number, is_favorite, supports_catering, api_id, api_source, address, image_url, rating, delivery_fee, minimum_order, is_available) VALUES
        (pizza_palace_rest_uuid, location_uuid, 'Pizza Palace', 'Italian', '(123) 456-7890', true, true, 'ubereats_pizza_palace_123', 'ubereats', '789 Main St, Anytown, CA 90210', 'https://example.com/pizza_palace.jpg', 4.5, 2.99, 15.00, true),
        (burger_joint_rest_uuid, location_uuid, 'Burger Joint', 'American', '(987) 654-3210', false, false, 'ubereats_burger_joint_456', 'ubereats', '101 Oak Ave, Anytown, CA 90210', 'https://example.com/burger_joint.jpg', 4.2, 1.99, 10.00, true);

    -- NEW: Create menu_items for Pizza Palace
INSERT INTO public.menu_items
  (id, restaurant_id, api_id, name, description, price, category, image_url, is_available, options_json)
VALUES
  (
    pizza_menu_item_uuid,
    pizza_palace_rest_uuid,
    'pizza_palace_margherita',
    'Margherita Pizza',
    'Classic Margherita with fresh basil',
    15.99,
    'Pizzas',
    'https://example.com/margherita.jpg',
    true,
    '{"sizes":[{"name":"Small","price":13.99},{"name":"Medium","price":15.99},{"name":"Large","price":17.99}],"toppings":[{"name":"Pepperoni","price":2.00},{"name":"Mushrooms","price":1.50}]}'::jsonb
  ),
  (
    salad_menu_item_uuid,
    pizza_palace_rest_uuid,
    'pizza_palace_caesar_salad',
    'Caesar Salad',
    'Fresh Caesar salad with croutons',
    12.01,
    'Salads',
    'https://example.com/caesar_salad.jpg',
    true,
    '{"dressings":[{"name":"Caesar"},{"name":"Ranch"}]}'::jsonb
  );

-- NEW: Create menu_items for Burger Joint
INSERT INTO public.menu_items
  (id, restaurant_id, api_id, name, description, price, category, image_url, is_available)
VALUES
  (
    burger_menu_item_uuid,
    burger_joint_rest_uuid,
    'burger_joint_classic',
    'Classic Cheeseburger',
    'Classic cheeseburger with fries',
    14.50,
    'Burgers',
    'https://example.com/classic_burger.jpg',
    true
  );


    -- Create payment method
    INSERT INTO public.payment_methods (id, team_id, card_name, last_four, is_default, created_by) VALUES
        (payment_method_uuid, team_uuid, 'Team Card - Basketball', '4242', true, coach_uuid);

    -- UPDATED: Create a COMPLETED sample order with API data, linking to menu_items (date in the past)
    INSERT INTO public.meal_orders (
        id, team_id, restaurant_id, location_id, title, description,
        scheduled_date, order_status, payment_method_id, total_amount, payment_status, created_by,
        api_order_id, api_source, delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip,
        delivery_instructions, estimated_delivery_at, delivery_fee_charged, service_fee_charged
    ) VALUES
        (completed_order_uuid, team_uuid, pizza_palace_rest_uuid, location_uuid, 'Team Lunch - Last Week', 'Post-game meal for the team (completed)',
         NOW() - INTERVAL '4 days', 'completed'::public.order_status, payment_method_uuid, 45.99, 'completed'::public.payment_status, coach_uuid,
         'UBEREATS-ORDER-XYZ789', 'ubereats', '456 University Dr', 'Dorm Room 302', 'Anytown', 'CA', '90210',
         'Leave at front desk with security', NOW() - INTERVAL '3 days 1 hour', 2.99, 1.50);

    -- UPDATED: Insert into order_items for the COMPLETED order
    INSERT INTO public.order_items (order_id, user_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options) VALUES
        (completed_order_uuid, player1_uuid, pizza_menu_item_uuid, 'Margherita Pizza', 1, 15.99, 'No olives', '{"size": "Medium", "toppings": ["Pepperoni"]}'::jsonb),
        (completed_order_uuid, player2_uuid, pizza_menu_item_uuid, 'Margherita Pizza', 1, 17.99, 'Extra cheese', '{"size": "Large", "toppings": ["Extra Cheese"]}'::jsonb),
        (completed_order_uuid, coach_uuid, salad_menu_item_uuid, 'Caesar Salad', 1, 12.01, 'Side of ranch', '{"dressing": "Ranch"}'::jsonb);

    -- NEW: Create a SCHEDULED sample order with API data, linking to menu_items (date in the future)
    INSERT INTO public.meal_orders (
        id, team_id, restaurant_id, location_id, title, description,
        scheduled_date, order_status, payment_method_id, total_amount, payment_status, created_by,
        api_order_id, api_source, delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip,
        delivery_instructions, estimated_delivery_at, delivery_fee_charged, service_fee_charged
    ) VALUES
        (scheduled_order_uuid, team_uuid, burger_joint_rest_uuid, location_uuid, 'Team Dinner - Next Week', 'Weekly team dinner for practice',
         NOW() + INTERVAL '7 days', 'scheduled'::public.order_status, payment_method_uuid, 65.25, 'pending'::public.payment_status, coach_uuid,
         'UBEREATS-ORDER-ABC123', 'ubereats', '456 University Dr', 'Field House', 'Anytown', 'CA', '90210',
         'Deliver to side entrance of field house', NOW() + INTERVAL '7 days 2 hours', 3.50, 2.00);

    -- NEW: Insert into order_items for the SCHEDULED order
    INSERT INTO public.order_items (order_id, user_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options) VALUES
        (scheduled_order_uuid, player1_uuid, burger_menu_item_uuid, 'Classic Cheeseburger', 2, 14.50, 'No pickles', '{"buns": "sesame", "cheese": "cheddar"}'::jsonb),
        (scheduled_order_uuid, player2_uuid, burger_menu_item_uuid, 'Classic Cheeseburger', 1, 14.50, 'Extra onion rings', '{"buns": "brioche"}'::jsonb);


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