(function($, w, d) {
	var $appControlsCon, $siteLocaleComponent, $navCon;
	var $appContentCon;

	var CSS_CLASS_HAS_SITE_LOCALE = 'has-site-locale';
	var CSS_CLASS_SELECT_INIT = 'select2-init';

	var DEFAULT_SELECT_OPTIONS = {
		//width: function() {
		//	return parseInt(this.element.width(), 10) + 15;
		//},
		theme: 'vipa',
		minimumResultsForSearch: 10
	};

	function Menu(target, opts) {
		var $root;
		var CSS_OPEN_CLASS = 'mi-open';
		var STORAGE_CONCAT_CHAR = '|';
		var $menuParents;
		var id;

		function saveState() {
			if (typeof localStorage === 'undefined') {
				return;
			}

			var openParentIds = $menuParents.filter('.' + CSS_OPEN_CLASS)
					.map(function () {
						return this.id;
					})
					.get()
					.join(STORAGE_CONCAT_CHAR);

			localStorage.setItem(id, openParentIds);
		}

		function loadState() {
			if (typeof localStorage === 'undefined') {
				return;
			}

			var openParentIds = localStorage.getItem(id);

			if (openParentIds) {
				openParents($(openParentIds.split(STORAGE_CONCAT_CHAR)).map(function() {
					return d.getElementById(this);
				}).get());
			}
		}

		function openParents(parents) {
			$(parents).addClass(CSS_OPEN_CLASS);
			saveState();
		}

		function toggleOpen(el) {
			$(el).toggleClass(CSS_OPEN_CLASS);
			saveState();
		}

		function init() {
			$root = $(target);
			id = $root.attr('id');

			$menuParents = $root.find('.mi-parent');

			$menuParents.on('click', '.menuitemlabel', function(evt) {
				toggleOpen(this.parentNode);
			});

			loadState();
		}

		init();
	}

	function destroySelectUpdates(context) {
		var $con = $(context || document);

		if (!$con.hasClass(CSS_CLASS_SELECT_INIT)) {
			$con = $con.find('select').filter('.' + CSS_CLASS_SELECT_INIT);
		}

		if ($con.length) {
			$con.removeClass(CSS_CLASS_SELECT_INIT).select2('destroy');
		}
	}

	function initSelectUpdates(context) {
		var $con = $(context || document);

		if (!$con.is('select')) {
			$con = $con.find('select');
		}

		if ($con.length) {
			$con
					.select2(DEFAULT_SELECT_OPTIONS)
					.addClass(CSS_CLASS_SELECT_INIT)
					.filter('[data-features="watch"]')
					.on('change', miwt.observerFormSubmit);
		}
	}

	function initControls() {
		//find elements
		$appControlsCon = $('.e-app-controls');
		$siteLocaleComponent = $appControlsCon.find('.site-locale');
		$navCon = $('.l-nav');

		//set up menu
		new Menu('.primary-nav');

		//add state information to controls
		if ($siteLocaleComponent.length) {
			$appControlsCon.addClass(CSS_CLASS_HAS_SITE_LOCALE);
		}

		//set up scrollbar on menu
		$navCon.mCustomScrollbar({
			scrollInertia: 0,
			mouseWheel: {
				scrollAmount: 100
			}
		});
	}

	function initContent() {
		//find elements
		$appContentCon = $('.e-app-content');

		//set up miwt interactions
		$appContentCon.find('form.miwt-form').each(function() {
			this.submit_options = {
				preProcessNode: function(data) {
					destroySelectUpdates(document.getElementById(data.refid));
					return data.content;
				},
				postProcessNode: function(data) {
					$.each(data, function(idx, d) {
						initSelectUpdates(d.node);
					});
				}
			};

			initSelectUpdates(this);
		});
	}

	$(d).on('vs:init-controls', initControls).on('vs:init-content', initContent);

	$(d).ready(function() {
		//need select 2 to be fixed for programmatic init
		//$(this).trigger('vs:init-content');
	});

})(jQuery, window, document);