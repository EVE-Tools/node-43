var config = {};

//
// Data handling
//

// Defines how many standard deviations a price is allowed to differ from the mean before being considered as malicious
config.stdDevRejectionMultiplier = 3;

// Maximum age a message can have before being rejected in hours
config.maximumMessageAge = 8;

//
// Stats display and logging
//

// You can disable the live statistics here
config.displayStats = true;

// The refresh interval for console stats in milliseconds
config.statsInterval = 500;

// The interval for newlines for logging in milliseconds
config.statsNewline = 300000;

// Enable extensive logging to also log the SQL values/parameters if an error occurs
config.extensiveLogging = true;

//
// EMDR Stats
//

// The interval for EMDR stat datapoints in milliseconds
config.emdrStatsInterval = 300000;

//
// Connection strings
//

// EMDR relay(s) the consumer will connect to
config.relays = ['tcp://localhost:8050'];

// Postgres login credentials
config.postgresConnectionString = 'tcp://element43:5432@localhost/element43';

module.exports = config;
