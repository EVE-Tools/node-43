//
// This file contains various helper functions for dealing with data provided by EMDR
//

function getOrderObjects(marketData) {
  //
  // Takes parsed UUDIF messages and converts them into sanitized JS objects
  //

  var result = [];

  for (var rowset in marketData.rowsets) {
    for (var row in marketData.rowsets[rowset].rows) {
      var orderObject = {};

      // Get column mapping
      for (var i = 0; i < marketData.columns.length; i++) {
        orderObject[marketData.columns[i]] = marketData.rowsets[rowset].rows[row][i];
      }

      // Add additional information
      orderObject.typeID = marketData.rowsets[rowset].typeID;
      orderObject.regionID = marketData.rowsets[rowset].regionID;
      orderObject.generatedAt = marketData.rowsets[rowset].generatedAt;

      for (i = 0; i < marketData.uploadKeys.length; i++) {
        if (marketData.uploadKeys[i].name === 'EMDR') {
          orderObject.ipHash = marketData.uploadKeys[i].key;
        }
      }

      // Append to result list
      result.push(orderObject);
    }
  }

  // Return filled list
  return result;
}

exports.getOrderObjects = getOrderObjects;

function getHistoryObjects(historyData) {
  //
  // Takes parsed UUDIF messages and converts them into sanitized JS objects
  //

  var result = [];

  for (var rowset in historyData.rowsets) {
    for (var row in historyData.rowsets[rowset].rows) {
      var historyObject = {};

      // Get column mapping
      for (var i = 0; i < historyData.columns.length; i++) {
        historyObject[historyData.columns[i]] = historyData.rowsets[rowset].rows[row][i];
      }

      // Add additional information
      historyObject.typeID = historyData.rowsets[rowset].typeID;
      historyObject.regionID = historyData.rowsets[rowset].regionID;
      historyObject.generatedAt = historyData.rowsets[rowset].generatedAt;

      result.push(historyObject);
    }
  }

  // Return filled list
  return result;
}

exports.getHistoryObjects = getHistoryObjects;

function getDistinctRegionTypePairs(marketData) {
  //
  // Takes parsed UUDIF messages and extracts unique sanitized region/type pairs
  //

  var result = {};

  for (var rowset in marketData.rowsets) {

    // If we don't have this region, add an empty list
    if (Object.keys(result).indexOf(String(marketData.rowsets[rowset].regionID)) === -1) {
      console.log(Object.keys(result));
      result[marketData.rowsets[rowset].regionID] = [];
    }

    // If that type is not in the list, add it
    if (result[marketData.rowsets[rowset].regionID].indexOf(String(marketData.rowsets[rowset].typeID)) === -1) {
      result[marketData.rowsets[rowset].regionID].push(marketData.rowsets[rowset].typeID);
    }
  }

  // Return filled list
  return result;
}

exports.getDistinctRegionTypePairs = getDistinctRegionTypePairs;
