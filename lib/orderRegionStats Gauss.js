var async = require('async'),
    postgres = require('./postgres');


function prepareQueryValues(resultSet){
  //
  // Prepare parametrized query
  //

  var params = '';
  var values = [];
  var count = 1;

  resultSet.objects.forEach(function(object){

    // Construct params string
    params += '($'+(count++)+
              "::timestamp AT TIME ZONE 'UTC', $"+(count++)+
              '::float8, $'+(count++)+
              '::int4, $'+(count++)+
              '::int4, $'+(count++)+
              '::int4, $'+(count++)+
              '::int4, $'+(count++)+
              '::int8, $'+(count++)+
              '::bool, $'+(count++)+
              "::timestamp AT TIME ZONE 'UTC', $"+(count++)+
              '::int2, $'+(count++)+
              '::bool, $'+(count++)+
              '::varchar, $'+(count++)+
              '::varchar, $'+(count++)+
              '::int4, $'+(count++)+
              '::int4, $'+(count++)+
              '::int4, $'+(count++)+
              '::int4, $'+(count++)+
              '::bool),';

    // Add object's values to array
    values.push(object.generatedAt,
                object.price,
                object.volRemaining,
                object.volEntered,
                object.minVolume,
                object.range,
                object.orderID,
                object.bid,
                object.issueDate,
                object.duration,
                object.isSuspicious,
                null,
                object.ipHash,
                object.regionID,
                object.typeID,
                object.stationID,
                object.solarSystemID,
                true);
  });

  // Cut last comma
  params = params.slice(0, -1);

  return {
      params: params,
      values: values
  };
}

function composeQuery(objects){

  // Concatenate upsert query
  var query = 'WITH new_values (generated_at, price, volume_remaining, volume_entered, minimum_volume, order_range, id, is_bid, issue_date, duration, is_suspicious, message_key, uploader_ip_hash, mapregion_id, invtype_id, stastation_id, mapsolarsystem_id, is_active) ' +
              'AS (values ' + objects.params + '), ' +
              'upsert as ' +
              '( ' +
                'UPDATE market_data_orders o ' +
                  'SET price = new_value.price, ' +
                      'volume_remaining = new_value.volume_remaining, ' +
                      'generated_at = new_value.generated_at, ' +
                      'issue_date = new_value.issue_date, ' +
                      'is_suspicious = new_value.is_suspicious, ' +
                      'uploader_ip_hash = new_value.uploader_ip_hash, ' +
                      'is_active = \'t\' ' +
                'FROM new_values new_value ' +
                'WHERE o.id = new_value.id AND o.generated_at < new_value.generated_at ' +
                'RETURNING o.* ' +
              ')' +
              'INSERT INTO market_data_orders (generated_at, price, volume_remaining, volume_entered, minimum_volume, order_range, id, is_bid, issue_date, duration, is_suspicious, message_key, uploader_ip_hash, mapregion_id, invtype_id, stastation_id, mapsolarsystem_id, is_active) ' +
              'SELECT generated_at, price, volume_remaining, volume_entered, minimum_volume, order_range, id, is_bid, issue_date, duration, is_suspicious, message_key, uploader_ip_hash, mapregion_id, invtype_id, stastation_id, mapsolarsystem_id, is_active ' +
              'FROM new_values ' +
              'WHERE NOT EXISTS (SELECT 1 ' +
                                'FROM upsert up ' +
                                'WHERE up.id = new_values.id) ' +
                'AND NOT EXISTS (SELECT 1 ' +
                                'FROM market_data_orders ' +
                                'WHERE id = new_values.id) ';

  return query;
}

function executeQuery(query, values, pgClient, callback, results){
  // Execute query
  pgClient.query(query, values, function(err, result) {
    callback(err, result);
  });
}

function getRegionPrices(regionID, typeID, callback){
  // Get connection from pool
  postgres(function(err, pgClient, done){

    if (err) {
      // Return connection to pool
      done();

      // Handle errors
      callback(err, null);
    } else {
      pgClient.query('SELECT price, is_bid, volume_remaining ' +
                       'FROM market_data_orders WHERE mapregion_id = $1 ' +
                                                 'AND invtype_id = $2 ' +
                                                 'AND is_active = \'t\'', [regionID, typeID], function(err, result){
                                                    done(); // Return connection to pool
                                                    callback(err, result); // Run callback of waterfall
                                                 });
    }
  });
}

