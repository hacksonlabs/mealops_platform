-- Location: supabase/migrations/20250811223000_add_location_addresses.sql
-- Schema Analysis: Existing saved_locations and restaurants tables with proper relationships
-- Integration Type: Addition - Adding location_addresses table for multiple addresses per location
-- Dependencies: saved_locations (existing), teams (existing)

-- Create new table for saved addresses within locations
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

-- Add indexes for performance
CREATE INDEX idx_location_addresses_location_id ON public.location_addresses(location_id);
CREATE INDEX idx_location_addresses_address_type ON public.location_addresses(address_type);
CREATE INDEX idx_location_addresses_is_primary ON public.location_addresses(is_primary);

-- Enable RLS
ALTER TABLE public.location_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies following Pattern 7: Complex relationships (accessing through location team membership)
CREATE OR REPLACE FUNCTION public.can_access_location_address(location_address_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.location_addresses la
    JOIN public.saved_locations sl ON la.location_id = sl.id
    WHERE la.id = location_address_uuid
    AND public.is_team_member(sl.team_id)
)
$$;

-- Create RLS policies
CREATE POLICY "team_members_manage_location_addresses"
ON public.location_addresses
FOR ALL
TO authenticated
USING (public.can_access_location_address(id))
WITH CHECK (public.can_access_location_address(id));

-- Add sample data for existing locations
DO $$
DECLARE
    existing_location_id UUID;
BEGIN
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
    WHEN OTHERS THEN
        RAISE NOTICE 'Sample data creation failed: %', SQLERRM;
END $$;