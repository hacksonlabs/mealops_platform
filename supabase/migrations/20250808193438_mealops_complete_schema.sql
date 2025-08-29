-- Location: supabase/migrations/20250808193438_mealops_complete_schema.sql
-- Schema Analysis: Extending existing schema for API integration
-- Integration Type: Modifications and new table creation
-- Dependencies: None (fresh project based on previous state)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Extensions & Types
CREATE TYPE public.team_role AS ENUM ('player', 'coach', 'staff');
CREATE TYPE public.order_status AS ENUM ('draft', 'scheduled', 'pending_confirmation', 'confirmed', 'preparing', 'out_for_delivery', 'completed', 'cancelled', 'failed'); -- Added more granular statuses
CREATE TYPE public.poll_status AS ENUM ('active', 'completed', 'expired');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE public.location_type AS ENUM ('school', 'hotel', 'gym', 'venue', 'other');
CREATE TYPE public.api_source_type AS ENUM ('ubereats', 'mealme', 'doordash', 'grubhub', 'manual');
CREATE TYPE public.fulfillment_method AS ENUM ('delivery', 'pickup', 'dine-in');

-- 2. Core Tables
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

-- restaurants table with API integration fields and restored location_id
CREATE TABLE public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES public.saved_locations(id) ON DELETE CASCADE, -- Restored as per user's base schema
    name TEXT NOT NULL,
    cuisine_type TEXT,
    phone_number TEXT,
    is_favorite BOOLEAN DEFAULT false,
    supports_catering BOOLEAN DEFAULT false,
    notes TEXT,
    -- API Integration Fields
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
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP 
);

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

