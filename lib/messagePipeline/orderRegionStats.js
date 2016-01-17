var async = require('async');
var postgres = require('../postgres');

function prepareQueryValues(resultSet) {
  //
  // Prepare parametrized query
  //

  var params = '';
  var values = [];
  var count = 1;

  // Construct params string
  params = '($'+(count++)+
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
           '::float8)';

  // Get current time
  var now = new Date();

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
              now.toUTCString(),
              resultSet.metrics.bidStdDev,
              resultSet.metrics.askStdDev);

  return {
      params: params,
      values: values
  };
}

function upsertRegionStats(resultSet, callback) {

  var queryValues = prepareQueryValues(resultSet);

  // Get connection from pool
  postgres(function(err, pgClient, done) {
    if (err) {
      // Return connection to pool
      done();

      err.module = 'pgConnect';

      // Handle errors
      callback(err, null);
    } else {

      // Upsert history row
      pgClient.query('INSERT INTO market_data_itemregionstat AS stats (buymean, ' +
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
        'lastupdate, ' +
        'buy_std_dev, ' +
        'sell_std_dev) ' +
      'VALUES ' + queryValues.params + ' ' +
      'ON CONFLICT (mapregion_id, invtype_id) DO UPDATE SET ' +
        'buymean = excluded.buymean, ' +
        'buyavg = excluded.buyavg, ' +
        'buymedian = excluded.buymedian, ' +
        'sellmean = excluded.sellmean, ' +
        'sellavg = excluded.sellavg, ' +
        'sellmedian = excluded.sellmedian, ' +
        'buyvolume = excluded.buyvolume, ' +
        'sellvolume = excluded.sellvolume, ' +
        'buy_95_percentile = excluded.buy_95_percentile, ' +
        'sell_95_percentile = excluded.sell_95_percentile, ' +
        'lastupdate = excluded.lastupdate, ' +
        'buy_std_dev = excluded.buy_std_dev, ' +
        'sell_std_dev = excluded.sell_std_dev ', queryValues.values, function(err, result) {

        done(); // Return connection to pool

        if(err) {
          err.module = 'orderRegionStats#insertRegionStats';
        }

        resultSet.result = result;
        callback(err, resultSet); // Run callback of waterfall
      });
    }
  });
}


exports = module.exports = function(resultSet, callback) {
  //
  // Stores order statistics in itemRegionStats table
  //

  if(resultSet.objects.length === 0) {

    // SKIP EMPTY MESSAGES
    return callback(null, resultSet);

  } else {

    upsertRegionStats(resultSet, function(err, resultSet){
      return callback(err, resultSet);
    });
  }

};
