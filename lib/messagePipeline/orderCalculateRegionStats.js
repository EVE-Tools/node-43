var async = require('async');
var postgres = require('../postgres');
var Stats = require('fast-stats').Stats;

function getRegionPrices(regionID, typeID, callback) {
  // Get connection from pool
  postgres(function(err, pgClient, done) {

    if (err) {
      // Return connection to pool
      done();

      // Handle errors
      callback(err, null);
    } else {
      pgClient.query('SELECT price, is_bid, volume_remaining ' +
                       'FROM market_data_orders WHERE mapregion_id = $1 ' +
                                                 'AND invtype_id = $2 ' +
                                                 'AND is_active = \'t\'', [regionID, typeID], function(err, result) {
                                                    done(); // Return connection to pool
                                                    callback(err, result); // Run callback of waterfall
                                                 });
    }
  });
}

function splitPrices(result, callback) {
  //
  // Splits prices into two arrays
  //

  // Aggregate arrays
  var bidPrices = [];
  var askPrices = [];

  // Put prices into array
  for (var counter = 0; counter < result.rows.length; counter++) {
    if (result.rows[counter].is_bid === true) {
      bidPrices.push(result.rows[counter].price);
    } else {
      askPrices.push(result.rows[counter].price);
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

function calculateSums(metrics, data) {
  //
  // Summarizes ask/bid prices and volumes
  //

  // Manually bandpass array
  for (var counter = 0; counter < data.length; counter++) {

    if (data[counter].is_bid === true) {

      // Process bids
      if (data[counter].price >= metrics.bidPercentile5 && data[counter].price <= metrics.bidPercentile95) {
        metrics.bidPricesSum += data[counter].price * data[counter].volume_remaining;
        metrics.bidPricesVolume += data[counter].volume_remaining;
      }
    } else {

      // Process asks
      if (data[counter].price >= metrics.askPercentile5 && data[counter].price <= metrics.askPercentile95) {
        metrics.askPricesSum = data[counter].price * data[counter].volume_remaining;
        metrics.askPricesVolume += data[counter].volume_remaining;
      }
    }
  }

  return metrics;
}

function performCalculations(data, prices, callback) {
  //
  // Calculates statistical properties of prices
  //

  // Convert arrays to Stats vector
  var bidPrices = new Stats().push(prices.bid);
  var askPrices = new Stats().push(prices.ask);

  var metrics = {};

  // Filter top/bottom 5%
  metrics.bidPercentile5 = bidPrices.percentile(5);
  metrics.bidPercentile95 = bidPrices.percentile(95);
  var bidPrices95 = bidPrices.band_pass(metrics.bidPercentile5, metrics.bidPercentile95);

  if(bidPrices95.length < 5) {
    bidPrices95 = bidPrices; // There is no point in calculating metrics for less than 5 values
  }

  metrics.askPercentile5 = bidPrices.percentile(5);
  metrics.askPercentile95 = askPrices.percentile(95);
  var askPrices95 = askPrices.band_pass(metrics.askPercentile5, metrics.askPercentile95);

  if(askPrices95.length < 5) {
    askPrices95 = askPrices; // There is no point in calculating metrics for less than 5 values
  }

  // Calculate various values
  metrics.bidMean = bidPrices95.amean();
  metrics.bidMedian = bidPrices95.median();
  metrics.bidStdDev = bidPrices95.stddev();

  metrics.askMean = askPrices95.amean();
  metrics.askMedian = askPrices95.median();
  metrics.askStdDev = askPrices95.stddev();

  //
  // Calculate weighted average
  //

  metrics.bidPricesSum = 0;
  metrics.bidPricesVolume = 0;

  metrics.askPricesSum = 0;
  metrics.askPricesVolume = 0;

  // Summarize prices and volumes
  metrics = calculateSums(metrics, data);

  // Actually calculate the weighted average
  metrics.bidWeightedAverage = (metrics.bidPricesSum / metrics.bidPricesVolume);
  metrics.askWeightedAverage = (metrics.askPricesSum / metrics.askPricesVolume);

  callback(null, metrics);
}

exports = module.exports = function(resultSet, callback) {
  //
  // Calculates order statistics for itemRegionStats and itemRegionStatsHistory
  //

  if(resultSet.objects.length === 0) {

    // SKIP EMPTY MESSAGES
    return callback(null, resultSet);

  } else {

    async.waterfall([
      function (callback) {
        getRegionPrices(resultSet.regionID, resultSet.typeID, callback);   // Get statistical info of region/type pair
      },
      splitPrices,                              // Split bid/ask prices into separate arrays
      performCalculations                       // Calculate statistical properties
    ], function (error, result) {
      resultSet.metrics = result;
      // Error handling
      callback(error, resultSet);
    });
  }

};