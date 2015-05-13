'use strict';

var _ = require('underscore');
var module = require('./listing.module');

module
	.filter('friendlyDuration', function() {
		return function(duration) {
			var ret = [];
			var delta = duration;

			var days = Math.floor(delta / 1440);
			delta -= days * 1440;

			var hours = Math.floor(delta / 60);
			delta -= hours * 60;

			var minutes = delta;

			if (days > 0) {
				ret.push(days + 'd');
			}
			if (hours > 0) {
				ret.push(hours + 'h');
			}
			if (!ret.length || minutes > 0) {
				ret.push(minutes + 'm');
			}

			return ret.join(' ');
		};
	})
	.controller('ListingController', ['$rootScope', '$scope', 'recordService', function($rootScope, $scope, recordService) {
		$scope.groups = [];
		$scope.records = [];

		function updateRecords() {
			$scope.records = recordService.getRecords();
			groupRecords();
		}

		function groupRecords() {
			var groups = _.groupBy($scope.records, function(record) {
				return record.principal.id;
			});

			$scope.groups = _.map(groups, function(records) {
				return {
					key: records[0].principal.id,
					label: records[0].principal.name,
					duration: _.reduce(records, function(memo, record) { return memo + record.duration; }, 0),
					records: records
				};
			});
		}

		$rootScope.$on(recordService.events.UPDATE, function() {
			updateRecords();
		});

		updateRecords();
	}]);