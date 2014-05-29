function DateCache() {
  //
  // The date cache stores key/date pairs and provides a simple checking method
  //

  this.buffer = {};

}

DateCache.prototype.needsUpdate = function(key, date) {
  //
  // Checks whether an object needing an update is presently stored in the buffer
  //

  var updateNeeded = true;

  // Check if key is in buffer
  if(key in this.buffer) {
    // Check if stored date is newer than the new date
    if(this.buffer[key] > date) {
      updateNeeded = false;
    }
  } else {
    // Create key with supplied date
    this.buffer[key] = date;
  }

  return updateNeeded;
};

module.exports = DateCache;