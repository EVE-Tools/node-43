//
// Global event emitter
// Allows modules to communicate via events
//
//
// - Event list -
//
// parsedMessage(resultSet)   - Emitted by messageParser when message got parsed
// splitMessage(resultSet)    - Emitted by messageSplitter for each region/type pair in every message
//
//

var EventEmitter = require('events').EventEmitter;

var eventCenter = new EventEmitter();

module.exports = eventCenter;