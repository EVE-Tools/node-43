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
// Data flow throttling
//

// Sometimes there is just too much data incoming for PostgreSQL to catch up which results in the consumer crashing.
// To prevent this, the consumer is able to dynamically discard data. First, after the backlog exceeds a certain size,
// history messages are being rejected as they are not as important as the orders. If this does not help either, order
// messages are being rejected, too. Those values should be working for standard memory settings.
//
// Values for 8GB RAM (via –max-old-space-size=8192):
// History: 60000
// Orders: 75000

// Throttling enabled?
config.throttlingEnabled = true;

// Backlog threshold for history throttling
config.throttlingMaximumHistoryBacklog = 8000;

// Threshold for order throttling (stdDev queue as it's the first query performed)
config.throttlingMaximumOrderBacklog = 10000;

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
