//
// Metrics Collection Module
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

var axm = require('axm');
var eventCenter = require('../eventCenter');

var probe = axm.probe();

var meterMessageCheckIn = probe.meter({name: 'Check-Ins/s'});
var meterMessageCheckOut = probe.meter({name: 'Check-Outs/s'});
var meterOrderMessage = probe.meter({name: 'Order Messages/s'});
var meterEmptyOrderMessage = probe.meter({name: 'Empty Order Messages/s'});
var meterHistoryMessage = probe.meter({name: 'History Messages/s'});
var meterUpdatedOrder = probe.meter({name: 'Updated Orders/s'});
var meterInsertedOrder = probe.meter({name: 'Inserted Orders/s'});
var meterHistoryRecord = probe.meter({name: 'History Records/s'});

eventCenter.on('messageCheckIn', handleMessageCheckIn);
eventCenter.on('messageCheckOut', handleMessageCheckOut);
eventCenter.on('orderMessage', handleOrderMessage);
eventCenter.on('emptyOrderMessage', handleEmptyOrderMessage);
eventCenter.on('historyMessage', handleHistoryMessage);
eventCenter.on('updatedOrders', handleOrderUpdate);
eventCenter.on('updatedHistory', handleHistoryUpdate);

function handleMessageCheckIn(){meterMessageCheckIn.mark();}
function handleMessageCheckOut(){meterMessageCheckOut.mark();}
function handleOrderMessage(resultSet){meterOrderMessage.mark();}
function handleEmptyOrderMessage(resultSet){meterEmptyOrderMessage.mark();}
function handleHistoryMessage(){meterHistoryMessage.mark();}
function handleOrderUpdate(result){
  meterUpdatedOrder.mark(result.updated);
  meterInsertedOrder.mark(result.inserted);
}
function handleHistoryUpdate(numUpdatedRows){meterHistoryRecord.mark(numUpdatedRows);}
