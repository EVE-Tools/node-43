var zmq = require('zmq');
var zmqSocket = zmq.socket('sub');

module.exports = function(relays) {

  //
  // Initializes a new EMDR client
  //

  this.relays = relays;

  // Connect to the relays specified in the config file
  for (var relay in this.relays) {
    process.stdout.write('Connecting to ' + relays[relay].underline + ':');

    // Connect to the relay.
    zmqSocket.connect(this.relays[relay]);

    console.log(' OK!'.green);
  }

  // Disable filtering
  zmqSocket.subscribe('');

  // Message Handling
  zmqSocket.on('error', function(error) {
    console.error('EMDR feed error: ' + error);
  });

  // Connection watchdog mechanism
  this.lastMessage = new Date().getTime();

  zmqSocket.on('message', function(message) {
    this.lastMessage =  new Date().getTime();
  }.bind(this));

  setInterval(watchConnection.bind(this), 1000);

  return zmqSocket;
};

function watchConnection() {
  var now = new Date();

  // Automatically try to reconnect if there were no messages for 10 seconds
  if((now.getTime() - this.lastMessage) > 10000) {
    console.log('Received no messages for 10 seconds. Reconnecting...');

    // Connect to the relays specified in the config file
    for (var relay in this.relays) {
      process.stdout.write('Reconnecting to ' + relays[relay].underline + ':');

      // Connect to the relay.
      try {
          zmqSocket.connect(relays[relay]);
          console.log(' OK!'.green);
      } catch(err) {
          console.log(' FAILURE!'.red);
          console.log(err.message);
      }
    }

    this.lastMessage = new Date().getTime();
  }
}
