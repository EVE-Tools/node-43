// Load global configuration
var config = require('./config');

// Load deps
var zmq = require('zmq'),
  zlib = require('zlib'),
  fs = require('fs'),
  colors = require('colors'),
  zmqSocket = zmq.socket('sub'),
  pg = require('pg'),
  Stats = require('fast-stats').Stats,
  emds = require('./emds');

// Set up pg connection pool
pg.defaults.poolSize = config.postgresMaxConnections;

// Global stat variables
var messagesTotal = 0;
var messagesOrders = 0;
var orderUpserts = 0;
var historyUpserts = 0;

var ordersCacheHit = 0;
var historyRowCacheHit = 0;

// Backlog counters
var stdDevWaiting = 0;
var upsertWaiting = 0;
var statWaiting = 0;
var historyWaiting = 0;
var regionStatHistoryWaiting = 0;

// Throttling switches
var throttleHistory = false;
var throttleOrders = false;

// EMDR statistics variables
var emdrStatsEmptyOrderMessages = 0;
var emdrStatsOrderInserts = 0;
var emdrStatsOrderUpdates = 0;
var emdrStatsHistoryMessages = 0;
var emdrStatsOrderMessages = 0;
var emdrStatsHistoryUpdates = 0;

// RegionStat schedule list
var scheduledRegionStatUpdates = {};

// Caches for history and order
var historyCache = {};
var orderCache = {};

// Load caches from disk

if (config.persistentCaching){
  process.stdout.write('Loading history cache: ');

  if (fs.existsSync('historyCache.json')) {
    historyCache = JSON.parse(fs.readFileSync('historyCache.json'));
    console.log('OK!'.green);
  } else {
    console.log('Not present yet'.yellow);
  }

  process.stdout.write('Loading order cache: ');

  if (fs.existsSync('orderCache.json')) {
    orderCache = JSON.parse(fs.readFileSync('orderCache.json'));
    console.log('OK!'.green);
  } else {
    console.log('Not present yet'.yellow);
  }
}

// Connect to the relays specified in the config file
for (var relay in config.relays) {
  process.stdout.write('Connecting to ' + config.relays[relay].underline + ':');

  // Connect to the relay.
  zmqSocket.connect(config.relays[relay]);

  console.log(' OK!'.green);
}

// Disable filtering
zmqSocket.subscribe('');

// Message Handling
zmqSocket.on('error', function(error) {
  console.log('ERROR: ' + error);
});

// EMDR Message handling begins here
zmqSocket.on('message', function(message) {
  // Receive raw market JSON strings.
  zlib.inflate(message, function(error, marketJSON) {

    // Parse the JSON data.
    var marketData = JSON.parse(marketJSON);

    // Increase stat counter
    messagesTotal++;

    if (marketData.resultType == 'orders') {
      // Increase stat counters
      messagesOrders++;
      emdrStatsOrderMessages++;

      // Extract objects from message
      orders = emds.getOrderObjects(marketData);

      // Get region/type pairs - we need them to minimize the amount of queries needed for the std. deviations
      regionTypes = emds.getDistinctRegionTypePairs(marketData);

      // Proceed if there are any orders
      if (orders.length > 0 && !throttleOrders) {

        // Filter time
        if (((new Date(Date.now())) - Date.parse(orders[0].generatedAt)) < (config.maximumMessageAge * 60 * 60 * 1000)) {

          // Iterate over regions affected
          for (var regionID in regionTypes) {

            // Iterate over types affected in that region
            for (i = 0; i < regionTypes[regionID].length; i++) {

              var typeID = regionTypes[regionID][i];

              // Write filtered orders to DB
              orderFilterCache(orders, typeID, regionID);
            }
          }
        }
      } else {
        // Increase stat value
        emdrStatsEmptyOrderMessages++;
      }
    }

    if (marketData.resultType == 'history') {
      var historyObjects = emds.getHistoryObjects(marketData);

      // Hand data over to cache handler
      historyFilterCache(historyObjects);
    }
  });
});

// Filters 'old' order messages

//
// Only new messages hit the DB
//

