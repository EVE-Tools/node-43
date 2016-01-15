var postgres = require('../postgres');

exports = module.exports = function(resultSet, callback) {
  //
  // Reduces dataset to neccessary datapoints missing in DB
  //

  var error = null;

  // Sort by date
  resultSet.items.sort(function(a,b) {
    // Turn your strings into dates, and then subtract them
    // to get a value that is either negative, positive, or zero.
    return new Date(b.date) - new Date(a.date);
  });

  // Get connection from pool
  postgres(function(err, pgClient, done) {
    if (err) {
      // Return connection to pool
      done();

      err.module = 'pgConnect';

      // Handle errors
      callback(err, null);
    } else {
      pgClient.query('SELECT date FROM market_data_orderhistory '+
                              'WHERE mapregion_id = $1 '+
                                'AND invtype_id = $2 ' +
                              'ORDER BY date DESC LIMIT 1', [resultSet.regionID, resultSet.typeID], function(err, result) {
                                                                             done(); // Return connection to pool

                                                                             if(err) {
                                                                              err.module = 'crestHistoryDBFilter#crestHistoryDBFilter';
                                                                             }

                                                                             if(result.rowCount > 0) {
                                                                              resultSet.items = resultSet.items.filter(function(datapoint) {
                                                                                return new Date(datapoint.date) > result.rows[0].date;
                                                                              });

                                                                              if(resultSet.items.length === 0) {
                                                                                err = new Error("Filtered all datapoints!");
                                                                                err.severity = 0;
                                                                                return callback(err, resultSet); // Run callback of waterfall
                                                                              }
                                                                             }

                                                                             return callback(err, resultSet); // Run callback of waterfall
                                                                          });
    }
  });
};