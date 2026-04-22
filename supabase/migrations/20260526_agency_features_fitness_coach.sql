-- ============================================================
-- Trainer Phase 1 Plan 02 — retrofit to canonical feature-flag system
--
-- Plan 01 added agencies.features jsonb as a generic feature-flag host,
-- but Koto's canonical feature-flag system lives in a separate
-- public.agency_features table with one boolean column per feature
-- (see 20260439_feature_permissions.sql: koto_desk, voice_agent,
-- answering_service, etc.).  The useAuth hook loads this table into
-- `agencyFeatures` state at session boot, and Sidebar.jsx gates every
-- nav item via `feat(<featureKey>)` which calls `can(featureKey)` which
-- reads agencyFeatures[featureKey].
--
-- This migration adds the `fitness_coach` column to agency_features so
-- the Trainer module integrates with the canonical flow.  Plan 01's
-- agencies.features jsonb column stays (harmless, defaults to {}, may
-- be useful for other flag types later); only the feature-flag GATE
-- moves to this table.
--
-- DEFAULT false: matches voice_agent + answering_service — Trainer is
-- a premium opt-in feature, not on by default for every agency.
-- ============================================================

ALTER TABLE public.agency_features
  ADD COLUMN IF NOT EXISTS fitness_coach boolean DEFAULT false;
