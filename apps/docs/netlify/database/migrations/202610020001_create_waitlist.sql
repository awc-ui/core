-- Netlify applies each migration and its tracking record in one transaction.
-- Do not add BEGIN/COMMIT here: that would commit before migration tracking.
CREATE TABLE IF NOT EXISTS waitlist_subscribers (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 254 AND email = lower(btrim(email))),
  email_key text NOT NULL UNIQUE CHECK (length(email_key) BETWEEN 1 AND 128),
  unsubscribe_hash text NOT NULL UNIQUE CHECK (length(unsubscribe_hash) BETWEEN 1 AND 128),
  offer_version text NOT NULL CHECK (offer_version = 'datagrid-early-20-v1'),
  consent_version text NOT NULL DEFAULT 'waitlist-2026-10-02-v1' CHECK (length(consent_version) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL,
  suppressed_at timestamptz
);

CREATE TABLE IF NOT EXISTS waitlist_outbox (
  id uuid PRIMARY KEY,
  subscriber_id uuid NOT NULL REFERENCES waitlist_subscribers(id),
  kind text NOT NULL CHECK (kind IN ('welcome', 'admin')),
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'sending', 'sent', 'failed', 'uncertain', 'cancelled', 'expired')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL,
  next_attempt_at timestamptz NOT NULL,
  claim_token uuid,
  lease_until timestamptz,
  completed_at timestamptz,
  last_error text CHECK (length(last_error) <= 64),
  UNIQUE (subscriber_id, kind),
  CHECK ((state = 'sending' AND claim_token IS NOT NULL AND lease_until IS NOT NULL)
    OR (state <> 'sending' AND claim_token IS NULL AND lease_until IS NULL))
);

CREATE INDEX IF NOT EXISTS waitlist_outbox_pending
  ON waitlist_outbox (next_attempt_at, created_at, id) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS waitlist_outbox_sending
  ON waitlist_outbox (lease_until) WHERE state = 'sending';

CREATE TABLE IF NOT EXISTS waitlist_budgets (
  kind text NOT NULL CHECK (kind IN ('attempt', 'registration')),
  bucket_date date NOT NULL,
  scope_key text NOT NULL CHECK (length(scope_key) BETWEEN 1 AND 132),
  used integer NOT NULL CHECK (used > 0),
  PRIMARY KEY (kind, bucket_date, scope_key)
);

-- Every SMTP attempt spends a slot, including rejected or uncertain sends.
-- Keep at least 24 hours of reservations; never refund an unsuccessful send.
CREATE TABLE IF NOT EXISTS waitlist_send_attempts (
  id uuid PRIMARY KEY,
  outbox_id uuid NOT NULL REFERENCES waitlist_outbox(id),
  attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
  reserved_at timestamptz NOT NULL,
  UNIQUE (outbox_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS waitlist_send_attempts_reserved
  ON waitlist_send_attempts (reserved_at);