-- the parent row for an order. One row per order placed (or drafted) with a vendor. (money stored in *_cents while legacy decimals remain)
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
    -- API Integration Fields
    api_order_id TEXT, -- The ID returned by the external API for this order
    api_source public.api_source_type, -- Which API the order was placed through
    tracking_link TEXT,
    api_store_id TEXT,
    api_quote_id TEXT,
    is_sandbox BOOLEAN,
    order_placed BOOLEAN,
    -- Fulfillment & tips
    fulfillment_method public.fulfillment_method,
    -- pickup BOOLEAN,
    driver_tip_cents INTEGER,
    pickup_tip_cents INTEGER,
    -- Contact / requester
    -- user_name TEXT,
    -- user_email TEXT,
    -- user_phone TEXT,
    -- Delivery address
    delivery_address_line1 TEXT,
    delivery_address_line2 TEXT,
    delivery_city TEXT,
    delivery_state TEXT,
    delivery_zip TEXT,
    delivery_latitude DECIMAL(10, 8),
    delivery_longitude DECIMAL(11, 8),
    delivery_instructions TEXT,
    user_pickup_notes TEXT,
    -- disable_sms BOOLEAN DEFAULT FALSE,
    -- ETA / timing
    estimated_delivery_at TIMESTAMPTZ,         
    expected_arrival_at TIMESTAMPTZ,                
    actual_delivery_at TIMESTAMPTZ,           
    delivery_time_min_minutes INTEGER,
    delivery_time_max_minutes INTEGER,
    -- Totals (in cents)
    subtotal_cents INTEGER,
    delivery_fee_cents INTEGER,
    service_fee_cents INTEGER,
    small_order_fee_cents INTEGER,
    sales_tax_cents INTEGER,
    total_without_tips_cents INTEGER,
    tip_cents INTEGER,
    total_with_tip_cents INTEGER,
    -- Added fee (email receipt spec / response.added_fees)
    added_fee_flat_cents INTEGER,
    added_fee_percent_bps INTEGER,                     -- basis points, e.g., 50 = 0.50%
    -- added_fee_total_cents INTEGER,
    -- added_fee_sales_tax_cents INTEGER,
    -- added_fee_is_taxable BOOLEAN,
    -- Request flags
    place_order BOOLEAN,
    charge_user BOOLEAN,
    include_final_quote BOOLEAN,
    favorited BOOLEAN,
    enable_substitution BOOLEAN,
    autofill_selected_options BOOLEAN,
    -- Email receipt flags
    email_prices_marked BOOLEAN,
    email_unify_service_fee BOOLEAN,
    email_disable BOOLEAN,
    -- Snapshots / payloads
    request_payload  JSONB,
    response_payload JSONB,
    final_quote_json JSONB,
    -- Currency
    currency_code TEXT DEFAULT 'USD',
    -- legacy per-order fee decimals (kept for backward compat)
    delivery_fee_charged DECIMAL(8,2),
    service_fee_charged DECIMAL(8,2),

    -- -------- CHECK CONSTRAINTS --------
    CONSTRAINT ck_meal_orders_money_nonnegative CHECK (
      (subtotal_cents            IS NULL OR subtotal_cents            >= 0) AND
      (delivery_fee_cents        IS NULL OR delivery_fee_cents        >= 0) AND
      (service_fee_cents         IS NULL OR service_fee_cents         >= 0) AND
      (small_order_fee_cents     IS NULL OR small_order_fee_cents     >= 0) AND
      (sales_tax_cents           IS NULL OR sales_tax_cents           >= 0) AND
      (total_without_tips_cents  IS NULL OR total_without_tips_cents  >= 0) AND
      (tip_cents                 IS NULL OR tip_cents                 >= 0) AND
      (total_with_tip_cents      IS NULL OR total_with_tip_cents      >= 0) AND
      (driver_tip_cents          IS NULL OR driver_tip_cents          >= 0) AND
      (pickup_tip_cents          IS NULL OR pickup_tip_cents          >= 0)
    ),
    CONSTRAINT ck_meal_orders_added_fee_percent CHECK (
      added_fee_percent_bps IS NULL OR (added_fee_percent_bps BETWEEN 0 AND 10000)
    ),
    CONSTRAINT ck_meal_orders_lat CHECK (
      delivery_latitude IS NULL OR (delivery_latitude BETWEEN -90 AND 90)
    ),
    CONSTRAINT ck_meal_orders_lng CHECK (
      delivery_longitude IS NULL OR (delivery_longitude BETWEEN -180 AND 180)
    ),
    -- If it’s delivery, require an address.
    CONSTRAINT ck_meal_orders_delivery_address_required CHECK (
      fulfillment_method <> 'delivery'
      OR (
        delivery_address_line1 IS NOT NULL
        AND delivery_city      IS NOT NULL
        AND delivery_state     IS NOT NULL
        AND delivery_zip       IS NOT NULL
      )
    ),
    -- Don’t allow pickup tips on delivery, or driver tips on pickup
    CONSTRAINT ck_meal_orders_tip_consistency CHECK (
      (fulfillment_method <> 'delivery' OR COALESCE(pickup_tip_cents,0) = 0) AND
      (fulfillment_method <> 'pickup'   OR COALESCE(driver_tip_cents,0) = 0)
    )
);

-- a snapshot of items user selected from the vendor (what we send in items and what comes back in the quote).
CREATE TABLE public.meal_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.meal_orders(id) ON DELETE CASCADE,
  product_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  notes TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  product_marked_price_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- groups like “Add Strawberry Topping”
CREATE TABLE public.meal_order_item_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.meal_order_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- "selected options" from mealme api. The selected options within a customization (e.g., “Strawberry Topping”, quantity, price_cents)
CREATE TABLE public.meal_order_item_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customization_id UUID NOT NULL REFERENCES public.meal_order_item_customizations(id) ON DELETE CASCADE,
  option_id TEXT,
  name TEXT NOT NULL,
  price_cents INTEGER DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.meal_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL, -- Kept as a fallback/display name for now
  quantity INTEGER DEFAULT 1,
  price DECIMAL(8,2), -- Price at the time of order
  special_instructions TEXT,
  selected_options JSONB, -- Store selected options/modifications (e.g., "no onions", "extra cheese")
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


-- api_integrations table for managing API keys/tokens
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

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  created_by  uuid references auth.users(id),
  type        text not null check (type in ('birthday_reminder','order_update','poll', 'order_reminder', 'order_review', 'system')),
  message     text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

-- 3. Essential Indexes
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
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

-- menu_items indexes
CREATE INDEX idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);

CREATE INDEX idx_meal_orders_team_id ON public.meal_orders(team_id);
CREATE INDEX idx_meal_orders_scheduled_date ON public.meal_orders(scheduled_date);
CREATE INDEX idx_meal_orders_status ON public.meal_orders(order_status);
CREATE INDEX idx_meal_orders_api_order_id ON public.meal_orders(api_order_id);
CREATE INDEX idx_meal_orders_api_source_quote ON public.meal_orders(api_source, api_quote_id);

