// Increase default pool size of 5
var https = require('https');
https.globalAgent.maxSockets = 10;

var async = require('async');
var request = require('request');

var eventCenter = require('../eventCenter');
var DateCache = require('../dateCache');

var crestHistoryFilter = require('./crestHistoryFilter');
var crestHistoryDBFilter = require('./crestHistoryDBFilter');
var crestHistoryStore = require('./crestHistoryStore');

var cache = new DateCache();

//
// CREST API Pipeline - each message triggers a CREST history update
//

// List of region/type pairs ready to be enqueued into the requestQueue
var regionTypeList = [];

// Queue for CREST requests
var requestQueue = async.queue(processJob, 30);

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
  // Dequeue a given number of region/type pairs as long as the queue was not paused
  //

  var list = [];

  // Only run if queue wasn't paused
  if(!requestQueue.paused) {
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
    url: 'https://crest-tq.eveonline.com/market/' + task.regionID + '/history/?type=https://crest-tq.eveonline.com/inventory/types/' + task.typeID + '/'
    strictSSL: true,
    gzip: true,
    headers: {
     'User-Agent': 'Node43/2.3.0 (Git)'
    }
  };

  request(options, handleResponse.bind(null, task, callback));
}

function handleResponse(task, callback, error, response, body) {
  //
  // Parse response, filter and store it
  //

  if(typeof response !== 'undefined'){
    if (response.statusCode === 200) {

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
          crestHistoryDBFilter,                            // Filter even more datapoints by DB
          crestHistoryStore                                // Store datapoints
        ], function (error, result) {
          if(error){
            if (!error.severity === 0) {
              error.module = 'crestHistoryAgentRequest';

              // Log Errors
              console.error(error);
            }
          }
        });
      }
    } else if (response.statusCode === 502 || response.statusCode === 503) {
      // Re-enqueue region/type pair
      enqueueRegionType({regionID: task.regionID, typeID: task.typeID});

      if(!requestQueue.paused) {
        // Pause queue execution for 1 minute as error 502/503 indicates downtime or throttling
        console.log('[' + new Date().toTimeString() + '] ERROR 502/503 - Halting queue for 1 minute');
        console.log(body);

        requestQueue.pause();
        setTimeout(requestQueue.resume, 60000);
      }
    } else if (response.statusCode === 404) {
      console.log('CREST Exception: ' + body);
    } else {
      console.log(response.headers);
      console.log(body);
    }
  } else {
    console.log('CREST Request Error: ' + error);
  }

  callback(error, response);
}
