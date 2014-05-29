//
// Global event emitter
// Allows modules to communicate via events
//
//
// - Event list -
//
// messageCheckIn                 - Emitted by messageParser when message was received
// messageCheckOut                - Emitted by callback of message pipeline when message left the pipeline
// orderMessage(resultSet)        - Emitted by messageParser when order message got parsed
// historyMessage                 - Emitted by messageParser when history message got parsed
// parsedMessage(resultSet)       - Emitted by messageParser when message got parsed
// splitMessage(resultSet)        - Emitted by messageSplitter for each region/type pair in every message
// emptyOrderMessage(resultSet)   - Emitted by orderFilter when an empty order message hits the module
// updatedOrders({inserted: X,
//                 updated: Y})   - Emitted by orderStore on finished order transaction
// updatedHistory(numUpdatedRows) - Emitted by crestHistoryStore on finished history transaction
//
//

var EventEmitter = require('events').EventEmitter;

var eventCenter = new EventEmitter();

module.exports = eventCenter;