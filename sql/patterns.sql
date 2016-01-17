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

-- orderRegionStats

INSERT INTO market_data_itemregionstat AS stats (buymean,
  buyavg,
  buymedian,
  sellmean,
  sellavg,
  sellmedian,
  buyvolume,
  sellvolume,
  buy_95_percentile,
  sell_95_percentile,
  mapregion_id,
  invtype_id,
  lastupdate,
  buy_std_dev,
  sell_std_dev)
VALUES *values*
ON CONFLICT (mapregion_id, invtype_id) DO UPDATE SET
  buymean = excluded.buymean,
  buyavg = excluded.buyavg,
  buymedian = excluded.buymedian,
  sellmean = excluded.sellmean,
  sellavg = excluded.sellavg,
  sellmedian = excluded.sellmedian,
  buyvolume = excluded.buyvolume,
  sellvolume = excluded.sellvolume,
  buy_95_percentile = excluded.buy_95_percentile,
  sell_95_percentile = excluded.sell_95_percentile,
  lastupdate = excluded.lastupdate,
  buy_std_dev = excluded.buy_std_dev,
  sell_std_dev = excluded.sell_std_dev


-- orderRegionStatHistory

INSERT INTO market_data_itemregionstathistory AS stats (buymean,
  buyavg,
  buymedian,
  sellmean,
  sellavg,
  sellmedian,
  buyvolume,
  sellvolume,
  buy_95_percentile,
  sell_95_percentile,
  mapregion_id,
  invtype_id,
  date,
  buy_std_dev,
  sell_std_dev)
VALUES *values*
ON CONFLICT (mapregion_id, invtype_id, date) DO UPDATE SET
  buymean = excluded.buymean,
  buyavg = excluded.buyavg,
  buymedian = excluded.buymedian,
  sellmean = excluded.sellmean,
  sellavg = excluded.sellavg,
  sellmedian = excluded.sellmedian,
  buyvolume = excluded.buyvolume,
  sellvolume = excluded.sellvolume,
  buy_95_percentile = excluded.buy_95_percentile,
  sell_95_percentile = excluded.sell_95_percentile,
  buy_std_dev = excluded.buy_std_dev,
  sell_std_dev = excluded.sell_std_dev
