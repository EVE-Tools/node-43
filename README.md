# node-43
[![Build Status](https://travis-ci.org/EVE-Tools/node-43.svg?branch=nextgen)](https://travis-ci.org/EVE-Tools/node-43)

Node-43 is an alternative consumer for Element43.

## Installation
* Install Element43 as described in the readme
*  `git clone` this repository
* Run `npm install`
* Configure the app by editing `config.js`
* Run `node app.js` to run node-43

## Improvements / Advantages
* No need for Redis
* More efficient
    * Built with non-blocking asynchronous libraries
    * SQL optimized for PostgreSQL
    * Less queries
    * No working tables
    	* No cron jobs required
* History data is processed on-the-fly
* Orders are (de)activated on-the-fly
* Live display of current operation and backlog
