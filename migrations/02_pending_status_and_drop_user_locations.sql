-- Add 'pending' status for civilian-reported incidents; drop user_locations (Live Map = incidents only)

-- 1. Allow 'pending' in incidents.status (civilian-created, awaiting coordinator approval)
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_status_check;
ALTER TABLE incidents ADD CONSTRAINT incidents_status_check
    CHECK (status IN ('pending', 'reported', 'active', 'contained', 'resolved'));

-- 2. Drop user_locations table and its trigger (no longer used; Live Map shows incidents only)
DROP TRIGGER IF EXISTS update_user_locations_updated_at ON user_locations;
DROP TABLE IF EXISTS user_locations;