function orderFilterCache(orders, typeID, regionID) {
  // If it's undefined, create cache entry and upsert orders
  if (!orderCache[regionID]) orderCache[regionID] = {};

  // Check if we already had that combination
  if (!orderCache[regionID][typeID]) {

    orderCache[regionID][typeID] = Date.parse(orders[0].generatedAt);

    upsertOrders(orders, typeID, regionID);
  } else {
    // Check if this message is newer
    if (Date.parse(orders[0].generatedAt) > orderCache[regionID][typeID]) {
      // Upsert that combination
      upsertOrders(orders, typeID, regionID);
    } else {
      ordersCacheHit += orders.length;
    }
  }
}

// Filters too old and new history rows

function historyFilterCache(historyObjects) {
  var filteredHistory = [];

  for (var object in historyObjects) {

    var regionTypeAdded = [];
    var historyObject = historyObjects[object];

    // First check, if we have already seen that region/type combination
    if (!historyCache[historyObject.regionID]) historyCache[historyObject.regionID] = {};

    if (!historyCache[historyObject.regionID][historyObject.typeID]) {
      historyCache[historyObject.regionID][historyObject.typeID] = {};
      historyCache[historyObject.regionID][historyObject.typeID].lastSeen = Date.parse(historyObject.generatedAt);
      historyCache[historyObject.regionID][historyObject.typeID].oldestDate = Date.parse(historyObject.date);
      historyCache[historyObject.regionID][historyObject.typeID].latestDate = Date.parse(historyObject.date);

      // Add all the datapoints with that region/type
      for (var freshObject in historyObjects) {
        var freshHistoryObject = historyObjects[freshObject];
        if ((freshHistoryObject.regionID == historyObject.regionID) && (freshHistoryObject.typeID == historyObject.typeID)) {
          filteredHistory.push(freshHistoryObject);

          if (Date.parse(freshHistoryObject.date) < historyCache[freshHistoryObject.regionID][freshHistoryObject.typeID].oldestDate) {
            historyCache[freshHistoryObject.regionID][freshHistoryObject.typeID].oldestDate = Date.parse(freshHistoryObject.date);
          }

          if (Date.parse(freshHistoryObject.date) > historyCache[freshHistoryObject.regionID][freshHistoryObject.typeID].latestDate) {
            historyCache[freshHistoryObject.regionID][freshHistoryObject.typeID].latestDate = Date.parse(freshHistoryObject.date);
          }
        }
      }

      regionTypeAdded.push(historyObject.regionID + '-' + historyObject.typeID);

    }
    // Check if that combination was not added just before

    if (regionTypeAdded.indexOf(historyObject.regionID + '-' + historyObject.typeID) == -1) {
      // Bandpass filter history

      var added = false;

      // Pass older data
      if (Date.parse(historyObject.date) < historyCache[historyObject.regionID][historyObject.typeID].oldestDate) {
        historyCache[historyObject.regionID][historyObject.typeID].oldestDate = Date.parse(historyObject.date);

        if (!added) {
          filteredHistory.push(historyObject);
          added = true;
        }
      }

      // Pass newer data
      if (Date.parse(historyObject.date) > historyCache[historyObject.regionID][historyObject.typeID].latestDate) {
        historyCache[historyObject.regionID][historyObject.typeID].latestDate = Date.parse(historyObject.date);

        if (!added) {
          filteredHistory.push(historyObject);
          added = true;
        }
      }

      // Update where generatedAt newer and matches our latest datapoint
      if (Date.parse(historyObject.date) == historyCache[historyObject.regionID][historyObject.typeID].latestDate) {
        if (historyCache[historyObject.regionID][historyObject.typeID].lastSeen < Date.parse(historyObject.generatedAt)) {
          historyCache[historyObject.regionID][historyObject.typeID].lastSeen = Date.parse(historyObject.generatedAt);
          if (!added) {
            filteredHistory.push(historyObject);
            added = true;
          }
        }
      }
    }
  }

  historyRowCacheHit += historyObjects.length - filteredHistory.length;

  if ((historyObjects.length - filteredHistory.length) < 0) {
    console.log('\nSomething went wrong'.red);
  }


  upsertHistory(filteredHistory);
}

