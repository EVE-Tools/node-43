var regionTypes = [];

exports = module.exports = function(resultSet, callback) {
  //
  // Reduces known region/type pairs to latest datapoint
  //

  var error = null;
  var key = String(resultSet.regionID) + '-' + String(resultSet.typeID);

  // If index is found, only keep latest datapoint provided
  if (regionTypes.indexOf(key) != -1) {

    // Sort by date
    resultSet.items.sort(function(a,b) {
      // Turn your strings into dates, and then subtract them
      // to get a value that is either negative, positive, or zero.
      return new Date(b.date) - new Date(a.date);
    });

    resultSet.items = [resultSet.items[0]];

  }

  // Push key to list
  regionTypes.push(key);

  return callback(error, resultSet);
};