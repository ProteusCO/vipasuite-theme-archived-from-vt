jQuery(function($) {
	var mousePosition = {x: 0, y: 0};
	var inputInFocus = false;

	moment.lang('en', {
		calendar: {
			lastDay: '[Yesterday]',
			sameDay: '[Today]',
			nextDay: '[Tomorrow]',
			lastWeek: 'dddd',
			nextWeek: 'dddd',
			sameElse: function() {
				return 'MMM D' + (this.year() == moment().year() ? '' : ', YYYY');
			}
		}
	});

	function CogsworthGraphPeriodChooser() {
		var defaults = {
			onChange: function() {}
		};
		var settings = {};
		var $target;
		var $prev, $next, $display;
		var currentPeriodStartMoment;

		function getCurrentPeriodStart() {
			return currentPeriodStartMoment;
		}

		function setCurrentPeriodStart(moment) {
			currentPeriodStartMoment = moment;
		}

		function getPeriodDates() {
			return {
				start: getCurrentPeriodStart(),
				end: moment(getCurrentPeriodStart()).add(6, 'days')
			};
		}

		function changePeriod(amount) {
			setCurrentPeriodStart(getCurrentPeriodStart().add(amount, 'days'));
			render();
			settings.onChange(getPeriodDates());
		}

		function render() {
			var dates = getPeriodDates();
			$display.text(dates.start.format('MMM D, YYYY') + ' - ' + dates.end.format('MMM D, YYYY'));
		}

		function build() {
			setCurrentPeriodStart(moment().startOf('week'));

			$prev = $('<span class="period-action period-prev" />')
				.appendTo($target)
				.on('click', function(evt) {
					changePeriod(-7);
				});
			$display = $('<span class="period-display" />')
				.appendTo($target)
				.on('click', function(evt) {

				});
			$next = $('<span class="period-action period-next" />')
				.appendTo($target)
				.on('click', function(evt) {
					changePeriod(7);
				});

			$target.wrapInner('<div class="period-chooser-box" />');

			render();
		}

		function init(target, opts) {
			settings = $.extend(true, {}, defaults, opts);
			$target = $(target);
			build();
		}

		return {
			init: init,
			getPeriodDates: getPeriodDates
		};
	}

	function CogsworthGraph() {
		var defaults = {
			css: {
				loading: 'data-loading',
				loaded: 'data-loaded'
			},
			selectors: {
				periodChooser: '.period-chooser',
				overallGraph: '.overall-graph'
			},
			ws: {
				records: '',
				projects: ''
			},
			pages: {
				reporting: ''
			}
		};
		var settings = {};
		var $target = $([]);
		var periodChooser;
		var $overallGraph;

		function loadProjects(ids) {
			var dfd = $.Deferred();

			$.getJSON(settings.ws.projects, {
				ids: ids.join(',')
			}, function(projects) {
				dfd.resolve(projects.data);
			});

			return dfd;
		}

		function loadRecords(dates) {
			var dfd = $.Deferred();

			$.getJSON(settings.ws.records, {
				dstart: dates.start.format('YYYY-MM-DD'),
				dend: dates.end.format('YYYY-MM-DD')
			}, function(records) {
				dfd.resolve(records.data);
			});

			return dfd;
		}

		function renderOverallGraph($graphTarget, records, dates) {
			var projects = _.unique(_.map(records, function(record) {
				return record.project;
			}));
			var projectRecordGroups = _.groupBy(records, function(record) {
				return record.project.id;
			});

			var seriesData = _.map(projectRecordGroups, function(projectRecords) {
				var project = projectRecords[0].project;

				var days = [];
				for (var i=0; i < 7;i++) {
					var dayProjectRecords = _.where(projectRecords, {
						date: moment(dates.start).add(i, 'days').format('YYYY-MM-DD')
					});
					var dayProjectRecordTotal = 0;
					_.each(dayProjectRecords, function(projectRecord) {
						dayProjectRecordTotal += projectRecord.duration;
					});
					days.push({
						project: project,
						y: +(dayProjectRecordTotal / 60).toFixed(2)
					});
				}

				return {
					name: (project.type.name == "Support" ? '[CSR] ' + project.hostname : project.name),
					data: days
				}
			});

			var xAxisLabels = [];
			for (var i=0; i < 7;i++) {
				xAxisLabels.push(moment(dates.start).add(i, 'days').format('dddd, MMM D'))
			}


			$graphTarget.highcharts({
				chart: {
					type: 'column',
					height: 300,
					backgroundColor: 'transparent'
				},
				title: {
					align: 'left',
					text: 'Time records for ' + dates.start.format('MMMM D, YYYY') + ' to ' + dates.end.format('MMMM D, YYYY')
				},
				xAxis: {
					categories: xAxisLabels,
					crosshair: true
				},
				yAxis: {
					title: {
						text: 'Hours'
					},
					max: 10,
					tickInterval: 2
				},
				tooltip: {
					formatter: function () {
						var hasTime = false;
						var s = '<b>' + this.x + '</b>';

						$.each(this.points, function () {
							if (this.y != 0) {
								s += '<br /><span style="color:' + this.series.color + ';">\u25CF</span> ' + this.series.name + ': ' + this.y;
								hasTime = true;
							}
						});

						if (!hasTime) {
							s += '<br />No Records';
						}

						return s;
					},
					shared: true
				},
				legend: {
					align: 'right',
					verticalAlign: 'top',
					floating: false,
					layout: 'vertical',
					labelFormatter: function() {
						return [
							'<a href="',
							settings.pages.reporting,
							'#project=',
							this.userOptions.data[0].project.id,
							'">',
							this.name,
							'</a>'
						].join('');
					},
					useHTML: true
				},
				plotOptions: {
					column: {
						stacking: 'normal'
					},
					series: {
						events: {
							legendItemClick: function () {
								return false;
							}
						}
					}
				},
				series: seriesData
			});
		}

		function renderGraphs(dates) {
			$
				.when(loadRecords(dates))
				.then(function(records) {
					if (records.length) {
						$target.removeClass(settings.css.loading).addClass(settings.css.loaded);

						if ($overallGraph.length) {
							renderOverallGraph($overallGraph, records, dates);
						}
					}
				});
		}

		function init(target, opts) {
			settings = $.extend(true, {}, defaults, opts);
			$target = $(target);
			$target.addClass(settings.css.loading);

			if (!settings.ws.records.length) {
				settings.ws.records = $target.data('wsRecords');
			}
			if (!settings.ws.projects.length) {
				settings.ws.projects = $target.data('wsProjects');
			}
			if (!settings.pages.reporting.length) {
				settings.pages.reporting = $target.data('reporting');
			}

			$overallGraph = $(settings.selectors.overallGraph);

			periodChooser = new CogsworthGraphPeriodChooser();
			periodChooser.init($target.find(settings.selectors.periodChooser), {
				onChange: function(dates) {
					renderGraphs(dates);
				}
			});

			renderGraphs(periodChooser.getPeriodDates());
		}

		return {
			init: init
		};
	}

	function updateMIWT(context) {
		var $con = $(context || document);

		$con
				.find('.time_entry_part.date').filter(':not(.friendly_date)')
				.each(function() {
					var $date = $(this);
					var oldDate = $date.text();

					if (!$date.parent().hasClass('entry_edit')) {
						$date.text(moment(oldDate, 'MM/DD/YY').calendar()).attr('title', oldDate).addClass('friendly_date');
					}
				});
	}

	function triggerFormBtn(id) {
		var miwtForm = $(document.getElementById(id)).closest('form.miwt-form').get(0);
		miwtForm.elements['btnhit'].value = id;
		miwtForm.MIWTSubmit();
	}

	$('#time_entry')
		.find('form.miwt-form')
		.on('vs:miwt-post-update', function() {
			updateMIWT(this);
		})
		.on('keydown', '.miwt-calendar input', function(evt) {
			var input = this;
			var inputDate = moment(input.value);
			var updateDate = true;

			switch (evt.which) {
				//go up
				case 38:
					inputDate.add('day', 1);
					evt.preventDefault();
					break;

				//go down
				case 40:
					inputDate.subtract('day', 1);
					evt.preventDefault();
					break;

				default:
					updateDate = false;
					break;
			}

			if (updateDate) {
				input.value = inputDate.format('L');
			}
		})
		.on('focus', 'input', function(evt) {
			inputInFocus = true;
		})
		.on('blur', 'input', function(evt) {
			inputInFocus = false;
		});

	$(document)
		.on('mousemove', function(evt) {
			mousePosition.x = evt.pageX - window.pageXOffset;
			mousePosition.y = evt.pageY - window.pageYOffset;
		})
		.on('keyup', function(evt) {
			var $mouseEl = $(document.elementFromPoint(mousePosition.x, mousePosition.y));
			var $triggeredCon;

			if (inputInFocus || $(evt.target).hasClass('select2-search__field')) {
				return;
			}

			switch(evt.which) {
				//Hit A
				case 65:
					$triggeredCon = $mouseEl.closest('.project');

					if ($triggeredCon.length) {
						triggerFormBtn($triggeredCon.find('.time_entries_con > .entity_actions a.add').attr('id'));
					}
					break;

				//Hit E
				case 69:
					$triggeredCon = $mouseEl.closest('.time_entry');

					if ($triggeredCon.length && !$triggeredCon.hasClass('entry_edit')) {
						triggerFormBtn($triggeredCon.find('.actions a.edit').attr('id'));
					}
					break;
			}

		});

	new CogsworthGraph().init('.cogsworth-graphs');

});