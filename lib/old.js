// Check if we have prices for both bids and asks
if (bidPrices.length > 0 && askPrices.length > 0) {

  //
  // Start querying the database
  //
  //
  // First, check if we have a history entry in the last 24 hours. If there is one, we have to insert/update
  // itemregionstats - if not, we have to add a new row to itemregionstatshistory *and* insert/update itemregionstats.
  //

  // Build query values
  var queryValuesHistory = [bidMean,
    bidWeightedAverage,
    bidMedian,
    askWeightedAverage,
    askMean,
    askMedian,
    bidPricesVolume,
    askPricesVolume,
    bidPercentile95,
    askPercentile95,
    regionID,
    typeID,
    utc_downtime,
    bidStdDev,
    askStdDev
  ];

  var queryValues = [bidMean,
    bidWeightedAverage,
    bidMedian,
    askWeightedAverage,
    askMean,
    askMedian,
    bidPricesVolume,
    askPricesVolume,
    bidPercentile95,
    askPercentile95,
    regionID,
    typeID,
    now.toUTCString(),
    bidStdDev,
    askStdDev,
    regionID,
    typeID
  ];

  regionStatHistoryWaiting++;

  pg.connect(config.postgresConnectionString, function(err, pgClient, done){

    if (err) {
        console.log('Postgres error:');
        console.log(err);
    } else {

      pgClient.query('SELECT 1 FROM market_data_itemregionstathistory WHERE mapregion_id = $1 AND invtype_id = $2 AND date >= NOW() - \'1 day\'::INTERVAL', [regionID, typeID], function(err, result) {
        if (err) {
          console.log('\nRegionStatHistory select error:');
          console.log(err);
          if (config.extensiveLogging) console.log(queryValues);

          done();

        } else {
          if (result.rowCount === 0) {
            // There is none, so we add a new history row
            pgClient.query('INSERT INTO market_data_itemregionstathistory (buymean, buyavg, buymedian, sellmean, sellavg, sellmedian, buyvolume, sellvolume, buy_95_percentile, sell_95_percentile, mapregion_id, invtype_id, date, buy_std_dev, sell_std_dev) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)', queryValuesHistory, function(err, result) {
              if (err) {
                console.log('\nRegionStatHistory insert error:');
                console.log(err);
                if (config.extensiveLogging) console.log(queryValuesHistory);
              }

              done();

            });
          } else {
            done();
          }
        }
      });
    }
  });

  pg.connect(config.postgresConnectionString, function(err, pgClient, done){

    if (err) {
        console.log('Postgres error:');
        console.log(err);
    } else {

      // Check if there is a row for that type - if there is not, insert the row
      pgClient.query('SELECT 1 FROM market_data_itemregionstat WHERE mapregion_id = $1 AND invtype_id = $2', [regionID, typeID], function(err, result) {
        if (err) {
          console.log('\nRegionStat select error:');
          console.log(err);
          if (config.extensiveLogging) console.log(queryValues);

          done();
        } else {
          regionStatHistoryWaiting--;

          if (result.rowCount === 0) {
            // Insert new row
            pgClient.query('INSERT INTO market_data_itemregionstat (buymean, buyavg, buymedian, sellmean, sellavg, sellmedian, buyvolume, sellvolume, buy_95_percentile, sell_95_percentile, mapregion_id, invtype_id, lastupdate, buy_std_dev, sell_std_dev) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)', queryValues.slice(0, 15), function(err, result) {
              if (err) {
                console.log('\nRegionStat insert error:');
                console.log(err);
                if (config.extensiveLogging) console.log(queryValues);
              }

              done();
            });
          } else {
            // Update row
            pgClient.query('UPDATE market_data_itemregionstat SET buymean=$1, buyavg=$2, buymedian=$3, sellmean=$4, sellavg=$5, sellmedian=$6, buyvolume=$7, sellvolume=$8, buy_95_percentile=$9, sell_95_percentile=$10, mapregion_id=$11, invtype_id=$12, lastupdate=$13, buy_std_dev=$14, sell_std_dev=$15 WHERE mapregion_id=$16 AND invtype_id=$17', queryValues, function(err, result) {
              if (err) {
                console.log('\nRegionStat update error:');
                console.log(err);
                if (config.extensiveLogging) console.log(queryValues);
              }

              done();
            });
          }
        }
      });
    }
  });
}
}
});
}
});