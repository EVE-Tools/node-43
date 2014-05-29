var async = require('async');
var eventCenter = require('./eventCenter');
var postgres = require('./postgres');

//
// EMDR statistics variables
//

var emdrStatsEmptyOrderMessages = 0;
var emdrStatsOrderInserts = 0;
var emdrStatsOrderUpdates = 0;
var emdrStatsHistoryMessages = 0;
var emdrStatsOrderMessages = 0;
var emdrStatsHistoryUpdates = 0;

//
// Event Listeners
//

eventCenter.on('orderMessage', function() {
  emdrStatsOrderMessages++;
});

eventCenter.on('historyMessage', function() {
  emdrStatsHistoryMessages++;
});

eventCenter.on('emptyOrderMessage', function() {
  emdrStatsEmptyOrderMessages++;
});

eventCenter.on('updatedOrders', function(result) {
  emdrStatsOrderInserts += result.inserted;
  emdrStatsOrderUpdates += result.updated;
});

eventCenter.on('updatedHistory', function(numUpdatedRows) {
  emdrStatsHistoryUpdates += numUpdatedRows;
});

//
// Insert new EMDR stat datapoint
//

setInterval(function() {
  // Status codes
  // 0: Empty order messages
  // 1: Order Insert
  // 2: Old order (/ order update)
  // 3: Order update (/ old order)
  // 4: History message
  // 5: Order message
  // 6: History updates

  var now = new Date(Date.now());


  // Get connection from pool
  postgres(function(err, pgClient, done) {
    if (err) {
        // Return connection to pool
        done();
    } else {
      // Run series of insert queries
      async.series([
        function (callback) {
          pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [0, emdrStatsEmptyOrderMessages, now], callback);
        },
        function (callback) {
          pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [1, emdrStatsOrderInserts, now], callback);
        },
        function (callback) {
          pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [2, emdrStatsOrderUpdates, now], callback);
        },
        function (callback) {
          pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [3, emdrStatsOrderUpdates, now], callback);
        },
        function (callback) {
          pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [4, emdrStatsHistoryMessages, now], callback);
        },
        function (callback) {
          pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [5, emdrStatsOrderMessages, now], callback);
        },
        function (callback) {
          pgClient.query('INSERT INTO market_data_emdrstats (status_type, status_count, message_timestamp) VALUES ($1, $2, $3)', [6, emdrStatsHistoryUpdates, now], callback);
        }
      ], function (err) {
        if (err) {
          console.log('EMDR stat error: ');
          console.log(err);
        }

        // Rest values
        emdrStatsEmptyOrderMessages = 0;
        emdrStatsOrderInserts = 0;
        emdrStatsOrderUpdates = 0;
        emdrStatsHistoryMessages = 0;
        emdrStatsOrderMessages = 0;
        emdrStatsHistoryUpdates = 0;
        done();
      });
    }
  });
}, 300000);