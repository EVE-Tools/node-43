var config = {};

//
// Data handling
//

// Defines how many standard deviations a price is allowed to differ from the mean before being considered as malicious
config.stdDevRejectionMultiplier = 3;

//
// Connection strings
//

// EMDR relay(s) the consumer will connect to
config.relays = ['tcp://relay-eu-germany-1.eve-emdr.com:8050'];

// Postgres login credentials
config.postgresConnectionString = 'tcp://sebastian@127.0.0.1:5432/element43';

// Maximum number of simultaneous connections to the Postgres instance
config.postgresMaxConnections = 10;

module.exports = config;
