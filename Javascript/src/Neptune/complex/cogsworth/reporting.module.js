'use strict';

//var angular = require('angular');
var _ = require('underscore');
//var $ = require('jquery');
var moment = require('moment');
var bulk = require('bulk-require');

require('angular-route');
require('./periodSelector/periodSelector.module');
require('./listing/listing.module');

module.exports = angular.module('reporting', [
	'ngRoute',
	'reporting.periodSelector',
	'reporting.listing'
])
	.config(['$routeProvider', function($routeProvider) {
		$routeProvider
			.when('/', {
				controller: 'ReportingController',
				template: [
					'<div ng-controller="PeriodSelectorController"><period-selector class="period-chooser"></period-selector></div>',
					'<div ng-controller="ListingController"><listing></listing></div>'
				].join('')
			})
			.otherwise({
				redirectTo: '/'
			});
	}])
	.constant('WEB_SERVICES', {
		"RECORDS": "/content-type/application/javascript/ws/cogsworth/records",
		"PROJECTS": "/content-type/application/javascript/ws/cogsworth/projects"
	})
	.service('recordService', ['$rootScope', function($rootScope) {
		var self = this;
		var records = [];
		var principals = [];

		self.getPrincipals = function getPrincipals() {
			return principals;
		};

		self.setPrincipals = function setPrincipals(newPrincipals) {
			principals = newPrincipals;

			$rootScope.$emit(self.events.UPDATE);
		};

		self.getRecords = function getRecords() {
			return records;
		};

		self.setRecords = function setRecords(newRecords) {
			records = newRecords;

			$rootScope.$emit(self.events.UPDATE);
		};

		self.events = {
			UPDATE: 'records-update'
		};
	}])
	.service('periodService', ['$rootScope', function($rootScope) {
		var self = this;
		var startDate = null;
		var endDate = null;
		var DEFAULT_PERIOD_AMOUNT = 6;
		var DEFAULT_PERIOD_UNIT = 'days';
		var enabled = false;

		self.getPeriodDates = function() {
			if (self.isEnabled()) {
				return {
					start: startDate,
					end: endDate
				};
			} else {
				return {
					start: null,
					end: null
				};
			}
		};

		self.setPeriodDates = function setPeriodDates(newStartDate, newEndDate) {
			startDate = newStartDate;
			endDate = newEndDate ? newEndDate : moment(newStartDate).add(DEFAULT_PERIOD_AMOUNT, DEFAULT_PERIOD_UNIT);

			$rootScope.$emit(self.events.UPDATE);
		};

		self.changePeriod = function changePeriod(amount) {
			//move it 1 extra unit in the direction it is changing to make sure the current unit is not included
			var changeAmount = (amount > 0 ? 1 : -1) + (DEFAULT_PERIOD_AMOUNT * amount);
			self.setPeriodDates(self.getPeriodDates().start.add(changeAmount, DEFAULT_PERIOD_UNIT));
		};

		self.isEnabled = function isEnabled() {
			return enabled;
		};

		self.enable = function enable(isEnabled) {
			enabled = isEnabled;

			$rootScope.$emit(self.events.UPDATE);
		};

		self.events = {
			UPDATE: 'period-update'
		};

	}])
	.controller('ReportingController', [
		'$rootScope', '$scope', '$http', 'WEB_SERVICES', '$routeParams', 'recordService', 'periodService',
		function($rootScope, $scope, $http, WEB_SERVICES, $routeParams, recordService, periodService) {

			$rootScope.$on(periodService.events.UPDATE, function() {
				var dates = periodService.getPeriodDates();
				$http.get(WEB_SERVICES.RECORDS, {
					params: {
						"principal": recordService.getPrincipals().length ? '' : 'all',
						"project": $routeParams.project,
						"dstart": dates.start ? dates.start.format('YYYY-MM-DD') : '',
						"dend": dates.end ? dates.end.format('YYYY-MM-DD') : ''
					}
				}).success(function(records) {
					recordService.setRecords(records.data);
				});
			});
	}]);