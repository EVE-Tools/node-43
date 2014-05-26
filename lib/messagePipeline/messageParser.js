var zlib = require('zlib');
var murmurhash = require('murmurhash');
var emds = require('../emds');

exports = module.exports = function(message, callback) {
  //
  // Inflates and parses the message
  //

  // Inflate raw market JSON strings.
  zlib.inflate(message, function(error, marketJSON) {

    // Parse the JSON data.
    var marketData = JSON.parse(marketJSON);
    var hash = murmurhash.v3(JSON.stringify(marketData.rowsets));
    var resultSet = {};

    if (marketData.resultType == 'orders') {
      resultSet = {
        type: 'orders',
        hash: hash,
        objects: emds.getOrderObjects(marketData), // Extract objects from message
        regionTypes: emds.getDistinctRegionTypePairs(marketData) // Get region/type pairs
      };
    }

    if (marketData.resultType == 'history') {
      resultSet = {
        type: 'history',
        hash: hash,
        objects: emds.getHistoryObjects(marketData), // Extract history objects from message
        regionTypes: emds.getDistinctRegionTypePairs(marketData) // Get region/type pairs
      };
    }

    callback(error, resultSet);
  });
};