-- normalized item tables indexes
CREATE INDEX idx_meal_order_items_order_id ON public.meal_order_items(order_id);
CREATE INDEX idx_meal_order_item_customizations_item_id ON public.meal_order_item_customizations(order_item_id);
CREATE INDEX idx_meal_order_item_options_customization_id ON public.meal_order_item_options(customization_id);

-- order_items indexes
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_user_id ON public.order_items(user_id);
CREATE INDEX idx_order_items_menu_item_id ON public.order_items(menu_item_id);
CREATE INDEX idx_order_items_order_user ON public.order_items(order_id, user_id);

CREATE INDEX idx_meal_polls_team_id ON public.meal_polls(team_id);
CREATE INDEX idx_meal_polls_status ON public.meal_polls(poll_status);
CREATE INDEX idx_poll_votes_poll_id ON public.poll_votes(poll_id);
CREATE INDEX idx_payment_methods_team_id ON public.payment_methods(team_id);
CREATE UNIQUE INDEX uniq_team_member_email_per_team
    ON public.team_members (team_id, lower(email));

CREATE INDEX notifications_team_id_created_at_idx ON public.notifications(team_id, created_at desc);

-- 4. Functions (must be before RLS policies)

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

create or replace function public.ensure_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notifications_set_created_by on public.notifications;
create trigger trg_notifications_set_created_by
before insert on public.notifications
for each row execute function public.ensure_created_by();

DROP TRIGGER IF EXISTS trg_meal_orders_set_creator ON public.meal_orders;
CREATE TRIGGER trg_meal_orders_set_creator
BEFORE INSERT ON public.meal_orders
FOR EACH ROW EXECUTE FUNCTION public.ensure_created_by();

DROP TRIGGER IF EXISTS trg_payment_methods_set_creator ON public.payment_methods;
CREATE TRIGGER trg_payment_methods_set_creator
BEFORE INSERT ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.ensure_created_by();

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

-- Triggers for new tables
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

-- Any coach on the team (not just the main coach_id)
CREATE OR REPLACE FUNCTION public.is_team_coach(team_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1
  FROM public.team_members tm
  WHERE tm.team_id = team_uuid
    AND tm.user_id = auth.uid()
    AND tm.role = 'coach'::public.team_role
);
$$;

create or replace function public.is_a_coach(team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = team
      and tm.user_id = auth.uid()
      and tm.is_active = true
      and tm.role = 'coach'
  );
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
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_order_item_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_order_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS menu_items_api_id_key;
ALTER TABLE public.menu_items ADD CONSTRAINT uq_menu_items_restaurant_api UNIQUE (restaurant_id, api_id);
ALTER TABLE public.notifications enable row level security;

ALTER FUNCTION public.is_team_member(UUID)    SET search_path = public;
ALTER FUNCTION public.is_team_admin(UUID)     SET search_path = public;
ALTER FUNCTION public.is_team_coach(UUID)     SET search_path = public;
ALTER FUNCTION public.handle_new_user_profile SET search_path = public;
ALTER FUNCTION public.ensure_created_by SET search_path = public;
ALTER FUNCTION public.set_updated_at     SET search_path = public;

ALTER TABLE public.order_items
  ADD CONSTRAINT ck_order_items_qty_pos CHECK (quantity > 0),
  ADD CONSTRAINT ck_order_items_price_nonneg CHECK (price IS NULL OR price >= 0);
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


-- Base grants so PostgREST (and the 'authenticated' role) can see/insert
grant usage on schema public to authenticated;
grant select, insert on table public.notifications to authenticated;

-- If your table uses identity/sequence, this helps avoid permission errors
grant usage, select on all sequences in schema public to authenticated;


-- 6. RLS Policies (UPDATED)
-- Pattern 1: Core user table (user_profiles)
-- Read own profile
CREATE POLICY "users_read_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Update own profile (lets them change phone etc.)
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Insert via backend only (trigger/upsert path)
CREATE POLICY "system_insert_profiles"
ON public.user_profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- Pattern 2: Team-based access for teams
CREATE POLICY "team_members_view_teams"
ON public.teams
FOR SELECT
TO authenticated
USING (public.is_team_member(id) OR coach_id = auth.uid());

