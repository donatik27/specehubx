-- ============================================================================
-- CLEANUP ALPHA MARKETS DATA ONLY
-- ============================================================================
-- This will DELETE all MarketSmartStats records (Alpha Markets)
-- but KEEP traders, leaderboard, and market data intact!
-- ============================================================================

BEGIN;

-- 1. Count records before deletion
SELECT 
  'Before cleanup:' as status,
  COUNT(*) as total_alpha_markets 
FROM "MarketSmartStats";

-- 2. DELETE all Alpha Markets statistics
DELETE FROM "MarketSmartStats";

-- 3. Count records after deletion
SELECT 
  'After cleanup:' as status,
  COUNT(*) as total_alpha_markets 
FROM "MarketSmartStats";

-- 4. Verify other tables are intact
SELECT 
  'Traders intact:' as status,
  COUNT(*) as total_traders 
FROM "Trader";

SELECT 
  'Markets intact:' as status,
  COUNT(*) as total_markets 
FROM "Market";

COMMIT;

-- ============================================================================
-- TO RUN ON RAILWAY:
-- 1. Go to Railway Dashboard
-- 2. Click on "Postgres" service
-- 3. Click "Data" tab
-- 4. Click "Query" button
-- 5. Paste this SQL and run
-- ============================================================================