// Upsert history

function upsertHistory(historyObjects) {
  // Increase EMDR stats
  emdrStatsHistoryMessages++;
  emdrStatsHistoryUpdates = historyObjects.length.length - result.rowCount;

  if (historyObjects.length > 0 && !throttleHistory) {
    // Collect all the data in the right order
    var params = [];
    var values = '';

    for (x = 0; x < historyObjects.length; x++) {
      var o = historyObjects[x];

      // Add to values string
      values += '(' + o.regionID + ',' + o.typeID + ',' + o.orders + ',' + o.low + ',' + o.high + ',' + o.average + ',' + o.quantity + ', \'' + o.date + '\'::timestamp AT TIME ZONE \'UTC\'),';
    }

    values = values.slice(0, -1);

    historyWaiting++;

    pg.connect(config.postgresConnectionString, function(err, pgClient, done){
      if (err) {
          console.log('Postgres error:');
          console.log(err);
      } else {
        // Execute query
        pgClient.query('WITH new_values (mapregion_id, invtype_id, numorders, low, high, mean, quantity, date) AS (VALUES ' + values + '), upsert as (UPDATE market_data_orderhistory o SET numorders = new_value.numorders, low = new_value.low, high = new_value.high, mean = new_value.mean, quantity = new_value.quantity FROM new_values new_value WHERE o.mapregion_id = new_value.mapregion_id AND o.invtype_id = new_value.invtype_id AND o.date = new_value.date AND o.date >= NOW() - \'1 day\'::INTERVAL RETURNING o.*) INSERT INTO market_data_orderhistory (mapregion_id, invtype_id, numorders, low, high, mean, quantity, date) SELECT mapregion_id, invtype_id, numorders, low, high, mean, quantity, date FROM new_values WHERE NOT EXISTS (SELECT 1 FROM upsert up WHERE up.mapregion_id = new_values.mapregion_id AND up.invtype_id = new_values.invtype_id AND up.date = new_values.date) AND NOT EXISTS (SELECT 1 FROM market_data_orderhistory WHERE mapregion_id = new_values.mapregion_id AND invtype_id = new_values.invtype_id AND date = new_values.date)', function(err, result) {

          historyWaiting--;

          if (err) {
            console.log('\nHistory upsert error:');
            console.log(err);
            if (config.extensiveLogging) console.log(values);
          } else {
            // Increase stat counters
            historyUpserts += historyObjects.length;
          }

          done();
        });
      }
    });
  }
}

// Upsert orders

