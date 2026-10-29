# Recorded data in the portal

Journey performance reads saved, authorised portal prospects and events. It is separate from the read-only DealerSocket snapshot. Known handset tests (`sms_test_*` IDs or `SMS-TEST-*` opportunity IDs) are excluded from report and overview totals, remain in conversations, and are labelled `[TEST]`.

Charts count received prospects and customer inbound message events on Melbourne calendar dates. Outcomes come from saved prospect outcomes; opted-out counts use saved prospect status. These counts do not assert successful CRM writeback. Check Automation monitoring for writeback results.

Median first SMS uses the provider-acceptance timestamp recorded for automated sends. Older events without that timestamp do not contribute. Missing timing data displays a dash. Failed reporting requests display an error rather than sample totals. CSV export downloads the loaded report.

Journey activation is read from the current `journey_active` backend record; published history alone is not an active journey. Missing journeys cannot be toggled. Default journeys created and persisted by the backend are actual configuration, not proof that messages were sent.

Dealership names, addresses, contact numbers, sender numbers, sending windows and closed days come from `/api/rooftops`. Example seed phone numbers are no longer presented as configured identities. SMS mode reflects backend provider configuration and test-recipient restrictions. A configured number does not establish delivery, reply capability or provider ownership verification.

The portal does not substitute sample data for missing records. Existing records are preserved; arbitrary historical test records cannot be identified automatically without reliable provenance.
