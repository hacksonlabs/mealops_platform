-- supabase/migrations/001_extensions_types
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Extensions & Types
CREATE TYPE public.team_role AS ENUM ('player', 'coach', 'staff');
CREATE TYPE public.order_status AS ENUM ('draft', 'scheduled', 'pending_confirmation', 'confirmed', 'preparing', 'out_for_delivery', 'completed', 'cancelled', 'failed'); -- Added more granular statuses
CREATE TYPE public.poll_status AS ENUM ('active', 'completed', 'expired');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE public.location_type AS ENUM ('school', 'hotel', 'gym', 'venue', 'other');
CREATE TYPE public.api_source_type AS ENUM ('ubereats', 'mealme', 'doordash', 'grubhub', 'manual');
CREATE TYPE public.fulfillment_method AS ENUM ('delivery', 'pickup', 'dine-in');