var https = require('https');
https.globalAgent.maxSockets = 10;

var async = require('async');
var request = require('request');

var eventCenter = require('../eventCenter');
var DateCache = require('../dateCache');

var crestHistoryFilter = require('./crestHistoryFilter');
var crestHistoryStore = require('./crestHistoryStore');

var cache = new DateCache();

//
// CREST API Pipeline - each message triggers a CREST history update
//

// List of region/type pairs ready to be enqueued into the requestQueue
var regionTypeList = [];

// Queue for CREST requests
var requestQueue = async.queue(processJob, 10);

// Enqueue new jobs every second
setInterval(enqueueJobs, 1000);

// Register event handler for splitted message
eventCenter.on('splitMessage', enqueueRegionType);



function enqueueRegionType(resultSet) {
  //
  // Enqueues a region/type pair into CREST API queue
  //

  // Compose key of regionID-typeID pair
  var key = String(resultSet.regionID) + '-' + String(resultSet.typeID);

  // Get current time
  var now = new Date();

  // Get tomorrow 00:00:00 for caching purposes
  var tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()+1, 0));

  if(cache.needsUpdate(key, tomorrow)) {
    regionTypeList.push({regionID: Number(resultSet.regionID), typeID: Number(resultSet.typeID)});
  }
}

function dequeueRegionTypes(numPairs) {
  //
  // Dequeue a given number of region/type pairs as long as it's not downtime
  //

  var list = [];

  // Get current time
  var now = new Date();

  // Get today's DT
  var utcDowntimeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 55)).toUTCString();
  var utcDowntimeEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 11, 35)).toUTCString();

  // Only run if it's not downtime
  if(!(now > utcDowntimeStart && now < utcDowntimeEnd)) {
    while(regionTypeList.length > 0 && list.length < numPairs) {
      list.push(regionTypeList.shift());
    }
  }

  return list;
}

function enqueueJobs() {
  //
  // Enqueues up to 10 jobs every second into worker queue
  //

  var list = dequeueRegionTypes(10);
  requestQueue.push(list);
}

function processJob(task, callback) {
  //
  // Performs CREST request
  //

  var options = {
    url: 'https://public-crest.eveonline.com/market/' + task.regionID + '/types/' + task.typeID + '/history/',
    strictSSL: true,
    headers: {
     'User-Agent': 'Node43/2.0.0 (Git)'
    }
  };

  request(options, handleResponse.bind(null, task, callback));
}

function handleResponse(task, callback, error, response, body) {
  //
  // Parse response, filter and store it
  //

  if (!error && response.statusCode == 200) {

    var crestResponse = JSON.parse(body);

    if(crestResponse.items.length > 0) {
      crestResponse.regionID = task.regionID;
      crestResponse.typeID = task.typeID;

      //
      // Filter and store
      //

      async.waterfall([
        function (callback) {
          crestHistoryFilter(crestResponse, callback);   // Filter unnecessary datapoints
        },
        crestHistoryStore                                // Store datapoints
      ], function (error, result) {
        if(error){
          // Log Errors
          console.error(error);
        }
      });
    }
  } else {
    console.log(error);
  }

  callback(error, response);
}