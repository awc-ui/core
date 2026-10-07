-- Extend the existing outbox without replaying historical Meta registrations.
-- Old rows retain provider=meta and their event IDs. New provider jobs are only
-- created with a fresh signup and the newly versioned advertising consent.
ALTER TABLE waitlist_advertising_outbox
  ADD COLUMN provider text NOT NULL DEFAULT 'meta'
    CHECK (provider IN ('meta', 'reddit', 'google')),
  ADD COLUMN poll_attempts integer NOT NULL DEFAULT 0
    CHECK (poll_attempts BETWEEN 0 AND 48),
  ADD COLUMN destination_key text
    CHECK (destination_key IS NULL OR length(destination_key) BETWEEN 1 AND 256),
  ADD COLUMN remote_request_id text
    CHECK (remote_request_id IS NULL OR length(remote_request_id) BETWEEN 1 AND 512);
ALTER TABLE waitlist_advertising_outbox
  DROP CONSTRAINT waitlist_advertising_outbox_subscriber_id_key,
  ADD CONSTRAINT waitlist_advertising_subscriber_provider_key UNIQUE (subscriber_id, provider),
  DROP CONSTRAINT waitlist_advertising_outbox_user_data_check,
  DROP CONSTRAINT waitlist_advertising_outbox_state_check;
ALTER TABLE waitlist_advertising_outbox
  ADD CONSTRAINT waitlist_advertising_provider_data_check CHECK (
    jsonb_typeof(user_data) = 'object' AND
    CASE provider
      WHEN 'meta' THEN (user_data - ARRAY['client_user_agent', 'fbp', 'fbc']) = '{}'::jsonb
      WHEN 'reddit' THEN (user_data - ARRAY['click_id']) = '{}'::jsonb
      WHEN 'google' THEN (user_data - ARRAY['gclid', 'gbraid', 'wbraid']) = '{}'::jsonb
      ELSE false
    END
  ),
  ADD CONSTRAINT waitlist_advertising_state_check CHECK (
    state IN ('pending', 'sending', 'processing', 'sent', 'failed', 'expired', 'cancelled')
  );
DROP INDEX waitlist_advertising_pending;
CREATE INDEX waitlist_advertising_pending
  ON waitlist_advertising_outbox (provider, next_attempt_at, created_at)
  WHERE state IN ('pending', 'sending', 'processing');