function upsertOrders(orders, typeID, regionID) {
  // Get all the statistical data for the isSuspicios flag:
  // Check order if 'supicious' which is an arbitrary definition.  Any orders that are outside config.stdDevRejectionMultiplier standard deviations
  // of the mean AND where there are more than 5 orders of like type in the region will be flagged.
  // Flags: True = Yes (suspicious), False = No (not suspicious)
  //
  // Execute query asynchnously

  stdDevWaiting++;

  pg.connect(config.postgresConnectionString, function(err, pgClientStdDev, doneStdDev){

    if (err) {
        console.log('Postgres error:');
        console.log(err);
    } else {

      // Use a prepared statement for performance reasons
      pgClientStdDev.query({
        name: 'upsert_orders_stddev',
        text: 'SELECT COUNT(id), STDDEV(price), AVG(price) FROM market_data_orders WHERE invtype_id=$1 AND mapregion_id=$2 AND is_active=\'t\' AND is_suspicious=\'f\'',
        values: [typeID, regionID]
      }, function(err, result) {

        doneStdDev();

        stdDevWaiting--;

        if (err) {
          console.log('\nSQL error while determining standard deviation:');
          console.log(err);
          if (config.extensiveLogging) console.log(typeID);
        } else {
          // Iterate over orders and select those orders which are affected
          var ordersToUpsert = [];
          var hasSuspiciousOrders = false;

          for (c = 0; c < orders.length; c++) {
            if (orders[c].typeID == typeID && orders[c].regionID == regionID) {
              // Add the flag to the order
              // First, check if we have more than 5 orders present
              if (result.rows[0].count > 5) {
                // See if the price is right or left of the mean value
                if (orders[c].price > result.rows[0].avg) {

                  // If the distance between mean and price is greater than config.stdDevRejectionMultiplier * σ this must be a suspicious order
                  if (((orders[c].price - result.rows[0].avg) > (config.stdDevRejectionMultiplier * result.rows[0].stddev)) && orders[c].bid) {
                    orders[c].isSuspicious = true;
                    hasSuspiciousOrders = true;
                  } else {
                    orders[c].isSuspicious = false;
                  }

                } else {

                  // If the distance between mean and price is greater than config.stdDevRejectionMultiplier * σ this must be a suspicious order
                  if (((result.rows[0].avg - orders[c].price) > (config.stdDevRejectionMultiplier * result.rows[0].stddev)) && !orders[c].bid) {
                    orders[c].isSuspicious = true;
                    hasSuspiciousOrders = true;
                  } else {
                    orders[c].isSuspicious = false;
                  }

                }
              } else {
                // Not enough datapoints for a reliable guess
                orders[c].isSuspicious = false;
              }
              // Finally, push that order to list
              ordersToUpsert.push(orders[c]);
            }
          }

          if (ordersToUpsert.length > 0) {
            var values = '';

            // Upsert this chunk
            // Generate query strings
            for (x = 0; x < ordersToUpsert.length; x++) {
              // Generate parameter list
              var o = ordersToUpsert[x];
              values += '(\'' + o.generatedAt + '\'::timestamp AT TIME ZONE \'UTC\',' + o.price + ',' + o.volRemaining + ',' + o.volEntered + ',' + o.minVolume + ',' + o.range + ',' + o.orderID + ',' + o.bid + ',\'' + o.issueDate + '\'::timestamp AT TIME ZONE \'UTC\',' + o.duration + ',' + o.isSuspicious + ',\'\',\'' + o.ipHash + '\',' + o.regionID + ',' + o.typeID + ',' + o.stationID + ',' + o.solarSystemID + ',true),';
            }

            // Cut off trailing comma
            values = values.substring(0, values.length - 1);

            // Prepare query
            var upsertQuery = 'WITH new_values (generated_at, price, volume_remaining, volume_entered, minimum_volume, order_range, id, is_bid, issue_date, duration, is_suspicious, message_key, uploader_ip_hash, mapregion_id, invtype_id, stastation_id, mapsolarsystem_id, is_active) AS (values ' + values + '), upsert as ( UPDATE market_data_orders o SET price = new_value.price, volume_remaining = new_value.volume_remaining, generated_at = new_value.generated_at, issue_date = new_value.issue_date, is_suspicious = new_value.is_suspicious, uploader_ip_hash = new_value.uploader_ip_hash, is_active = \'t\' FROM new_values new_value WHERE o.id = new_value.id AND o.generated_at < new_value.generated_at RETURNING o.* ) INSERT INTO market_data_orders (generated_at, price, volume_remaining, volume_entered, minimum_volume, order_range, id, is_bid, issue_date, duration, is_suspicious, message_key, uploader_ip_hash, mapregion_id, invtype_id, stastation_id, mapsolarsystem_id, is_active) SELECT generated_at, price, volume_remaining, volume_entered, minimum_volume, order_range, id, is_bid, issue_date, duration, is_suspicious, message_key, uploader_ip_hash, mapregion_id, invtype_id, stastation_id, mapsolarsystem_id, is_active FROM new_values WHERE NOT EXISTS (SELECT 1 FROM upsert up WHERE up.id = new_values.id) AND NOT EXISTS (SELECT 1 FROM market_data_orders WHERE id = new_values.id)';

            // Check if there already is that order
            for (x = 0; x < ordersToUpsert.length; x++) {
              upsertOrder(ordersToUpsert[x]);
            }

            upsertWaiting++;

            pg.connect(config.postgresConnectionString, function(err, pgClient, done){

              if (err) {
                  console.log('Postgres error:');
                  console.log(err);
              } else {

                // Execute query
                pgClient.query(upsertQuery, function(err, result) {
                  upsertWaiting--;
                  if (err) {
                    if (err.detail.indexOf('is not present in table \'eve_db_stastation\'') != -1) {
                      console.log('\nOrder upsert error: ' + err.detail + ' Update conquerable stations from CCP\'s API!'.yellow);
                    } else {
                      console.log('\nOrder upsert error:');
                      console.log(err);
                      if (config.extensiveLogging) console.log(values);
                    }
                  } else {
                    // Increase stat counters
                    orderUpserts += ordersToUpsert.length;
                    emdrStatsOrderInserts += result.rowCount;
                    emdrStatsOrderUpdates += ordersToUpsert.length - result.rowCount;
                  }

                  done();
                });
              }
            });

            // Schedule recalculation of stats, unless config.regionStatsDelay is 0
            if (config.regionStatsDelay === 0) {
              generateRegionStats(regionID, typeID);
            } else {
              scheduleRegionStatUpdate(regionID, typeID);
            }

            // Deactivate expired orders, if we do not have any suspicious orders in that message
            if (!hasSuspiciousOrders) {
              // Collect all order IDs
              var ids = [];
              for (x = 0; x < ordersToUpsert.length; x++) {
                ids.push(ordersToUpsert[x].orderID);
              }

              // Generate placeholders
              var placeholderIDs = ids.map(function(name, x) {
                return '$' + (x + 3);
              }).join(',');

              // Generate flat params array
              var params = [];
              params.push(regionID, typeID);
              params = params.concat(ids);

              pg.connect(config.postgresConnectionString, function(err, pgClient, done){

                if (err) {
                    console.log('Postgres error:');
                    console.log(err);
                } else {

                  // Execute query
                  pgClient.query('UPDATE market_data_orders SET is_active = \'f\' WHERE mapregion_id=$1 AND invtype_id=$2 AND is_active=\'t\' AND market_data_orders.id NOT IN (' + placeholderIDs + ')', params, function(err, result) {
                    if (err) {
                      console.log('\nOrder deactivation error:');
                      console.log(err);
                      if (config.extensiveLogging) console.log(params);
                    } else {
                      // Dont't do anything for now
                    }

                    done();

                  });
                }
              });
            }
          }
        }
      });
    }
  });
}

