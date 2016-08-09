var zlib = require('zlib');
var murmurhash = require('murmurhash');
var emds = require('../emds');
var eventCenter = require('../eventCenter');

exports = module.exports = function(message, callback) {
  //
  // Inflates and parses the message
  //

  eventCenter.emit('messageCheckIn');

  // Inflate raw market JSON strings.
  zlib.inflate(message, function(error, marketJSON) {

    // Parse the JSON data.
    var marketData = JSON.parse(marketJSON);

    if (marketData.generator.name != "CREST EMDR Bridge") {
      error = new Error("Unsupported uploader!");
      error.severity = 0;
      callback(error, null);
      return;
    }

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

      eventCenter.emit('orderMessage', resultSet);
    } else {
      error = new Error("[DEPRECATED] History Message");
      error.severity = 0;

      eventCenter.emit('historyMessage');
    }

    eventCenter.emit('parsedMessage', resultSet);

    callback(error, resultSet);
  });
};