CREATE POLICY "coaches_manage_teams"
ON public.teams
FOR ALL TO authenticated
USING (public.is_team_coach(id) OR coach_id = auth.uid())
WITH CHECK (public.is_team_coach(id) OR coach_id = auth.uid());

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
CREATE POLICY "saved_locations_team_read"
ON public.saved_locations
FOR SELECT TO authenticated
USING (public.is_team_member(team_id));

CREATE POLICY "saved_locations_coach_insert"
ON public.saved_locations
FOR INSERT TO authenticated
WITH CHECK (public.is_team_coach(team_id) OR public.is_team_admin(team_id));

CREATE POLICY "saved_locations_coach_update"
ON public.saved_locations
FOR UPDATE TO authenticated
USING     (public.is_team_coach(team_id) OR public.is_team_admin(team_id))
WITH CHECK(public.is_team_coach(team_id) OR public.is_team_admin(team_id));

CREATE POLICY "saved_locations_coach_delete"
ON public.saved_locations
FOR DELETE TO authenticated
USING (public.is_team_coach(team_id) OR public.is_team_admin(team_id));



-- ------------------------------
-- RESTAURANTS (RLS)
-- ------------------------------

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
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.saved_locations sl
    WHERE sl.id = restaurants.location_id
      AND public.is_team_admin(sl.team_id)
  )
);

-- Coach can UPDATE only their team’s restaurants
CREATE POLICY "coaches_update_restaurants"
ON public.restaurants
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.saved_locations sl
    WHERE sl.id = restaurants.location_id
      AND public.is_team_admin(sl.team_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.saved_locations sl
    WHERE sl.id = restaurants.location_id
      AND public.is_team_admin(sl.team_id)
  )
);

-- Coach can DELETE only their team’s restaurants
CREATE POLICY "coaches_delete_restaurants"
ON public.restaurants
FOR DELETE TO authenticated
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
ON public.menu_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    JOIN public.saved_locations sl ON sl.id = r.location_id
    WHERE r.id = menu_items.restaurant_id
      AND (public.is_team_coach(sl.team_id) OR public.is_team_admin(sl.team_id))
  )
);

CREATE POLICY "coaches_update_menu_items"
ON public.menu_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    JOIN public.saved_locations sl ON sl.id = r.location_id
    WHERE r.id = menu_items.restaurant_id
      AND (public.is_team_coach(sl.team_id) OR public.is_team_admin(sl.team_id))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    JOIN public.saved_locations sl ON sl.id = r.location_id
    WHERE r.id = menu_items.restaurant_id
      AND (public.is_team_coach(sl.team_id) OR public.is_team_admin(sl.team_id))
  )
);

CREATE POLICY "coaches_delete_menu_items"
ON public.menu_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    JOIN public.saved_locations sl ON sl.id = r.location_id
    WHERE r.id = menu_items.restaurant_id
      AND (public.is_team_coach(sl.team_id) OR public.is_team_admin(sl.team_id))
  )
);


CREATE POLICY "team_members_read_payment_methods"
ON public.payment_methods
FOR SELECT
TO authenticated
USING (public.is_team_member(team_id));

CREATE POLICY "payment_methods_coach_insert"
ON public.payment_methods
FOR INSERT TO authenticated
WITH CHECK (public.is_team_admin(team_id));

CREATE POLICY "payment_methods_coach_update"
ON public.payment_methods
FOR UPDATE TO authenticated
USING     (public.is_team_admin(team_id))
WITH CHECK(public.is_team_admin(team_id));

CREATE POLICY "payment_methods_coach_delete"
ON public.payment_methods
FOR DELETE TO authenticated
USING (public.is_team_admin(team_id));


-- WRITE: creator or any coach/admin
CREATE POLICY "meal_orders_insert_creator_or_coach"
ON public.meal_orders
FOR INSERT TO authenticated
WITH CHECK (
  (created_by = auth.uid() AND public.is_team_member(team_id))
  OR public.is_team_coach(team_id) OR public.is_team_admin(team_id)
);

