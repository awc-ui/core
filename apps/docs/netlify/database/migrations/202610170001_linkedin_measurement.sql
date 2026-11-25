-- Extend the existing outbox; do not replay or change historical events.
-- The existing UNIQUE (subscriber_id, provider) also covers LinkedIn.
ALTER TABLE waitlist_advertising_outbox
  DROP CONSTRAINT waitlist_advertising_outbox_provider_check,
  ADD CONSTRAINT waitlist_advertising_outbox_provider_check
    CHECK (provider IN ('meta', 'reddit', 'google', 'linkedin')),
  DROP CONSTRAINT waitlist_advertising_provider_data_check,
  ADD CONSTRAINT waitlist_advertising_provider_data_check CHECK (
    jsonb_typeof(user_data) = 'object' AND
    CASE provider
      WHEN 'meta' THEN (user_data - ARRAY['client_user_agent', 'fbp', 'fbc']) = '{}'::jsonb
      WHEN 'reddit' THEN (user_data - ARRAY['click_id']) = '{}'::jsonb
      WHEN 'google' THEN (user_data - ARRAY['gclid', 'gbraid', 'wbraid']) = '{}'::jsonb
      WHEN 'linkedin' THEN (user_data - ARRAY['li_fat_id']) = '{}'::jsonb
      ELSE false
    END
  );
