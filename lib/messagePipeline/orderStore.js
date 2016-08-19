var eventCenter = require('../eventCenter');
var postgres = require('../postgres');


function prepareQueryValues(resultSet) {
  //
  // Prepare parametrized query
  //

  var params = '';
  var values = [];
  var count = 1;

  resultSet.objects.forEach(function(object) {

    // Construct params string
    params += '($'+(count++)+
              "::timestamp AT TIME ZONE 'UTC', $"+(count++)+
              '::float8, $'+(count++)+
              '::int4, $'+(count++)+
              '::int4, $'+(count++)+
              '::int4, $'+(count++)+
              '::int4, $'+(count++)+
              '::int8, $'+(count++)+
              '::bool, $'+(count++)+
              "::timestamp AT TIME ZONE 'UTC', $"+(count++)+
              '::int2, $'+(count++)+
              '::bool, $'+(count++)+
              '::varchar, $'+(count++)+
              '::varchar, $'+(count++)+
              '::int4, $'+(count++)+
              '::int4, $'+(count++)+
              '::int4, $'+(count++)+
              '::int4, $'+(count++)+
              '::bool),';

    // Add object's values to array
    values.push(object.generatedAt,
                object.price,
                object.volRemaining,
                object.volEntered,
                object.minVolume,
                object.range,
                object.orderID,
                object.bid,
                object.issueDate,
                object.duration,
                object.isSuspicious,
                null,
                object.ipHash,
                object.regionID,
                object.typeID,
                object.stationID,
                object.solarSystemID,
                true);
  });

  // Cut last comma
  params = params.slice(0, -1);

  return {
      params: params,
      values: values
  };
}

function composeQuery(objects) {

  // Concatenate upsert query
  var query = 'INSERT INTO market_data_orders AS orders (generated_at, ' +
                'price, ' +
                'volume_remaining, ' +
                'volume_entered, ' +
                'minimum_volume, ' +
                'order_range, ' +
                'id, ' +
                'is_bid, ' +
                'issue_date, ' +
                'duration, ' +
                'is_suspicious, ' +
                'message_key, ' +
                'uploader_ip_hash, ' +
                'mapregion_id, ' +
                'invtype_id, ' +
                'stastation_id, ' +
                'mapsolarsystem_id, ' +
                'is_active) ' +
              'VALUES ' + objects.params + ' ' +
              'ON CONFLICT (id) DO UPDATE SET ' +
                'price = excluded.price, ' +
                'volume_remaining = excluded.volume_remaining, ' +
                'generated_at = excluded.generated_at, ' +
                'issue_date = excluded.issue_date, ' +
                'is_suspicious = excluded.is_suspicious, ' +
                'uploader_ip_hash = excluded.uploader_ip_hash, ' +
                'is_active = \'t\' ' +
              'WHERE orders.id = excluded.id AND orders.generated_at < excluded.generated_at;';

  return query;
}

function executeQuery(resultSet, callback) {

  // Filter orders from citadels
  resultSet.objects = resultSet.objects.filter(function(order){
    return order.stationID < 1000000000000;
  });

  // Prepare parametrized format
  var objects = prepareQueryValues(resultSet);

  // Compose query
  var query = composeQuery(objects);

  // Get connection from pool
  postgres(function(err, pgClient, done) {
    if (err) {
      // Return connection to pool
      done();

      err.module = 'pgConnect';

      // Handle errors
      return callback(err, null);
    } else {
      // Execute query
      pgClient.query(query, objects.values, function(err, result) {
        // Return connection to pool
        done();

        if(err && err.code === '23503') {
          console.log('SDE Outdated: '.yellow + err.detail);
        } else if (err) {
          err.module = 'orderStore#executeQuery';
        } else {
          // Fire events
          eventCenter.emit('updatedOrders', {inserted: result.rowCount, updated: objects.values.length - result.rowCount});
        }

        // Return callback
        callback(err, result);
      });
    }
  });
}

exports = module.exports = function(resultSet, callback) {
  //
  // Stores orders
  //

  if(resultSet.objects.length === 0) {

    // SKIP EMPTY MESSAGES
    return callback(null, resultSet);

  } else {

    executeQuery(resultSet, function(err, result) {
      // Handle errors
      if (err) {
        return callback(err, null);
      } else {
        return callback(null, resultSet);
      }
    });
  }
};