CREATE POLICY "meal_orders_update_creator_or_coach"
ON public.meal_orders
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_team_coach(team_id) OR public.is_team_admin(team_id)
)
WITH CHECK (
  (created_by = auth.uid() AND public.is_team_member(team_id))
  OR public.is_team_coach(team_id) OR public.is_team_admin(team_id)
);

CREATE POLICY "meal_orders_delete_creator_or_coach"
ON public.meal_orders
FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_team_coach(team_id) OR public.is_team_admin(team_id)
);
-- RLS for order_items, now referencing menu_items
-- READ: owner OR any coach on the team
CREATE POLICY "order_items_select_own_or_any_coach"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.meal_orders mo
    WHERE mo.id = order_items.order_id
      AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
  )
);

-- WRITE: owner OR any coach/admin on the team
CREATE POLICY "order_items_insert_own_or_coach"
ON public.order_items
FOR INSERT TO authenticated
WITH CHECK (
  (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.meal_orders mo
                WHERE mo.id = order_items.order_id
                  AND public.is_team_member(mo.team_id))
  )
  OR EXISTS (SELECT 1 FROM public.meal_orders mo
             WHERE mo.id = order_items.order_id
               AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id)))
);

CREATE POLICY "order_items_update_own_or_coach"
ON public.order_items
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.meal_orders mo
             WHERE mo.id = order_items.order_id
               AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id)))
)
WITH CHECK (
  (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.meal_orders mo
                WHERE mo.id = order_items.order_id
                  AND public.is_team_member(mo.team_id))
  )
  OR EXISTS (SELECT 1 FROM public.meal_orders mo
             WHERE mo.id = order_items.order_id
               AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id)))
);

CREATE POLICY "order_items_delete_own_or_coach"
ON public.order_items
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.meal_orders mo
             WHERE mo.id = order_items.order_id
               AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id)))
);

CREATE POLICY "team_members_read_orders"
ON public.meal_orders
FOR SELECT
TO authenticated
USING (public.is_team_member(team_id));


-- meal_order_items
DROP POLICY IF EXISTS "team_members_manage_meal_order_items" ON public.meal_order_items;

CREATE POLICY "meal_order_items_team_read"
ON public.meal_order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meal_orders mo
    WHERE mo.id = meal_order_items.order_id
      AND public.is_team_member(mo.team_id)
  )
);

CREATE POLICY "meal_order_items_insert_coach"
ON public.meal_order_items
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meal_orders mo
  WHERE mo.id = meal_order_items.order_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

CREATE POLICY "meal_order_items_update_coach"
ON public.meal_order_items
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meal_orders mo
  WHERE mo.id = meal_order_items.order_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meal_orders mo
  WHERE mo.id = meal_order_items.order_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

CREATE POLICY "meal_order_items_delete_coach"
ON public.meal_order_items
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meal_orders mo
  WHERE mo.id = meal_order_items.order_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

-- meal_order_item_customizations
CREATE POLICY "meal_order_item_customizations_team_read"
ON public.meal_order_item_customizations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.meal_order_items i
    JOIN public.meal_orders mo ON mo.id = i.order_id
    WHERE i.id = meal_order_item_customizations.order_item_id
      AND public.is_team_member(mo.team_id)
  )
);

CREATE POLICY "meal_order_item_customizations_insert_coach"
ON public.meal_order_item_customizations
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meal_order_items i
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE i.id = meal_order_item_customizations.order_item_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

CREATE POLICY "meal_order_item_customizations_update_coach"
ON public.meal_order_item_customizations
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meal_order_items i
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE i.id = meal_order_item_customizations.order_item_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meal_order_items i
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE i.id = meal_order_item_customizations.order_item_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

CREATE POLICY "meal_order_item_customizations_delete_coach"
ON public.meal_order_item_customizations
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meal_order_items i
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE i.id = meal_order_item_customizations.order_item_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));
-- meal_order_item_options
CREATE POLICY "meal_order_item_options_team_read"
ON public.meal_order_item_options
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.meal_order_item_customizations c
    JOIN public.meal_order_items i ON i.id = c.order_item_id
    JOIN public.meal_orders mo ON mo.id = i.order_id
    WHERE c.id = meal_order_item_options.customization_id
      AND public.is_team_member(mo.team_id)
  )
);