// Performs an order upsert

function upsertOrder(order) {
  pg.connect(config.postgresConnectionString, function(err, pgClient, done){

    if (err) {
        console.log('Postgres error:');
        console.log(err);

        done();

    } else {
      // Check if that order already exists
      pgClient.query('SELECT 1 FROM market_data_orders WHERE id=$1', [order.id], function(err, result) {
        if (err) {
          console.log('\nOrder existence check error:');
          console.log(err);
        }

        done();

      });
    }
  });
}

// Schedules a regionStatUpdate for a certain region/type combination in config.regionStatsDelay and executes due updates.

function scheduleRegionStatUpdate(regionID, typeID) {
  var now = new Date().getTime();

  if (regionID + '/' + typeID in scheduledRegionStatUpdates) {
    // Do nothing - since the update is scheduled already
  } else {
    // Add to scheduled list
    scheduledRegionStatUpdates[regionID + '/' + typeID] = now;
  }

  // Check for due updates
  for (var update in scheduledRegionStatUpdates) {
    if ((now - scheduledRegionStatUpdates[update]) >= config.regionStatsDelay) {
      // Get region/type and split them
      var variables = update.split('/');

      // Remove from list
      delete scheduledRegionStatUpdates[update];

      // Execute update
      generateRegionStats(variables[0], variables[1]);
    }
  }
}

// Generate regional stats

