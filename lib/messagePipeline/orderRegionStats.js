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
              resultSet.metrics.askStdDev,
              resultSet.regionID,
              resultSet.typeID);

  return {
      params: params,
      values: values
  };
}

function isPresentRegionStat(resultSet, callback) {
  // Get connection from pool
  postgres(function(err, pgClient, done) {
    if (err) {
      // Return connection to pool
      done();

      err.module = 'pgConnect';

      // Handle errors
      callback(err, null);
    } else {
      pgClient.query('SELECT 1 FROM market_data_itemregionstat '+
                             'WHERE mapregion_id = $1 '+
                               'AND invtype_id = $2', [resultSet.regionID, resultSet.typeID], function(err, result) {
                                                                             done(); // Return connection to pool

                                                                             if(err) {
                                                                              err.module = 'orderRegionStats#isPresentRegionStat';
                                                                             }

                                                                             resultSet.result = result;
                                                                             callback(err, resultSet); // Run callback of waterfall
                                                                          });
    }
  });
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

      if (resultSet.result.rowCount === 0) {

        // Insert new row
        pgClient.query('INSERT INTO market_data_itemregionstat (buymean, ' +
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
                                                               'sell_std_dev) VALUES (' + queryValues.params + ')', queryValues.values.slice(0, 15), function(err, result) {
          done(); // Return connection to pool

          if(err) {
            err.module = 'orderRegionStats#insertRegionStats';
          }

          resultSet.result = result;
          callback(err, resultSet); // Run callback of waterfall
        });
      } else {
        // Update row
        pgClient.query('UPDATE market_data_itemregionstat SET buymean=$1, ' +
                                                             'buyavg=$2, ' +
                                                             'buymedian=$3, ' +
                                                             'sellmean=$4, ' +
                                                             'sellavg=$5, ' +
                                                             'sellmedian=$6, ' +
                                                             'buyvolume=$7, ' +
                                                             'sellvolume=$8, ' +
                                                             'buy_95_percentile=$9, ' +
                                                             'sell_95_percentile=$10, ' +
                                                             'mapregion_id=$11, ' +
                                                             'invtype_id=$12, ' +
                                                             'lastupdate=$13, ' +
                                                             'buy_std_dev=$14, ' +
                                                             'sell_std_dev=$15 WHERE mapregion_id=$16 AND invtype_id=$17', queryValues.values, function(err, result) {
          done(); // Return connection to pool

          if(err) {
            err.module = 'orderRegionStats#updateRegionStats';
          }

          resultSet.result = result;
          callback(err, resultSet); // Run callback of waterfall
        });
      }
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

    async.waterfall([
      function (callback) {
        isPresentRegionStat(resultSet, callback); // Check if region/type pair already exists in DB
      },
      upsertRegionStats                           // Update / insert line
    ], function (error, result) {
      // Error handling
      callback(error, result);
    });
  }

};
