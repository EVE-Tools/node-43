var DateCache = require('./DateCache');
var cache = new DateCache();

exports = module.exports = function(resultSet, callback){
  //
  // Let only new messages hit the DB
  //

  if (resultSet.type == 'history'){

    // SKIP
    // TODO: SEND EVENT

  } else {

    // Just pass empty messages
    if (resultSet.objects.length === 0){

      return callback(null, resultSet);

    } else {

      // Compose key of regionID-typeID pair
      var key = String(resultSet.regionID) + '-' + String(resultSet.typeID);
      var date = Date(resultSet.objects[0].generatedAt);

      if(cache.needsUpdate(key, date)) return callback(null, resultSet);
    }

    var error = new Error("Old order");
    error.severity = 1;

    return callback(error, null);
  }
};