var _ = require('underscore');

function ObjectCache(bufferSize){
  //
  // Set size parameter during initialization
  //

  this.size = bufferSize;
  this.currentPos = 0;
  this.buffer = [];

}

ObjectCache.prototype.isPresent = function(object){
  //
  // Checks whether an object is presently stored in the buffer
  //

  var present = false;

  this.buffer.forEach(function iterateOverArray(element){
    if(_.isEqual(object, element)){
      present = true;
    }
  });

  return present;
};

ObjectCache.prototype.push = function(object){
  //
  // Push object to cache and overflow automatically
  //

  if (this.currentPos < this.size){
    this.buffer[this.currentPos] = object;
    this.currentPos++;
  }

  if (this.currentPos === this.size){
    this.buffer[this.currentPos] = object;
    this.currentPos = 0;
  }
};

module.exports = ObjectCache;