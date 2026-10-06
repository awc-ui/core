-- Additive: email subscriptions and their outbox are unchanged. Netlify runs
-- this migration transactionally before publishing the new functions.
CREATE TABLE IF NOT EXISTS advertising_consents (
  consent_key text PRIMARY KEY CHECK (consent_key ~ '^[a-f0-9]{64}$'),
  consent_version text NOT NULL CHECK (length(consent_version) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL,
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS waitlist_advertising_outbox (
  id uuid PRIMARY KEY,
  subscriber_id uuid NOT NULL UNIQUE REFERENCES waitlist_subscribers(id),
  consent_key text NOT NULL REFERENCES advertising_consents(consent_key),
  user_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(user_data) = 'object' AND
    (user_data - ARRAY['client_user_agent', 'fbp', 'fbc']) = '{}'::jsonb
  ),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'failed', 'expired', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 6),
  created_at timestamptz NOT NULL,
  next_attempt_at timestamptz NOT NULL,
  lease_until timestamptz,
  claim_token uuid,
  completed_at timestamptz,
  last_error text CHECK (last_error IS NULL OR last_error ~ '^[a-z0-9_]{1,64}$')
);
CREATE INDEX IF NOT EXISTS advertising_consents_expiry
  ON advertising_consents (expires_at);
CREATE INDEX IF NOT EXISTS waitlist_advertising_pending
  ON waitlist_advertising_outbox (next_attempt_at, created_at) WHERE state IN ('pending', 'sending');
CREATE INDEX IF NOT EXISTS waitlist_advertising_consent
  ON waitlist_advertising_outbox (consent_key);
