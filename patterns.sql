--
--
-- This file contains the various SQL patterns of node-43 for a better overview
--
--

-- Order Upsert

WITH new_values (generated_at, price, volume_remaining, volume_entered, minimum_volume, order_range, id, is_bid, issue_date, duration, is_suspicious, uploader_ip_hash, mapregion_id, invtype_id, stastation_id, mapsolarsystem_id, is_active)
AS (VALUES ' + values + '),
upsert as
(
  UPDATE orders o
    SET price = new_value.price,
        volume_remaining = new_value.volume_remaining,
	      generated_at = new_value.generated_at,
        issue_date = new_value.issue_date,
        is_suspicious = new_value.is_suspicious,
        uploader_ip_hash = new_value.uploader_ip_hash,
        is_active = 't'
  FROM new_values new_value
  WHERE o.id = new_value.id AND o.generated_at < new_value.generated_at
  RETURNING o.*
)
INSERT INTO market_data_orders (generated_at, price, volume_remaining, volume_entered, minimum_volume, order_range, id, is_bid, issue_date, duration, is_suspicious, uploader_ip_hash, mapregion_id, invtype_id, stastation_id, mapsolarsystem_id, is_active)
SELECT generated_at, price, volume_remaining, volume_entered, minimum_volume, order_range, id, is_bid, issue_date, duration, is_suspicious, uploader_ip_hash, mapregion_id, invtype_id, stastation_id, mapsolarsystem_id, is_active
FROM new_values
WHERE NOT EXISTS (SELECT 1
                  FROM upsert up
                  WHERE up.id = new_values.id)
  AND NOT EXISTS (SELECT 1
                  FROM market_data_orders
                  WHERE id = new_values.id)

-- History Upserts

WITH new_values (mapregion_id, invtype_id, numorders, low, high, mean, quantity, date)
AS (VALUES ' + values + '),
upsert as
(
  UPDATE market_data_orderhistory o
    SET numorders = new_value.numorders,
        low = new_value.low,
        high = new_value.high,
        mean = new_value.mean,
        quantity = new_value.quantity
  FROM new_values new_value
  WHERE o.mapregion_id = new_value.mapregion_id AND o.invtype_id = new_value.invtype_id AND o.date = new_value.date AND o.date >= NOW() - '1 day'::INTERVAL
  RETURNING o.*
)
INSERT INTO market_data_orderhistory (mapregion_id, invtype_id, numorders, low, high, mean, quantity, date)
SELECT mapregion_id, invtype_id, numorders, low, high, mean, quantity, date
FROM new_values
WHERE NOT EXISTS (SELECT 1
                  FROM upsert up
                  WHERE up.mapregion_id = new_values.mapregion_id
                    AND up.invtype_id = new_values.invtype_id
                    AND up.date = new_values.date)
  AND NOT EXISTS (SELECT 1
                  FROM market_data_orderhistory
                  WHERE mapregion_id = new_values.mapregion_id
                    AND invtype_id = new_values.invtype_id
                    AND date = new_values.date)
