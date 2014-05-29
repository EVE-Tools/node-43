-- itemRegionStatHistory acceleration

CREATE INDEX "market_data_itemregionstathistory_update_acceleration" ON "public"."market_data_itemregionstathistory" USING btree(mapregion_id ASC NULLS LAST, invtype_id ASC NULLS LAST, "date" ASC NULLS LAST);
COMMENT ON INDEX "public"."market_data_itemregionstathistory_update_acceleration" IS NULL;

-- itemRegionStat composite index accelleration
CREATE INDEX "market_data_itemregionstat_composite" ON "public"."market_data_itemregionstat" USING btree(mapregion_id ASC NULLS LAST, invtype_id ASC NULLS LAST);
COMMENT ON INDEX "public"."market_data_itemregionstat_composite" IS NULL;

-- orderHistory update accelleration
CREATE INDEX "market_data_orderhistory_update_accelleration" ON "public"."market_data_orderhistory" USING btree(mapregion_id ASC NULLS LAST, invtype_id ASC NULLS LAST, "date" ASC NULLS LAST);
COMMENT ON INDEX "public"."market_data_orderhistory_update_accelleration" IS NULL;

-- order speed
CREATE INDEX "market_data_orders_active_type_bid" ON "public"."market_data_orders" USING btree(invtype_id ASC NULLS LAST, stastation_id ASC NULLS LAST, is_active ASC NULLS LAST);
COMMENT ON INDEX "public"."market_data_orders_active_type_bid" IS NULL;


