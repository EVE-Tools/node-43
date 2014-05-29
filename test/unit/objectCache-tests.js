var should = require('should');
var ObjectCache = require('../../lib/objectCache');

describe('Object Cache', function() {
  var cache = new ObjectCache(100);

  it('should be initialized correctly', function() {
    cache.should.be.instanceOf(ObjectCache);
  });

  it('should allow the addition of objects', function() {
    for(var i = 0; i < 100; i++) {
      cache.push(i);
    }
  });

  it('should contain the added objects', function() {
    for(var i = 0; i < 100; i++) {
      cache.isPresent(i).should.be.true;
    }
  });

  it('should not contain non-existent objects', function() {
    cache.isPresent(101).should.not.be.true;
  });

  it('should overflow correctly', function() {
    cache.push(1337);
    cache.isPresent(1337).should.be.true;
  });

  it('should not contain overwritten values', function() {
    cache.isPresent(0).should.be.false;
  });

  it('should not overwrite values at the beginning of the buffer', function() {
    cache.isPresent(1).should.be.true;
  });

  it('should be type independent', function() {
    cache.push('yay');
    cache.isPresent('yay').should.be.true;
  });
});