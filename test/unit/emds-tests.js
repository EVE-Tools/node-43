var fs = require('fs');
var path = require('path');

var should = require('should');
var emds = require('../../lib/emds');

describe('EVE Market Data Structures', function() {

  var orderJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../fixtures/orders.json")));
  var orderObjects = [];

  var historyJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../fixtures/history.json")));
  var histroyObjects = [];

  describe('#getOrderObjects', function() {
    it('should parse the JSON correctly', function() {
      orderObjects = emds.getOrderObjects(orderJSON);
      orderObjects.should.be.instanceOf(Object);
    });

    it('should return the exact number of order objects', function() {
      orderObjects.length.should.be.exactly(10);
    });

    it('should assign the correct order type', function() {
      for(var i = 0; i < 5; i++) {
        orderObjects[i]['typeID'].should.be.exactly(5279);
      }

      for(i = 5; i < 10; i++) {
        orderObjects[i]['typeID'].should.be.exactly(34);
      }
    });

    it('should assign the correct region', function() {
      for(var i = 0; i < 5; i++) {
        orderObjects[i]['regionID'].should.be.exactly(10000002);
      }
    });

    it('should assign the correct generation date', function() {
      for(var i = 0; i < 10; i++) {
        orderObjects[i]['generatedAt'].should.be.equal('2014-02-01T12:25:19+00:00');
      }
    });

    it('should assign the correct IP hash', function() {
      for(var i = 0; i < 10; i++) {
        orderObjects[i]['ipHash'].should.be.equal('e43hash');
      }
    });

    it('should assign the correct ask/bid value', function() {
      orderObjects[0]['bid'].should.be.false;
      orderObjects[4]['bid'].should.be.true;
    });

  });

  describe('#getHistoryObjects', function() {
    it('should parse the JSON correctly', function() {
      historyObjects = emds.getHistoryObjects(historyJSON);
      historyObjects.should.be.instanceOf(Object);
    });

    it('should return the exact number of history objects', function() {
      historyObjects.length.should.be.exactly(14);
    });

    it('should assign the correct row type', function() {
      for(var i = 0; i < 11; i++) {
        historyObjects[i]['typeID'].should.be.exactly(26929);
      }

      for(i = 11; i < 14; i++) {
        historyObjects[i]['typeID'].should.be.exactly(34);
      }
    });

    it('should assign the correct region', function() {
      for(var i = 0; i < 5; i++) {
        historyObjects[i]['regionID'].should.be.exactly(10000048);
      }
    });

    it('should assign the correct generation date', function() {
      for(var i = 0; i < 5; i++) {
        historyObjects[i]['generatedAt'].should.be.equal('2014-02-01T13:07:59+00:00');
      }
    });

  });

  describe('#distinctRegionTypePairs', function() {
    it('should return the exact number distinct pairs for orders', function() {
      Object.keys(emds.getDistinctRegionTypePairs(orderJSON)).length.should.be.exactly(2);
    });

    it('should return the exact number distinct pairs for history', function() {
      Object.keys(emds.getDistinctRegionTypePairs(historyJSON)).length.should.be.exactly(2);
    });
  });
});