function generateRegionStats(regionID, typeID) {

  statWaiting++;

  pg.connect(config.postgresConnectionString, function(err, pgClientStats, doneStats) {

    if (err) {
      console.log('Postgres error:');
      console.log(err);
    } else {

      pgClientStats.query('SELECT price, is_bid, volume_remaining FROM market_data_orders WHERE mapregion_id = $1 AND invtype_id = $2 AND is_active = \'t\'', [regionID, typeID], function(err, result) {
        statWaiting--;

        doneStats();

        if (err) {
          console.log('\nError while fetching orders for regionStat generation:' + err);
        } else {

          // Aggregate arrays
          var bidPrices = [];
          var askPrices = [];

          // Put prices into array
          for (x = 0; x < result.rows.length; x++) {
            if (result.rows[x].is_bid === true) {
              bidPrices.push(result.rows[x].price);
            } else {
              askPrices.push(result.rows[x].price);
            }
          }

          // Check if we have prices for both bids and asks
          if (bidPrices.length > 0 && askPrices.length > 0) {
            // Convert arrays into Stats object
            bidPrices = new Stats(bidPrices);
            askPrices = new Stats(askPrices);

            // Filter top/bottom 5%
            bidPercentile5 = bidPrices.percentile(5);
            bidPercentile95 = bidPrices.percentile(95);
            bidPrices = bidPrices.band_pass(bidPercentile5, bidPercentile95);

            askPercentile5 = bidPrices.percentile(5);
            askPercentile95 = askPrices.percentile(95);
            askPrices = askPrices.band_pass(askPercentile5, askPercentile95);

            // Calculate various values
            bidMean = bidPrices.amean();
            bidMedian = bidPrices.median();
            bidStdDev = bidPrices.stddev();

            askMean = askPrices.amean();
            askMedian = askPrices.median();
            askStdDev = askPrices.stddev();

            //
            // Calculate weighted average
            //
            var bidPricesSum = 0;
            var bidPricesVolume = 0;

            var askPricesSum = 0;
            var askPricesVolume = 0;

            // Manually bandpass array
            for (x = 0; x < result.rows.length; x++) {
              if (result.rows[x].is_bid === true) {
                if (result.rows[x].price >= bidPercentile5 && result.rows[x].price <= bidPercentile95) {
                  bidPricesSum += result.rows[x].price * result.rows[x].volume_remaining;
                  bidPricesVolume += result.rows[x].volume_remaining;
                }
              } else {
                if (result.rows[x].price >= askPercentile5 && result.rows[x].price <= askPercentile95) {
                  askPricesSum = result.rows[x].price * result.rows[x].volume_remaining;
                  askPricesVolume += result.rows[x].volume_remaining;
                }
              }
            }

            // Actually calculate the weighted average
            bidWeightedAverage = (bidPricesSum / bidPricesVolume);
            askWeightedAverage = (askPricesSum / askPricesVolume);

            //
            // Generate dates
            //

            // Now
            var now = new Date();

            // Get today's downtime - this will be the starting point for each day's statistics
            var utc_downtime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 11)).toUTCString();

            //
            // Start querying the database
            //
            //
            // First, check if we have a history entry in the last 24 hours. If there is one, we have to insert/update
            // itemregionstats - if not, we have to add a new row to itemregionstatshistory *and* insert/update itemregionstats.
            //

            // Build query values
            var queryValuesHistory = [bidMean,
              bidWeightedAverage,
              bidMedian,
              askWeightedAverage,
              askMean,
              askMedian,
              bidPricesVolume,
              askPricesVolume,
              bidPercentile95,
              askPercentile95,
              regionID,
              typeID,
              utc_downtime,
              bidStdDev,
              askStdDev
            ];

            var queryValues = [bidMean,
              bidWeightedAverage,
              bidMedian,
              askWeightedAverage,
              askMean,
              askMedian,
              bidPricesVolume,
              askPricesVolume,
              bidPercentile95,
              askPercentile95,
              regionID,
              typeID,
              now.toUTCString(),
              bidStdDev,
              askStdDev,
              regionID,
              typeID
            ];

            regionStatHistoryWaiting++;

            pg.connect(config.postgresConnectionString, function(err, pgClient, done){

              if (err) {
                  console.log('Postgres error:');
                  console.log(err);
              } else {

                pgClient.query('SELECT 1 FROM market_data_itemregionstathistory WHERE mapregion_id = $1 AND invtype_id = $2 AND date >= NOW() - \'1 day\'::INTERVAL', [regionID, typeID], function(err, result) {
                  if (err) {
                    console.log('\nRegionStatHistory select error:');
                    console.log(err);
                    if (config.extensiveLogging) console.log(queryValues);

                    done();

                  } else {
                    if (result.rowCount === 0) {
                      // There is none, so we add a new history row
                      pgClient.query('INSERT INTO market_data_itemregionstathistory (buymean, buyavg, buymedian, sellmean, sellavg, sellmedian, buyvolume, sellvolume, buy_95_percentile, sell_95_percentile, mapregion_id, invtype_id, date, buy_std_dev, sell_std_dev) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)', queryValuesHistory, function(err, result) {
                        if (err) {
                          console.log('\nRegionStatHistory insert error:');
                          console.log(err);
                          if (config.extensiveLogging) console.log(queryValuesHistory);
                        }

                        done();

                      });
                    } else {
                      done();
                    }
                  }
                });
              }
            });

            pg.connect(config.postgresConnectionString, function(err, pgClient, done){

              if (err) {
                  console.log('Postgres error:');
                  console.log(err);
              } else {

                // Check if there is a row for that type - if there is not, insert the row
                pgClient.query('SELECT 1 FROM market_data_itemregionstat WHERE mapregion_id = $1 AND invtype_id = $2', [regionID, typeID], function(err, result) {
                  if (err) {
                    console.log('\nRegionStat select error:');
                    console.log(err);
                    if (config.extensiveLogging) console.log(queryValues);

                    done();
                  } else {
                    regionStatHistoryWaiting--;

                    if (result.rowCount === 0) {
                      // Insert new row
                      pgClient.query('INSERT INTO market_data_itemregionstat (buymean, buyavg, buymedian, sellmean, sellavg, sellmedian, buyvolume, sellvolume, buy_95_percentile, sell_95_percentile, mapregion_id, invtype_id, lastupdate, buy_std_dev, sell_std_dev) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)', queryValues.slice(0, 15), function(err, result) {
                        if (err) {
                          console.log('\nRegionStat insert error:');
                          console.log(err);
                          if (config.extensiveLogging) console.log(queryValues);
                        }

                        done();
                      });
                    } else {
                      // Update row
                      pgClient.query('UPDATE market_data_itemregionstat SET buymean=$1, buyavg=$2, buymedian=$3, sellmean=$4, sellavg=$5, sellmedian=$6, buyvolume=$7, sellvolume=$8, buy_95_percentile=$9, sell_95_percentile=$10, mapregion_id=$11, invtype_id=$12, lastupdate=$13, buy_std_dev=$14, sell_std_dev=$15 WHERE mapregion_id=$16 AND invtype_id=$17', queryValues, function(err, result) {
                        if (err) {
                          console.log('\nRegionStat update error:');
                          console.log(err);
                          if (config.extensiveLogging) console.log(queryValues);
                        }

                        done();
                      });
                    }
                  }
                });
              }
            });
          }
        }
      });
    }
  });
}

