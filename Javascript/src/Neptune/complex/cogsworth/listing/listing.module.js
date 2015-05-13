'use strict';

//var angular = require('angular');
var bulk = require('bulk-require');

module.exports = angular.module('reporting.listing', []);

bulk(__dirname, ['./**/!(*.module).js']);