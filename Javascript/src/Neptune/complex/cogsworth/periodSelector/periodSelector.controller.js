'use strict';

var moment = require('moment');
var module = require('./periodSelector.module');

module
	.controller('PeriodSelectorController', ['$rootScope', '$scope', 'periodService', function($rootScope, $scope, periodService) {
		$scope.setPeriodDates = periodService.setPeriodDates;
		$scope.changePeriod = periodService.changePeriod;

		$scope.displayDate = '';

		$rootScope.$on(periodService.events.UPDATE, function() {
			var dates = periodService.getPeriodDates();
			$scope.displayDate = dates.start.format('MMM D, YYYY') + ' - ' + dates.end.format('MMM D, YYYY');
		});

		periodService.setPeriodDates(moment().startOf('week'));
	}]);