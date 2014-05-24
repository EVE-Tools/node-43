var ObjectCache = require('./objectCache');
var cache = new ObjectCache(100);

function isDuplicateMessage(id){
  //
  // Checks for duplicate message IDs
  //

  var isDuplicate = cache.isPresent(id);

  if(!isDuplicate) cache.push(id);

  return isDuplicate;
}

exports = module.exports = function(resultSet, callback){
  //
  // Filters duplicate, empty and old messages
  //

  // Filter duplicates
  if (isDuplicateMessage(resultSet.hash)) error = new Error("Duplicate Message");

  // Filter empty history messages - empty order messages represent the non-existence of orders for that type in that region
  if ((resultSet.objects.length === 0) && (resultSet.type == 'history')){

    var error = new Error("Empty History Message");
    error.severity = 0;

    return callback(error, resultSet);
  }

  return callback(null, resultSet);
};