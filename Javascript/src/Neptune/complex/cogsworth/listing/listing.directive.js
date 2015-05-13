'use strict';

var module = require('./listing.module');

module
	.directive('listing', [function() {
		return {
			restrict: 'AEC',
			template: [
				'<div ng-repeat="group in groups | orderBy:\'label\' ">',
					'<div class="group">',
						'<span class="group-label">{{group.label}}</span>',
						'<span class="group-duration">{{group.duration | friendlyDuration}}</span>',
					'</div>',
					'<div ng-repeat="record in group.records" class="record">',
						'<span class="date">{{record.date}}</span>',
						'<span class="duration">{{record.duration | friendlyDuration}}</span>',
						'<span class="category">{{record.category.name}}</span>',
						'<span class="notes">{{record.notes}}</span>',
					'</div>',
				'</div>'
			].join('')
		};
	}]);