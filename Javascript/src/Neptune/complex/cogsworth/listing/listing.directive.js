'use strict';

var moment = require('moment');
var module = require('./listing.module');

module
	.directive('listing', [function() {
		return {
			restrict: 'AEC',
			template: [
				'<div ng-repeat="record in records" class="record">',
					'<span class="date">{{record.date}}</span>',
					'<span class="notes">{{record.notes}}</span>',
					'<span class="principal">{{record.principal.name}}</span>',
				'</div>'
			].join('')
		};
	}]);