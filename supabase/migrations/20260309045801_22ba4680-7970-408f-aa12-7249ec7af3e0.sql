-- Fix: Remove overly permissive SELECT policy that shows ALL orders to authenticated users
DROP POLICY IF EXISTS "Authenticated can read own inserted orders" ON landing_orders;

-- Anon users should only see orders they just inserted (via order lookup by phone/code)
-- Keep "Anon can read own inserted orders" as-is for guest checkout

-- Authenticated tenant members already have proper SELECT via "Tenant members can view landing orders"