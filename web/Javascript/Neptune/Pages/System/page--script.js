(function (global, d, $) {
	"use strict";

	var CSS_CLASS_OPENED = 'js-opened';
	var CSS_CLASS_ACTIVE = 'js-active';
	var CSS_CLASS_HIGHLIGHT = 'highlight';

	function createSourceMenu($con) {
		var $fileHeadings = $con.find('h4');
		var $sourceFiles;
		var $sourceMenuCon = $('<div class="source-menu" />').insertAfter($con.find('.goto_line'));
		var $sourceMenuList = $('<ul class="source-menu-list" />').appendTo($sourceMenuCon);
		var $sourceFileTriggers;
		var $gotoLineInput, $gotoLineRowHighlighted = null, $gotoLineButton;

		function activateMenuItem(id) {
			$sourceMenuList.find('a[href=#' + id + ']').parent().addClass(CSS_CLASS_ACTIVE).siblings().removeClass(CSS_CLASS_ACTIVE);
		}

		function activatePreviousMenuItem(id) {
			$sourceMenuList.find('a[href=#' + id + ']').parent().prev().addClass(CSS_CLASS_ACTIVE).siblings().removeClass(CSS_CLASS_ACTIVE);
		}

		function openSourceFile($sourceFile) {
			$sourceFile.addClass(CSS_CLASS_OPENED);
		}

		$fileHeadings.each(function() {
			var fileHeading = this;
			var $fileHeading = $(fileHeading);
			var $sourceFile = $fileHeading.add($fileHeading.next()).wrapAll('<div class="source-file" />').parent();
			var $trigger;

			//adding menu items
			$('<a />')
					.attr({
						href: '#' + fileHeading.id,
						title: fileHeading.innerText
					})
					.text(fileHeading.innerText.substring(fileHeading.innerText.lastIndexOf('/') + 1))
					.wrap('<li />')
					.parent()
					.appendTo($sourceMenuList)
					.click(function(evt) {
						openSourceFile($sourceFile);
						//force redraw
						$fileHeading.offset();
						Waypoint.refreshAll();
					});

			//adding collapsible icons
			$trigger = $('<span class="btn btn-glyph-only collapse-trigger" title="Expand" />').prependTo(fileHeading);

			//adding collapsible triggers
			$fileHeading.on('click', function(evt) {
				var isOpened = $sourceFile.hasClass(CSS_CLASS_OPENED);
				var title = isOpened ? 'Expand' : 'Collapse';
				evt.preventDefault();

				if (evt.altKey || evt.ctrlKey) {
					if (isOpened) {
						$sourceFiles.removeClass(CSS_CLASS_OPENED);
						title = 'Expand';
					} else {
						$sourceFiles.addClass(CSS_CLASS_OPENED);
						title = 'Collapse';
					}
					$sourceFileTriggers.attr('title', title).text(title);
				} else {
					$sourceFile.toggleClass(CSS_CLASS_OPENED);
					$trigger.attr('title', title).text(title);
				}

				//force redraw
				$fileHeading.offset();
				Waypoint.refreshAll();
			});

			//waypoint for scrolling back up
			$sourceFile.waypoint(function(direction) {
				if (direction == 'up') {
					activatePreviousMenuItem(fileHeading.id);
				}
				if (direction == 'down') {
					activateMenuItem(fileHeading.id);
				}
			}, { offset: 30 });
		});

		//set initial active menu item
		$sourceMenuList.find('li:first-child').addClass(CSS_CLASS_ACTIVE);

		//cache new source file elements
		$sourceFiles = $con.find('.source-file');
		$sourceFileTriggers = $sourceFiles.find('.collapse-trigger');

		//create gotoline
		$('<div class="goto-line"><label for="q-goto-line">Go to line</label><input type="number" id="q-goto-line" name="q-goto-line" /><button class="btn go">Go</button></div>').prependTo($sourceMenuCon);
		$gotoLineInput = $('#q-goto-line');
		$gotoLineButton = $('.goto-line .btn');

		//add info box
		$('<div class="message-container"><div class="message info">Alt + click a collapse trigger to toggle all script files</div></div>').appendTo($sourceMenuCon);

		//set up sticky menu nav
		$sourceMenuCon.sticky();

		//open file and move when you click the go to line button
		$gotoLineButton.on('click', function(evt) {
			var newScrollTop = 0;
			var rowNumber;
			evt.preventDefault();

			rowNumber = parseInt($gotoLineInput.val(), 10);

			//check for highlight
			var $highlightRow = $('#sv_tl_' + rowNumber).closest('tr');

			if ($highlightRow.length) {
				if ($gotoLineRowHighlighted && $gotoLineRowHighlighted.length) {
					$gotoLineRowHighlighted.removeClass(CSS_CLASS_HIGHLIGHT);
				}

				$highlightRow.addClass(CSS_CLASS_HIGHLIGHT);
				openSourceFile($highlightRow.closest('.source-file'));

				//force paint redraw
				newScrollTop = $highlightRow.offset().top - 30;
				Waypoint.refreshAll();
				$('html,body').scrollTop(newScrollTop);

				//save old highlight row
				$gotoLineRowHighlighted = $highlightRow;
			}
		});

		//handle enter on input in gotoline
		$gotoLineInput.on('keydown', function(evt) {
			//if enter key
			if (evt.which == 13) {
				evt.preventDefault();
				$gotoLineButton.trigger('click');
			}
		});
	}

	function init() {
		var $con = $('.source_view_header').parent().addClass('source-view');

		if (!$con.length) {
			return false;
		}

		$('.file_source, h4').wrapAll('<div class="source-files" />');

		createSourceMenu($con);
	}

	$('form.miwt-form').each(function() {
		var form = this;
		var oldPostUpdate;

		if (!form.submit_options) {
			form.submit_options = {};
		}

		oldPostUpdate = form.submit_options.postUpdate ? form.submit_options.postUpdate : $.noop;

		form.submit_options.postUpdate = function(data) {
			oldPostUpdate(data);
			init(data);
		};

		form.submit_options.onSubmit = init;

		init();
	});

	$(init);

})(window, document, jQuery);