CREATE POLICY "meal_order_item_options_insert_coach"
ON public.meal_order_item_options
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.meal_order_item_customizations c
  JOIN public.meal_order_items i ON i.id = c.order_item_id
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE c.id = meal_order_item_options.customization_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

CREATE POLICY "meal_order_item_options_update_coach"
ON public.meal_order_item_options
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.meal_order_item_customizations c
  JOIN public.meal_order_items i ON i.id = c.order_item_id
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE c.id = meal_order_item_options.customization_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.meal_order_item_customizations c
  JOIN public.meal_order_items i ON i.id = c.order_item_id
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE c.id = meal_order_item_options.customization_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

CREATE POLICY "meal_order_item_options_delete_coach"
ON public.meal_order_item_options
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.meal_order_item_customizations c
  JOIN public.meal_order_items i ON i.id = c.order_item_id
  JOIN public.meal_orders mo ON mo.id = i.order_id
  WHERE c.id = meal_order_item_options.customization_id
    AND (public.is_team_coach(mo.team_id) OR public.is_team_admin(mo.team_id))
));

-- Team can read polls
CREATE POLICY "meal_polls_team_read"
ON public.meal_polls
FOR SELECT TO authenticated
USING (public.is_team_member(team_id));

-- Only coaches/admin can write
CREATE POLICY "meal_polls_coach_insert"
ON public.meal_polls
FOR INSERT TO authenticated
WITH CHECK (public.is_team_coach(team_id) OR public.is_team_admin(team_id));

CREATE POLICY "meal_polls_coach_update"
ON public.meal_polls
FOR UPDATE TO authenticated
USING     (public.is_team_coach(team_id) OR public.is_team_admin(team_id))
WITH CHECK(public.is_team_coach(team_id) OR public.is_team_admin(team_id));

CREATE POLICY "meal_polls_coach_delete"
ON public.meal_polls
FOR DELETE TO authenticated
USING (public.is_team_coach(team_id) OR public.is_team_admin(team_id));

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

-- Players see their own vote
CREATE POLICY "poll_votes_select_own"
ON public.poll_votes
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Coaches see all votes for their team’s polls
CREATE POLICY "poll_votes_select_coach"
ON public.poll_votes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meal_polls p
    WHERE p.id = poll_votes.poll_id
      AND (public.is_team_coach(p.team_id) OR public.is_team_admin(p.team_id))
  )
);

-- Players can cast a vote while the poll is active, on their own team,
-- and only if their role is allowed by target_roles
CREATE POLICY "poll_votes_insert_own_active"
ON public.poll_votes
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.meal_polls p
    JOIN public.team_members tm
      ON tm.team_id = p.team_id
     AND tm.user_id = auth.uid()
     AND tm.is_active
    WHERE p.id = poll_votes.poll_id
      AND p.poll_status = 'active'
      AND p.expires_at > NOW()
      AND tm.role = ANY (p.target_roles)
  )
);

-- Players can change their vote (same conditions as insert)
CREATE POLICY "poll_votes_update_own_active"
ON public.poll_votes
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.meal_polls p
    JOIN public.team_members tm
      ON tm.team_id = p.team_id
     AND tm.user_id = auth.uid()
     AND tm.is_active
    WHERE p.id = poll_votes.poll_id
      AND p.poll_status = 'active'
      AND p.expires_at > NOW()
      AND tm.role = ANY (p.target_roles)
  )
);

-- (Optional) Coaches can delete bad/duplicate votes
CREATE POLICY "poll_votes_delete_coach"
ON public.poll_votes
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meal_polls p
    WHERE p.id = poll_votes.poll_id
      AND (public.is_team_coach(p.team_id) OR public.is_team_admin(p.team_id))
  )
);

-- RLS for api_integrations 
CREATE POLICY "service_role_manage_api_integrations"
ON public.api_integrations
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- RLS NOTIFICATIONS
-- Allow team members to read notifications for their team
create policy "team_members_can_select_notifications"
on public.notifications
for select
to authenticated
using (
  -- must be an active member of the team
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = notifications.team_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
  )
  -- and if it's a birthday reminder, don't show it to the sender
  and not (
    notifications.type = 'birthday_reminder'
    and notifications.created_by is not distinct from auth.uid()
  )
);

