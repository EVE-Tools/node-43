var postgres = require('../postgres');

function deactivateEmptyResultSet(resultSet, callback){
  //
  // Deactivate all orders of region/type pairs in resultSet
  //


  // Get connection from pool
  postgres(function deactivateOrders(err, pgClient, done){

    // Run deactivation query of bound region/type pair
    if (err) {
        // Return connection to pool
        done();

        // Handle errors
        return callback(err, null);
    } else {
      // Execute query
      pgClient.query('UPDATE market_data_orders ' +
                     'SET is_active = \'f\'' +
                     'WHERE mapregion_id=$1::int8 AND invtype_id=$2::int8', [resultSet.regionID, resultSet.typeID], function(err) {

        // Return connection to pool
        done();

        // Handle errors
        if (err) {
          return callback(err, null);
        }
      });
    }
  });

  var error = new Error("Deactivated orders.");
  error.severity = 0;

  return callback(error, resultSet);
}


function prepareQueryValues(orderIDs){
  //
  // Prepare parametrized query
  //

  var params = '';
  var values = [];
  var count = 3;

  orderIDs.forEach(function(object){

    // Construct params string
    params += '$'+(count++)+'::int8,';

    // Add object's values to array
    values.push(object);
  });

  // Cut last comma
  params = params.slice(0, -1);

  return {
      params: params,
      values: values
  };
}

function composeQuery(objects){

  // Concatenate upsert query
  var query = 'UPDATE market_data_orders SET is_active = \'f\' ' +
              'WHERE mapregion_id=$1 AND invtype_id=$2 AND is_active=\'t\' AND market_data_orders.id ' +
              'NOT IN (' + objects.params + ')';

  return query;
}

function returnOrderID(order){return order.orderID;}

function deactivateSelected(resultSet, callback){
  //
  // Deactivate selected orders of region/type pairs in resultSet
  //

  // Get order IDs
  var orderIDs = resultSet.objects.map(returnOrderID);

  // Prepare parametrized format
  var objects = prepareQueryValues(orderIDs);

  // Compose query
  var query = composeQuery(objects);

  // Get connection from pool
  postgres(function deactivateSelectedOrders(err, pgClient, done){
    if (err) {
        // Return connection to pool
        done();

        // Handle errors
        return callback(err, null);
    } else {
      // Execute query
      pgClient.query(query, [resultSet.regionID, resultSet.typeID].concat(objects.values), function(err) {

        // Return connection to pool
        done();

        // Handle errors
        if (err) {
          return callback(err, null);
        } else {
          callback(null, resultSet);
        }
      });
    }
  });
}

exports = module.exports = function(resultSet, callback){
  //
  // Deactivate orders
  //

  if(resultSet.objects.length === 0){

    // Deactivate all orders in that region once we get an empty message
    deactivateEmptyResultSet(resultSet, callback);

  } else {
    // Deactivate orders not included in resultSet with same region/type pair
    deactivateSelected(resultSet, callback);
  }
};