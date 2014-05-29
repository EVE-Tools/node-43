var eventCenter = require('../eventCenter');
var async = require('async');
var colors = require('colors');
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
  var query = 'WITH new_values (generated_at, price, volume_remaining, volume_entered, minimum_volume, order_range, id, is_bid, issue_date, duration, is_suspicious, message_key, uploader_ip_hash, mapregion_id, invtype_id, stastation_id, mapsolarsystem_id, is_active) ' +
              'AS (values ' + objects.params + '), ' +
              'upsert as ' +
              '( ' +
                'UPDATE market_data_orders o ' +
                  'SET price = new_value.price, ' +
                      'volume_remaining = new_value.volume_remaining, ' +
                      'generated_at = new_value.generated_at, ' +
                      'issue_date = new_value.issue_date, ' +
                      'is_suspicious = new_value.is_suspicious, ' +
                      'uploader_ip_hash = new_value.uploader_ip_hash, ' +
                      'is_active = \'t\' ' +
                'FROM new_values new_value ' +
                'WHERE o.id = new_value.id AND o.generated_at < new_value.generated_at ' +
                'RETURNING o.* ' +
              ')' +
              'INSERT INTO market_data_orders (generated_at, price, volume_remaining, volume_entered, minimum_volume, order_range, id, is_bid, issue_date, duration, is_suspicious, message_key, uploader_ip_hash, mapregion_id, invtype_id, stastation_id, mapsolarsystem_id, is_active) ' +
              'SELECT generated_at, price, volume_remaining, volume_entered, minimum_volume, order_range, id, is_bid, issue_date, duration, is_suspicious, message_key, uploader_ip_hash, mapregion_id, invtype_id, stastation_id, mapsolarsystem_id, is_active ' +
              'FROM new_values ' +
              'WHERE NOT EXISTS (SELECT 1 ' +
                                'FROM upsert up ' +
                                'WHERE up.id = new_values.id) ' +
                'AND NOT EXISTS (SELECT 1 ' +
                                'FROM market_data_orders ' +
                                'WHERE id = new_values.id) ';

  return query;
}

function executeQuery(resultSet, callback) {

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

    // Retry 3X by default, since the CTE-upsert-code is not very safe for parallel execution
    async.retry(3, executeQuery.bind(null, resultSet), function(err) {

      // Handle errors
      if (err) {
        return callback(err, null);
      } else {
        callback(null, resultSet);
      }
    });

  }
};