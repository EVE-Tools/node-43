//
// Contains global postgres connection pool and
// allows connections to be retrieved from the pool.
//

// Load configuration
var config = require('../config');

// Load postgres driver
var pg = require('pg');

// Set up postgres connection pool size
pg.defaults.poolSize = config.postgresMaxConnections;

// Retrieves a connection from the pool
var getConnection = function(callback){
  pg.connect(config.postgresConnectionString, function(err, pgClient, done){

    // Return connection to callback function
    // The callback must handle all errors appropriately
    callback(err, pgClient, done);
  });
};

module.exports = getConnection;
