-- supabase/migrations/001_extensions_types
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Extensions & Types
CREATE TYPE public.team_role AS ENUM ('player', 'coach', 'staff');
CREATE TYPE public.order_status AS ENUM ('draft', 'scheduled', 'pending_confirmation', 'confirmed', 'preparing', 'out_for_delivery', 'completed', 'cancelled', 'failed', 'cancellation_requested', 'cancel_failed');
CREATE TYPE public.poll_status AS ENUM ('active', 'completed', 'expired');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded', 'voided');
CREATE TYPE public.location_type AS ENUM ('school', 'hotel', 'gym', 'venue', 'other');
CREATE TYPE public.api_source_type AS ENUM ('ubereats', 'mealme', 'doordash', 'grubhub', 'ezcater','manual');
CREATE TYPE public.fulfillment_method AS ENUM ('delivery', 'pickup', 'dine-in');
CREATE TYPE public.meal_type AS ENUM ('breakfast','lunch','dinner','snack', 'other');
CREATE TYPE public.cart_status AS ENUM ('draft','locked','submitted','abandoned');
CREATE TYPE public.cart_member_role AS ENUM ('owner','member');
CREATE TYPE location_side AS ENUM ('home','away','neutral');
CREATE TYPE location_kind AS ENUM ('main','practice','hotel','other');
