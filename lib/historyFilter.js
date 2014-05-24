var async = require('async');

function checkDatapoint(datapoint, callback){
  //
  // Checks an individal datapoint for validity
  //

  // Calculate age of datapoint in hours and months
  var date = new Date(datapoint.date);
  var now = new Date();
  var beginningOfThisMonth = new Date(now.getFullYear(), now.getMonth());

  var timeDiffHours = (now.getTime() - date.getTime()) / (1000 * 3600);
  var timeDiffMonths = ((beginningOfThisMonth.getMonth() + 12*beginningOfThisMonth.getFullYear()) - (date.getMonth() + 12*date.getFullYear()));

  // Only allow datapoints from today and older than 13 months
  if(timeDiffHours <= 24 || timeDiffMonths > 13){
    return callback(true);
  }

  return callback(false);
}

exports = module.exports = function(resultSet, callback){
  //
  // Filters history data
  //
  // The CREST API allows to fetch all historic data for
  // any type in any region from the beginning of the current
  // months ago up to 13 months back except for today.
  // So only datapoints older than 13 months from the beginning
  // of the current month and datapoints generated within the
  // last 24 hours will pass the filter.
  // An API call to fetch official data will be
  // scheduled immediately.
  //

  if (resultSet.type == 'orders'){

    // SKIP
    // TODO: SEND EVENT

    return callback(null, resultSet);

  } else {

    // Filter Datapoints
    async.filter(resultSet.objects, checkDatapoint, function(results){

      // If the result set would be empty now, only query the CREST API
      if(results.length === 0){
        var error = new Error("Filtered all datapoints.");
        error.severity = 0;

        return callback(error, null);
      } else {
        resultSet.objects = results;
      }

      if(resultSet.objects.length > 1) console.log(resultSet.objects);

      callback(null, resultSet);

      // TODO: trigger API Event
    });
  }
};