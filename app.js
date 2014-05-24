//
// app.js
// node43's main module
//

//
// Config
//

// Dependencies
var async = require('async'),
  colors = require('colors');

// Load configuration
var config = require('./config');

// Load message pipeline components
var messageParser = require('./lib/messageParser'),
  messageFilter = require('./lib/messageFilter'),
  messageSplitter = require('./lib/messageSplitter'),
  historyFilter = require('./lib/historyFilter'),
  historyStore = require('./lib/historyStore'),
  orderFilter = require('./lib/orderFilter'),
  orderProcessor = require('./lib/orderProcessor'),
  orderStore = require('./lib/orderStore'),
  orderCleanup = require('./lib/orderCleanup'),
  orderRegionStats = require('./lib/orderRegionStats');

// Main client
var emdr = require('./lib/emdrClient')(config.relays);

//
// Message Pipeline
//

// Listen for messages and process them asynchronously
emdr.on('message', function(message) {

  //
  // Messages are processed in this waterfall and are handed down from stage to stage.
  // Skip steps on message type mismatch (e.g. handing orders to a history processing module)
  // For further reference read: http://dev.eve-central.com/unifieduploader/start
  //

  async.waterfall([
    function (callback){
      messageParser(message, callback);   // Inflate, sanitize and parse messages
    },
    messageFilter,                        // Filter duplicate messages
    messageSplitter,                      // Splits multi region/type messages into separate resultSets
    historyFilter,                        // Filter history rows and dispatch CREST updates (skip order messages)
    historyStore,                         // Store cleaned history data
    orderFilter,                          // Filter cached order rows (skip history messages)
    orderProcessor,                       // Determine suspicious orders
    orderStore,                           // Store cleaned order data
    orderCleanup,                         // Deactivate existing orders which were not present in message
    orderRegionStats                      // Generate itemRegionStats and itemRegionStatsHistory for affected types
  ], function (error, result) {
    //
    // Basic error logging
    //

    if(error){
      if (error.severity === 0){
        //console.info(String(error.message).cyan);
      } else if (error.severity === 1){
        console.info(String(error.message).yellow);
      } else if (error.severity === 2){
        console.info(String(error.message).red);
      } else {
        // Handle Errors
        console.error(error);
      }
    }
  });
});

//
// CREST API Pipeline
//

// on history enqueue
  // check history cache
  // make api call
  // merge data