-- Allow coaches to insert birthday reminders for their team
-- (adjust roles if you only use 'coach')
create policy "coach can insert notification"
on public.notifications
for insert
to authenticated
with check ( public.is_a_coach(team_id) );


-- 7. Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_user_auth_change
AFTER INSERT OR UPDATE OF email_confirmed_at, raw_user_meta_data ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

DROP TRIGGER IF EXISTS trg_meal_polls_set_creator ON public.meal_polls;
CREATE TRIGGER trg_meal_polls_set_creator
BEFORE INSERT ON public.meal_polls
FOR EACH ROW EXECUTE FUNCTION public.ensure_created_by();


-- 8. Mock Data (UPDATED)
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

    coach_name TEXT;
    coach_email TEXT;
    player1_name TEXT;
    player1_email TEXT;
    player2_name TEXT;
    player2_email TEXT;
BEGIN
    -- Create auth users (IMPORTANT: include role = 'authenticated')
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
         'coach@team.edu', crypt('password123', gen_salt('bf', 10)), now(),
         now(), now(),
         '{"data": {"firstName": "Coach", "lastName": "Johnson", "schoolName": "University A", "allergies": ""}, "email": "coach@team.edu", "email_verified": true, "phone_verified": false}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (player1_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'player1@team.edu', crypt('password123', gen_salt('bf', 10)), now(),
         now(), now(),
         '{"data": {"firstName": "Alex", "lastName": "Smith", "schoolName": "University A", "allergies": "Peanuts"}, "email": "player1@team.edu", "email_verified": true, "phone_verified": false}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (player2_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'player2@team.edu', crypt('password123', gen_salt('bf', 10)), now(),
         now(), now(),
         '{"data": {"firstName": "Taylor", "lastName": "Davis", "schoolName": "University A", "allergies": ""}, "email": "player2@team.edu", "email_verified": true, "phone_verified": false}'::jsonb,
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null);

    -- Let the user profile trigger run
    PERFORM pg_sleep(1);

    -- Pull names/emails back out of user_profiles created by trigger
    SELECT first_name || ' ' || last_name, email INTO coach_name, coach_email FROM public.user_profiles WHERE id = coach_uuid;
    SELECT first_name || ' ' || last_name, email INTO player1_name, player1_email FROM public.user_profiles WHERE id = player1_uuid;
    SELECT first_name || ' ' || last_name, email INTO player2_name, player2_email FROM public.user_profiles WHERE id = player2_uuid;

    -- Team & members
    INSERT INTO public.teams (id, name, sport, conference_name, gender, coach_id)
    VALUES (team_uuid, 'Warriors Basketball', 'Basketball', 'PAC-12', 'womens', coach_uuid);

    INSERT INTO public.team_members (team_id, user_id, role, full_name, email, phone_number, birthday) VALUES
      (team_uuid, coach_uuid,  'coach',  coach_name,  coach_email,  '(555) 123-4567', '1980-01-15'),
      (team_uuid, player1_uuid,'player', player1_name,player1_email,'(555) 987-6543', '2000-03-20'),
      (team_uuid, player2_uuid,'player', player2_name,player2_email,'(555) 111-2222', '2001-07-01');

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

    -- One completed order (past)
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

    -- One scheduled order (future, next week)
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

    -- NEW: Two orders this week (calendar testing)
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

    -- Poll
    INSERT INTO public.meal_polls (id, team_id, title, description, expires_at, created_by)
    VALUES (poll_uuid, team_uuid, 'Next Week Dinner Choice', 'Choose our restaurant for next Friday dinner', NOW() + INTERVAL '2 days', coach_uuid);

    INSERT INTO public.poll_options (id, poll_id, restaurant_name, cuisine_type, description) VALUES
      (option1_uuid, poll_uuid, 'Subway',        'American', 'Fresh sandwiches and salads'),
      (option2_uuid, poll_uuid, 'Panda Express', 'Chinese',  'Asian cuisine with variety');

    INSERT INTO public.poll_votes (poll_id, option_id, user_id)
    VALUES (poll_uuid, option1_uuid, player1_uuid);

EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'Foreign key error: %', SQLERRM;
  WHEN unique_violation THEN
    RAISE NOTICE 'Unique constraint error: %', SQLERRM;
  WHEN OTHERS THEN
    RAISE NOTICE 'Unexpected error: %', SQLERRM;
END $$;