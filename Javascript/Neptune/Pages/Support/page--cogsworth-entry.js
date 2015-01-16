jQuery(function($) {
	var SELECT_OPTIONS = {
		width: 'element'
	};
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

	function destroySelectUpdates(context) {
		var $con = $(context || document);
		var $selects = $con.hasClass('select2-offscreen') ? $con : $con.find('.select2-offscreen');

		$selects.select2('destroy');
	}

	function updateMIWT(context) {
		var $con = $(context || document);

		var $selects = $con.is('select') ? $con : $con.find('select');
		$selects
				.select2(SELECT_OPTIONS)
				.each(function() {
					if ($(this).hasClass('miwt_watch')) {
						$(this).on('change', miwt.observerFormSubmit);
					}
				});

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
		var miwtForm = $(document.getElementById(id)).closest('form.miwt_form').get(0);
		miwtForm.elements['btnhit'].value = id;
		miwtForm.MIWTSubmit();
	}

	$('#time_entry form.miwt_form')
			.each(function() {
				var form = this;
				form.submit_options = {
					preProcessNode: function(data) {
						destroySelectUpdates(document.getElementById(data.refid));
						return data.content;
					},
					postProcessNode: function(data) {
						$.each(data, function(idx, d) {
							updateMIWT(d.node);
						});
					}
				};

				updateMIWT(this);
			})
			.on('keydown', 'input.miwt_calendar', function(evt) {
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

				if (inputInFocus || $(evt.target).hasClass('select2-input')) {
					return;
				}

				switch(evt.which) {
					//Hit A
					case 65:
						$triggeredCon = $mouseEl.closest('.project');

						if ($triggeredCon.length) {
							triggerFormBtn($triggeredCon.find('.time_entries_con > .entity_actions a.add_button').attr('id'));
						}
						break;

					//Hit E
					case 69:
						$triggeredCon = $mouseEl.closest('.time_entry');

						if ($triggeredCon.length && !$triggeredCon.hasClass('entry_edit')) {
							triggerFormBtn($triggeredCon.find('.actions a.edit_button').attr('id'));
						}
						break;
				}

			});

});