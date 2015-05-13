'use strict';

var module = require('./listing.module');

module
	.controller('ListingController', ['$rootScope', '$scope', 'recordService', function($rootScope, $scope, recordService) {
		$scope.records = recordService.getRecords();

		$rootScope.$on(recordService.events.UPDATE, function() {
			$scope.records = recordService.getRecords();
		});
	}]);