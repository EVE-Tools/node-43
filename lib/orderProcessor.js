var async = require('async'),
    postgres = require('./postgres');

// Load configuration
var config = require('../config');

function getStatisticalInformation(regionID, typeID, callback){
  //
  // Return statistical properties of given region/type pair
  //

  // Get connection from pool
  postgres(function(err, pgClient, done){
    if (err) {
        // Return connection to pool
        done();

        // Handle errors
        return callback(err, null);
    } else {

      // Execute query
      pgClient.query({
        name: 'upsert_orders_stddev',
        text: 'SELECT COUNT(id), STDDEV(price), AVG(price) FROM market_data_orders WHERE invtype_id=$1 AND mapregion_id=$2 AND is_active=\'t\' AND is_suspicious=\'f\'',
        values: [typeID, regionID]
      }, function(err, result) {

        // Return connection to pool
        done();

        // Handle errors
        if (err) {
          return callback(err, null);
        } else {
          var returnValue = {
            region: regionID,
            type: typeID,
            count: result.rows[0].count,
            stddev: result.rows[0].stddev,
            avg: result.rows[0].avg
          };
          return callback(null, returnValue);
        }
      });
    }
  });
}


function annotateOrders(resultSet, statisticalProperties){
  //
  // Add isSuspicious flag to orders
  //

  // Iterate over orders and add isSuspicious flag
  return resultSet.objects.map(processOrder.bind(statisticalProperties));
}

function processOrder(order, index, array){
  //
  // Calculate whether order is suspicious which is an arbitrary definition.
  // Any orders that are outside config.stdDevRejectionMultiplier standard deviations
  // of the mean AND where there are more than 5 orders of like type in the region will be flagged.
  // Flags: True = Yes (suspicious), False = No (not suspicious)
  //

  var delta = 0.0;
  var range = 0.0;

  // First, check if we have more than 5 orders present,
  // then check if price is right or left of the mean value
  if ((this.count > 5) && (order.price > this.avg)) {

    delta = order.price - this.avg;
    range = config.stdDevRejectionMultiplier * this.stddev;

    // If the distance between mean and price is greater than config.stdDevRejectionMultiplier * σ this must be a suspicious order
    if ((delta > range) && order.bid){
      order.isSuspicious = true;
    } else {
      order.isSuspicious = false;
    }

  } else if ((this.count > 5) && (order.price < this.avg)) {

    delta = this.avg - order.price;
    range = config.stdDevRejectionMultiplier * this.stddev;

    // If the distance between mean and price is greater than config.stdDevRejectionMultiplier * σ this must be a suspicious order
    if ((delta > range) && !order.bid) {
      order.isSuspicious = true;
    } else {
      order.isSuspicious = false;
    }

  } else {
    // Not enough datapoints for a reliable guess
    order.isSuspicious = false;
  }

  return order;
}

exports = module.exports = function(resultSet, callback){
  //
  // Annotate order messages with isSuspicious flag
  //

  if (resultSet.type == 'history'){

    // SKIP
    // TODO: SEND EVENT

    return callback(null, resultSet);

  } else if(resultSet.objects.length === 0){

    // SKIP EMPTY MESSAGES
    return callback(null, resultSet);

  } else {
    getStatisticalInformation(resultSet.regionID, resultSet.typeID, function (err, results){
      if(err){
        return callback(err, null);
      } else {
        resultSet.objects = annotateOrders(resultSet, results);
        callback(null, resultSet);
      }
    });
  }
};