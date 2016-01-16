--
--
-- This file contains the various SQL patterns of node-43 for a better overview
--
--

-- Order Upsert

INSERT INTO market_data_orders AS orders (generated_at,
  price,
  volume_remaining,
  volume_entered,
  minimum_volume,
  order_range,
  id,
  is_bid,
  issue_date,
  duration,
  is_suspicious,
  message_key,
  uploader_ip_hash,
  mapregion_id,
  invtype_id,
  stastation_id,
  mapsolarsystem_id,
  is_active)
VALUES *values*
ON CONFLICT (id) DO UPDATE SET
  price = excluded.price,
  volume_remaining = excluded.volume_remaining,
  generated_at = excluded.generated_at,
  issue_date = excluded.issue_date,
  is_suspicious = excluded.is_suspicious,
  uploader_ip_hash = excluded.uploader_ip_hash,
  is_active = 't'
WHERE orders.id = excluded.id AND orders.generated_at < excluded.generated_at

-- History Upserts

INSERT INTO market_data_orderhistory (mapregion_id, invtype_id, numorders, low, high, mean, quantity, date)
VALUES *values*
ON CONFLICT (mapregion_id, invtype_id, date) DO NOTHING
