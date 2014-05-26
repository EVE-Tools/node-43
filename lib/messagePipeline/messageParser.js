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

    // Filter for order messages as long as history is sent over EMDR
    if (marketData.resultType === 'orders') {
      error = null;

      resultSet = {
        hash: hash,
        objects: emds.getOrderObjects(marketData), // Extract objects from message
        regionTypes: emds.getDistinctRegionTypePairs(marketData) // Get region/type pairs
      };
    } else {
      error = new Error("[DEPRECATED] History Message");
      error.severity = 0;
    }

    callback(error, resultSet);
  });
};