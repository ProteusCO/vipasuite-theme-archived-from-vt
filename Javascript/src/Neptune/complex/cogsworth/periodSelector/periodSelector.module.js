'use strict';

//var angular = require('angular');
var bulk = require('bulk-require');

module.exports = angular.module('reporting.periodSelector', []);

bulk(__dirname, ['./**/!(*.module).js']);