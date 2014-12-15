(function($, w, d) {

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

			$menuParents.on('click', function(evt) {
				toggleOpen(this);
			});

			loadState();
		}

		init();
	}


	function initApp() {
		$('#l-nav').mCustomScrollbar({
			scrollInertia: 0
		});

		new Menu('.primary-nav');
	}

	$(d).ready(function() {
		initApp();
	});

})(jQuery, window, document);