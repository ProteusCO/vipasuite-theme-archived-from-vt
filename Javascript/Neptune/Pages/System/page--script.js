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

		function activateMenuItem(id) {
			$sourceMenuList.find('a[href=#' + id + ']').parent().addClass(CSS_CLASS_ACTIVE).siblings().removeClass(CSS_CLASS_ACTIVE);
		}

		function activatePreviousMenuItem(id) {
			$sourceMenuList.find('a[href=#' + id + ']').parent().prev().addClass(CSS_CLASS_ACTIVE).siblings().removeClass(CSS_CLASS_ACTIVE);
		}

		function openSourceFile($sourceFile) {
			$sourceFile.addClass(CSS_CLASS_OPENED);

			setTimeout(function() {
				Waypoint.refreshAll();
			}, 150);
		}

		$fileHeadings.each(function() {
			var fileHeading = this;
			var $sourceFile = $(fileHeading).add($(fileHeading).next()).wrapAll('<div class="source-file" />').parent();

			//adding menu items
			$('<a />')
					.attr({
						href: '#' + fileHeading.id,
						title: fileHeading.innerText
					})
					.text(fileHeading.innerText.substring(fileHeading.innerText.lastIndexOf('/') + 1))
					.wrap('<li />')
					.parent()
					.appendTo($sourceMenuList);

			//adding collapsible
			$('<a href="#" class="btn btn-glyph-only collapse-trigger" title="Expand" />')
					.prependTo(fileHeading)
					.on('click', function(evt) {
						var isOpened = $sourceFile.hasClass(CSS_CLASS_OPENED);
						var title = isOpened ? 'Expand' : 'Collapse';
						evt.preventDefault();

						if (evt.altKey) {
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
							$(this).attr('title', title).text(title);
						}

						setTimeout(function() {
							Waypoint.refreshAll();
						}, 150);
					});

			//waypoint for scrolling down
			$sourceFile.waypoint(function(direction) {
					if (direction == 'down') {
						activateMenuItem(fileHeading.id);
					}
				}, { offset: 30 });

			//waypoint for scrolling back up
			$sourceFile.waypoint(function(direction) {
					if (direction == 'up') {
						activatePreviousMenuItem(fileHeading.id);
					}
				}, { offset: -50 });
		});

		//set initial active menu item
		$sourceMenuList.find('li:first-child').addClass(CSS_CLASS_ACTIVE);

		//cache new source file elements
		$sourceFiles = $con.find('.source-file');
		$sourceFileTriggers = $sourceFiles.find('.collapse-trigger');

		//set up sticky menu nav
		$sourceMenuCon.sticky();

		//move gotoline
		$con.find('.goto_line').prependTo($sourceMenuCon);

		//add info box
		$('<div class="message-container"><div class="message info">Alt + click a collapse trigger to toggle all script files</div></div>').appendTo($sourceMenuCon);

		//open file and move when you click the go to line button
		$con.find('.goto_line button').on('click', function() {
			//check for highlight
			$sourceFiles.find('.' + CSS_CLASS_HIGHLIGHT).each(function() {
				var $highlightRow = $(this);
				openSourceFile($highlightRow.closest('.source-file'));
				setTimeout(function() {
					$('html,body').scrollTop($highlightRow.offset().top - 30);
				}, 150);
			});
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