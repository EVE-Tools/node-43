var zmq = require('zmq'),
    zmqSocket = zmq.socket('sub');

module.exports = function(relays) {

  //
  // Initializes a new EMDR client
  //

  // Connect to the relays specified in the config file
  for (var relay in relays) {
    process.stdout.write('Connecting to ' + relays[relay].underline + ':');

    // Connect to the relay.
    zmqSocket.connect(relays[relay]);

    console.log(' OK!'.green);
  }

  // Disable filtering
  zmqSocket.subscribe('');

  // Message Handling
  zmqSocket.on('error', function(error) {
    console.error('EMDR feed error: ' + error);
  });

  return zmqSocket;
};