function splitPrices(result, callback){
  //
  // Splits prices into two arrays
  //

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

  // Throw error if there are not enough prices in our DB
  if (bidPrices.length > 0 && askPrices.length > 0) {
    callback(null, result.rows, {bid: bidPrices, ask: askPrices});
  } else {
    var error = new Error("Not enough prices to calculate stats!");
    error.severity = 0;
    callback(error, null);
  }
}

function isValueInRange(min, max, value, index, array){
  // Checks whether element is in range between min and max
  return ((value > min) && (value < max));
}

function performCalculations(data, prices, callback){
  //
  // Calculates statistical properties of prices
  //
  var gauss = require('gauss');

  // Convert arrays to Gauss vector
  var bidPrices = new gauss.Vector(prices.bid.sort());
  var askPrices = new gauss.Vector(prices.ask.sort());

  var metrics = {};

  // Filter top/bottom 5%
  metrics.bidPercentile5 = bidPrices.percentile(0.5);
  metrics.bidPercentile95 = bidPrices.percentile(0.6);
  var bidPrices95 = new gauss.Vector(prices.bid.filter(isValueInRange.bind(null, metrics.bidPercentile5, metrics.bidPercentile95)));

  if(bidPrices95.length < 5) bidPrices95 = bidPrices; // There is no point in calculating metrics for less than 5 values

  metrics.askPercentile5 = bidPrices.percentile(0.05);
  metrics.askPercentile95 = askPrices.percentile(0.95);
  var askPrices95 = new gauss.Vector(prices.ask.filter(isValueInRange.bind(null, metrics.askPercentile5, metrics.askPercentile95)));

  if(askPrices95.length < 5) askPrices95 = askPrices; // There is no point in calculating metrics for less than 5 values

  // Calculate various values
  metrics.bidMean = bidPrices95.mean();
  metrics.bidMedian = bidPrices95.median();
  metrics.bidStdDev = bidPrices95.stdev();

  metrics.askMean = askPrices95.mean();
  metrics.askMedian = askPrices95.median();
  metrics.askStdDev = askPrices95.stdev();

  //
  // Calculate weighted average
  //

  metrics.bidPricesSum = 0;
  metrics.bidPricesVolume = 0;

  metrics.askPricesSum = 0;
  metrics.askPricesVolume = 0;

  // Manually bandpass array
  for (x = 0; x < data.length; x++) {
    if (data[x].is_bid === true) {
      if (data[x].price >= metrics.bidPercentile5 && data[x].price <= metrics.bidPercentile95) {
        metrics.bidPricesSum += data[x].price * data[x].volume_remaining;
        metrics.bidPricesVolume += data[x].volume_remaining;
      }
    } else {
      if (data[x].price >= metrics.askPercentile5 && data[x].price <= metrics.askPercentile95) {
        metrics.askPricesSum = data[x].price * data[x].volume_remaining;
        metrics.askPricesVolume += data[x].volume_remaining;
      }
    }
  }

  // Actually calculate the weighted average
  metrics.bidWeightedAverage = (metrics.bidPricesSum / metrics.bidPricesVolume);
  metrics.askWeightedAverage = (metrics.askPricesSum / metrics.askPricesVolume);

  //
  // Generate dates
  //

  // Now
  var now = new Date();

  // Get today's downtime - this will be the starting point for each day's statistics
  var utc_downtime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 11)).toUTCString();

  console.log(metrics);
 var metrics = {};
  callback(null, metrics);

}

exports = module.exports = function(resultSet, callback){
  //
  // Calculates order statistics for itemRegionStats and itemRegionStatsHistory
  //

  if (resultSet.type == 'history'){

    // SKIP
    // TODO: SEND EVENT
    return callback(null, resultSet);

  } else if(resultSet.objects.length === 0){

    // SKIP EMPTY MESSAGES
    return callback(null, resultSet);

  } else {

    async.waterfall([
      function (callback){
        getRegionPrices(resultSet.regionID, resultSet.typeID, callback);   // Inflate, sanitize and parse messages
      },
      splitPrices,                                                         // Split bid/ask prices into separate arrays
      performCalculations,                                                 // Calculate statistical properties
      //updateItemRegionStats,                                               // Write itemRegionStats to DB
      //updateItemRegionStatHistory                                          // Write itemRegionStatHistory to DB
    ], function (error, result) {
      // Error handling
      callback(error, result);
    });
  }

};