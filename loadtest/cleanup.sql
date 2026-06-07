-- Remove rows created by a write load test.
-- REVIEW the table id / time window before running. Run in Supabase SQL editor.

-- Option A — by test table (safest: use a throwaway table you created for testing)
-- delete from order_items where order_id in (
--   select id from orders where table_id = '<TEST_TABLE_ID>'
-- );
-- delete from orders where table_id = '<TEST_TABLE_ID>';

-- Option B — by time window (everything created during your test run)
-- delete from order_items where order_id in (
--   select id from orders where opened_at >= '2026-06-07T10:00:00Z'
--                            and opened_at <  '2026-06-07T11:00:00Z'
-- );
-- delete from orders where opened_at >= '2026-06-07T10:00:00Z'
--                      and opened_at <  '2026-06-07T11:00:00Z';

-- Reset a test table's bill counter if it ran away (optional)
-- update outlet_counters set next_bill = 1001
--   where outlet_id = (select id from outlets where slug = 'raasta');
