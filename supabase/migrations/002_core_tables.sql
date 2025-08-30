-- supabase/migrations/002_core_tables
-- Core Tables
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

-- member_groups
create table if not exists public.member_groups (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- member_group_members
create table if not exists public.member_group_members (
  group_id uuid not null references public.member_groups(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  primary key (group_id, member_id)
);

CREATE TABLE public.location_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES public.saved_locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    address_type public.location_type DEFAULT 'other'::public.location_type,
    notes TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);