// Insert new EMDR stat datapoint
setInterval(function() {
  // Status codes
  // 0: Empty order messages
  // 1: Order Insert
  // 2: Old order (/ order update)
  // 3: Order update (/ old order)
  // 4: History message
  // 5: Order message
  // 6: History updates
  now = new Date(Date.now());

  pg.connect(config.postgresConnectionString, function(err, pgClient, done){

    if (err) {
        console.log('Postgres error:');
        console.log(err);
    } else {

      // Note the compact callback pyramid of doom here
      pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [0, emdrStatsEmptyOrderMessages, now], function(err, result) {
        pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [1, emdrStatsOrderInserts, now], function(err, result) {
          pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [2, emdrStatsOrderUpdates, now], function(err, result) {
            pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [3, emdrStatsOrderUpdates, now], function(err, result) {
              pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [4, emdrStatsHistoryMessages, now], function(err, result) {
                pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [5, emdrStatsOrderMessages, now], function(err, result) {
                  pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [6, emdrStatsHistoryUpdates, now], function(err, result) {
                    // Rest values
                    emdrStatsEmptyOrderMessages = 0;
                    emdrStatsOrderInserts = 0;
                    emdrStatsOrderUpdates = 0;
                    emdrStatsHistoryMessages = 0;
                    emdrStatsOrderMessages = 0;
                    emdrStatsHistoryUpdates = 0;
                    done();
                  });
                });
              });
            });
          });
        });
      });
    }
  });
}, config.emdrStatsInterval);

