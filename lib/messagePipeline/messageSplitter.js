var ObjectCache = require('../objectCache');
var cache = new ObjectCache(100);

function hasCorrectRegionTypeCombination(regionID, typeID, item, index, objects){
  //
  // Checks for correct region/type combination
  //

  var isCorrect = false;

  if((item.regionID == regionID) && (item.typeID == typeID)) isCorrect = true;

  return isCorrect;
}

exports = module.exports = function(resultSet, callback){
  //
  // Splits multi region/type messages into multiple individual resultSets
  //

  if(resultSet.objects.length === 0){

    // Pass empty messages
    callback(null, resultSet);

  } else {

    // Iterate over regions affected
    for (var regionID in resultSet.regionTypes) {

      // Iterate over types affected in that region
      for (i = 0; i < resultSet.regionTypes[regionID].length; i++) {

        var typeID = resultSet.regionTypes[regionID][i];
        var newResultSet = {};

        if (resultSet.type == 'orders') {
          newResultSet = {
            type: 'orders',
            hash: resultSet.hash,
            objects: resultSet.objects.filter(hasCorrectRegionTypeCombination.bind(this, regionID, typeID)), // Extract objects from message
            regionID: regionID,
            typeID: typeID
          };
        }

        if (resultSet.type == 'history') {
          newResultSet = {
            type: 'history',
            hash: resultSet.hash,
            objects: resultSet.objects.filter(hasCorrectRegionTypeCombination.bind(this, regionID, typeID)), // Extract history objects from message
            regionID: regionID,
            typeID: typeID
          };
        }

        // Return message
        callback(null, newResultSet);
      }
    }

  }
};