var eventCenter = require('../eventCenter');

function hasCorrectRegionTypeCombination(regionID, typeID, item) {
  //
  // Checks for correct region/type combination
  //

  var isCorrect = false;

  if((item.regionID == regionID) && (item.typeID == typeID)) {
    isCorrect = true;
  }

  return isCorrect;
}

exports = module.exports = function(resultSet, callback) {
  //
  // Splits multi region/type messages into multiple individual resultSets
  //

  if(resultSet.objects.length === 0) {

    // Pass empty messages
    callback(null, resultSet);

  } else {

    // Iterate over regions affected
    for (var regionID in resultSet.regionTypes) {

      // Iterate over types affected in that region
      for (var counter = 0; counter < resultSet.regionTypes[regionID].length; counter++) {

        var typeID = resultSet.regionTypes[regionID][counter];
        var newResultSet = {};

        newResultSet = {
          hash: resultSet.hash,
          objects: resultSet.objects.filter(hasCorrectRegionTypeCombination.bind(this, regionID, typeID)), // Extract objects from message
          regionID: regionID,
          typeID: typeID
        };

        eventCenter.emit('splitMessage', newResultSet);

        // Return message
        callback(null, newResultSet);
      }
    }

  }
};