// Throttling
if (config.throttlingEnabled) {
  setInterval(function() {

    var logMessage = '';
    var now = new Date(Date.now());

    // Check if history backlog is too large
    if (historyWaiting > config.throttlingMaximumHistoryBacklog) {

      // Only if we already throttle history, check if we have to throttle orders, too
      if (throttleHistory) {

        // Check if we are above the threshold
        if ((stdDevWaiting > config.throttlingMaximumOrderBacklog) && !throttleOrders) {
          // Only notify once
          // Throttle history messages
          throttleOrders = true;

          logMessage = '\n[' + now.toLocaleTimeString() + '] Throttling order messages.';
          console.log(logMessage.red);
        } else {
          if (throttleOrders) {
            // Un-throttle orders
            throttleOrders = false;
            logMessage = '\n[' + now.toLocaleTimeString() + '] Throttling disabled for orders.';
            console.log(logMessage.green);
          }
        }

      } else {
        // Throttle history messages
        throttleHistory = true;

        logMessage = '\n[' + now.toLocaleTimeString() + '] Throttling history messages.';
        console.log(logMessage.yellow);
      }

    } else {

      if (throttleHistory || throttleOrders) {
        // Un-throttle history and orders
        throttleHistory = false;
        throttleOrders = false;

        logMessage = '\n[' + now.toLocaleTimeString() + '] Disabled throttling.';
        console.log(logMessage.green);
      }
    }
  }, 10000);
}

// Save caches
if (config.persistentCaching) {
  setInterval(function() {
    fs.writeFile('orderCache.json', JSON.stringify(orderCache), function(err) {
      if (err) {
        console.log('Error while saving order cache.'.red);
      } else {
        console.log('Saved order cache to disk.');
      }
    });

    fs.writeFile('historyCache.json', JSON.stringify(historyCache), function(err) {
      if (err) {
        console.log('Error while saving history cache.'.red);
      } else {
        console.log('Saved history cache to disk.');
      }
    });
  }, config.persistentCachingWriteInterval);
}

// Status
setInterval(function() {
  if (config.displayStats) {
    var dividend = config.statsInterval / 1000;
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    var now = new Date(Date.now());
    process.stdout.write('[' + now.toLocaleTimeString() + '] Receiving ' + (messagesTotal / dividend).toFixed() + ' (O:' + (messagesOrders / dividend).toFixed() + '/H:' + ((messagesTotal - messagesOrders) / dividend).toFixed() + ') messages per second. Performing ' + (orderUpserts / dividend).toFixed() + '/' + (ordersCacheHit / dividend).toFixed() + ' order upserts and ' + (historyUpserts / dividend).toFixed() + '/' + (historyRowCacheHit / dividend).toFixed() + ' history upserts per second. Backlog: history: ' + historyWaiting + ' / stdDev: ' + stdDevWaiting + ' / orders: ' + upsertWaiting + ' / statistics: ' + statWaiting + ' / regionStatHistory: ' + regionStatHistoryWaiting);
  }

  // Reset counters
  messagesTotal = 0;
  messagesOrders = 0;
  orderUpserts = 0;
  historyUpserts = 0;

  historyRowCacheHit = 0;
  ordersCacheHit = 0;
}, config.statsInterval);

// Newline
if (config.displayStats) {
  setInterval(function() {
    console.log('');
  }, config.statsNewline);
}

// Reconnect
// Voodoo code makes the zmq socket stay open
// Otherwise it would get removed by the garbage collection
setTimeout(function() {
  if (false) {
    zmqSocket.connect(relay);
  }
}, 1000 * 60 * 60 * 24 * 365);