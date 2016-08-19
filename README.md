# node-43
[![Build Status](https://img.shields.io/travis/EVE-Tools/node-43.svg?style=flat)](https://travis-ci.org/EVE-Tools/node-43) [![Coveralls](https://img.shields.io/coveralls/EVE-Tools/node-43.svg?style=flat)](https://coveralls.io/r/EVE-Tools/node-43) [![Dependencies Status](https://img.shields.io/gemnasium/EVE-Tools/node-43.svg?style=flat)](https://gemnasium.com/EVE-Tools/node-43) [![Code Climate](https://img.shields.io/codeclimate/github/EVE-Tools/node-43.svg?style=flat)](https://codeclimate.com/github/EVE-Tools/node-43/) [![gittip](https://img.shields.io/gittip/zweizeichen.svg?style=flat)](https://www.gittip.com/zweizeichen/)

Node-43 is an alternative consumer for Element43 and Postgres 9.5+. Citadel's orders get filtered until CCP provides a proper API.

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
