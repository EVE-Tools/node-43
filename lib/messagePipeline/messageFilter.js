var ObjectCache = require('../objectCache');
var cache = new ObjectCache(100);

function isDuplicateMessage(id) {
  //
  // Checks for duplicate message IDs
  //

  var isDuplicate = cache.isPresent(id);

  if(!isDuplicate) {
    cache.push(id);
  }

  return isDuplicate;
}

exports = module.exports = function(resultSet, callback) {
  //
  // Filters duplicate, empty and old messages
  //

  var error = null;

  // Filter duplicates
  if (isDuplicateMessage(resultSet.hash)) {
    error = new Error("Duplicate Message");
    error.severity = 0;
  }

  return callback(error, resultSet);
};