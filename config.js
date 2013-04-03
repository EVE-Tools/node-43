var config = {};

//
// Data handling
//

// Defines how many standard deviations a price is allowed to differ from the mean before being considered as malicious
config.stdDevRejectionMultiplier = 3;

// Maximum age in hours a message can have before being rejected
config.maximumMessageAge = 8;

// Delayed region statistics generation (in milliseconds)
//
// Generating the statistical data for a type in a region (average, median, 95 percentile...) is rather cpmplex. If
// set to 0, this data will be generated instantly every time a new message arrives. However, on systems with less
// processing power this can lead to high CPU utilization in busy situations. To minimize the impact of duplicate
// combinations of type and region, processing can be delayed. This can impact realtime applications like the live price
// index on the front-page of Element43, as data will get processed for example every 10 minutes instead.
//
config.regionStatsDelay = 0;

//
// Stats display and logging
//

// You can disable the live statistics here
config.displayStats = true;

// The refresh interval for console stats in milliseconds
config.statsInterval = 5000;

// The interval for newlines for logging in milliseconds
config.statsNewline = 300000;

// Enable extensive logging to also log the SQL values/parameters if an error occurs
config.extensiveLogging = true;

//
// Caching
//

// Node43 keeps a cache of order messages and history datapoints to filter duplicate data.

// Enable persistent caching? (write cache to disk)
config.persistentCaching = true;

// The interval for writing the cache to disk
config.persistentCachingWriteInterval = 300000;

//
// Data flow throttling
//

// Sometimes there is just too much data incoming for PostgreSQL to catch up which results in the consumer crashing.
// To prevent this, the consumer is able to dynamically discard data. First, after the backlog exceeds a certain size,
// history messages are being rejected as they are not as important as the orders. If this does not help either, order
// messages are being rejected, too. Those values should be working for standard memory settings.
//
// Values for 8GB RAM (via –max-old-space-size=8192):
// History: 6000
// Orders: 7500

// Throttling enabled?
config.throttlingEnabled = true;

// Backlog threshold for history throttling
config.throttlingMaximumHistoryBacklog = 2000;

// Threshold for order throttling (stdDev queue as it's the first query performed)
config.throttlingMaximumOrderBacklog = 6000;

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
config.postgresConnectionString = 'tcp://element43:element43@localhost:5432/element43';

module.exports = config;
