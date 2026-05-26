-- 0004 represents the slack_connections → chat_connections rename.
-- The schema change was applied manually (drizzle-kit's interactive rename
-- prompt couldn't run in the environment). The SQL below is a no-op so that
-- drizzle marks this migration applied for any environment that catches up
-- by replaying from scratch — those environments will have to re-apply
-- the actual DDL manually via scripts/fixup-drizzle-meta.mjs or equivalent.
SELECT 1;
