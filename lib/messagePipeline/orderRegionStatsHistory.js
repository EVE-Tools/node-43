var async = require('async');
var postgres = require('../postgres');

function prepareQueryValues(resultSet) {
  //
  // Prepare parametrized query for history upsert
  //

  var params = '';
  var values = [];
  var count = 1;

  // Construct params string
  params = '$'+(count++)+
           '::float8, $'+(count++)+
           '::float8, $'+(count++)+
           '::float8, $'+(count++)+
           '::float8, $'+(count++)+
           '::float8, $'+(count++)+
           '::float8, $'+(count++)+
           '::int8, $'+(count++)+
           '::int8, $'+(count++)+
           '::float8, $'+(count++)+
           '::float8, $'+(count++)+
           '::int4, $'+(count++)+
           '::int4, $'+(count++)+
           "::timestamp AT TIME ZONE 'UTC', $"+(count++)+
           '::float8, $'+(count++)+
           '::float8';

  // Get current time
  var now = new Date();

  // Get today's downtime - this will be the starting point for each day's statistics
  var utc_downtime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 11)).toUTCString();

  values.push(resultSet.metrics.bidMean,
              resultSet.metrics.bidWeightedAverage,
              resultSet.metrics.bidMedian,
              resultSet.metrics.askWeightedAverage,
              resultSet.metrics.askMean,
              resultSet.metrics.askMedian,
              resultSet.metrics.bidPricesVolume,
              resultSet.metrics.askPricesVolume,
              resultSet.metrics.bidPercentile95,
              resultSet.metrics.askPercentile95,
              resultSet.regionID,
              resultSet.typeID,
              utc_downtime,
              resultSet.metrics.bidStdDev,
              resultSet.metrics.askStdDev);

  return {
      params: params,
      values: values
  };
}

function isPresentRegionStatHistory(resultSet, callback) {
  // Get connection from pool
  postgres(function(err, pgClient, done) {
    if (err) {
      // Return connection to pool
      done();

      // Handle errors
      callback(err, null);
    } else {
      pgClient.query('SELECT 1 FROM market_data_itemregionstathistory ' +
                             'WHERE mapregion_id = $1 ' +
                               'AND invtype_id = $2 ' +
                               'AND date >= NOW() - \'1 day\'::INTERVAL', [resultSet.regionID, resultSet.typeID], function(err, result) {
                                                                             done(); // Return connection to pool
                                                                             resultSet.result = result;
                                                                             callback(err, resultSet); // Run callback of waterfall
                                                                          });
    }
  });
}

function upsertRegionStatHistory(resultSet, callback) {

  var queryValues = prepareQueryValues(resultSet);

  // Get connection from pool
  postgres(function(err, pgClient, done) {
    if (err) {
      // Return connection to pool
      done();

      // Handle errors
      callback(err, null);
    } else {

      if (resultSet.result.rowCount === 0) {
        // There is none, so we add a new history row
        pgClient.query('INSERT INTO market_data_itemregionstathistory (buymean, ' +
                                                                      'buyavg, ' +
                                                                      'buymedian, ' +
                                                                      'sellmean, ' +
                                                                      'sellavg, ' +
                                                                      'sellmedian, ' +
                                                                      'buyvolume, ' +
                                                                      'sellvolume, ' +
                                                                      'buy_95_percentile, ' +
                                                                      'sell_95_percentile, ' +
                                                                      'mapregion_id, ' +
                                                                      'invtype_id, ' +
                                                                      'date, ' +
                                                                      'buy_std_dev, ' +
                                                                      'sell_std_dev)VALUES (' + queryValues.params + ')', queryValues.values, function(err, result) {
          done(); // Return connection to pool
          resultSet.result = result;
          callback(err, resultSet); // Run callback of waterfall
        });
      }
    }
  });
}


exports = module.exports = function(resultSet, callback) {
  //
  // Stores order statistics in itemRegionStatsHistory table
  //

  if(resultSet.objects.length === 0) {

    // SKIP EMPTY MESSAGES
    return callback(null, resultSet);

  } else {

    async.waterfall([
      function (callback) {
        isPresentRegionStatHistory(resultSet, callback); // Check if region/type pair already exists in DB
      },
      upsertRegionStatHistory                            // Update / insert line
    ], function (error, result) {
      // Error handling
      callback(error, result);
    });
  }

};