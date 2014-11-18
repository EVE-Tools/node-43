//
// app.js
// node43's main module
//

//
// Config
//

// Dependencies
var async = require('async');
var colors = require('colors');

// Load configuration
var config = require('./config');

// Load message pipeline components
var messageParser = require('./lib/messagePipeline/messageParser'),
  messageFilter = require('./lib/messagePipeline/messageFilter'),
  messageSplitter = require('./lib/messagePipeline/messageSplitter'),
  orderFilter = require('./lib/messagePipeline/orderFilter'),
  orderProcessor = require('./lib/messagePipeline/orderProcessor'),
  orderStore = require('./lib/messagePipeline/orderStore'),
  orderCleanup = require('./lib/messagePipeline/orderCleanup'),
  orderCalculateRegionStats = require('./lib/messagePipeline/orderCalculateRegionStats'),
  orderRegionStats = require('./lib/messagePipeline/orderRegionStats'),
  orderRegionStatsHistory = require('./lib/messagePipeline/orderRegionStatsHistory');

// Main client
var emdr = require('./lib/emdrClient')(config.relays);

// CREST client
var crest = require('./lib/crestPipeline/crestHistoryAgent');

// Event Center
var eventCenter = require('./lib/eventCenter');

// EMDR statistics collector
var emdrStatsCollector = require('./lib/emdrStats');

// Monitoring
var axm = require('axm');
var axmStatCollector = require('./lib/monitoring/axmStatCollector.js');

//
// Message Pipeline
//

// Listen for messages and process them asynchronously
emdr.on('message', function(message) {

  //
  // Messages are processed in this waterfall and are handed down from stage to stage.
  // For further reference read: http://dev.eve-central.com/unifieduploader/start
  //

  async.waterfall([
    function (callback) {
      messageParser(message, callback);   // Inflate, sanitize and parse messages
    },
    messageFilter,                        // Filter duplicate messages
    messageSplitter,                      // Splits multi region/type messages into separate resultSets
    orderFilter,                          // Filter cached order rows
    orderProcessor,                       // Determine suspicious orders
    orderStore,                           // Store cleaned order data
    orderCleanup,                         // Deactivate existing orders which were not present in message
    orderCalculateRegionStats,            // Calculates order stats of region/type pair
    orderRegionStats,                     // Store calculated values to itemRegionStat
    orderRegionStatsHistory               // Store calculated values to itemRegionStatHistory
  ], function (error, result) {
    //
    // Basic error logging
    //

    eventCenter.emit('messageCheckOut');

    if(error){

      if (error.severity !== 0) axm.notify(err);

      if (error.severity === 0) {
        //console.info(String(error.message).cyan);
      } else if (error.severity === 1) {
        console.info(String(error.message).yellow);
      } else if (error.severity === 2) {
        console.info(String(error.message).red);
      } else {
        console.log('EMDR Message Pipeline Error:'.red);

        // Handle Errors
        console.error(error);
      }
    }
  });
});
