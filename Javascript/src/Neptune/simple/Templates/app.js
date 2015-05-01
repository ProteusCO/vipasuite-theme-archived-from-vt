(function($, w, d) {
	var $appControlsCon, $siteLocaleComponent, $navCon;
	var $appContentCon;

	var CSS_CLASS_HAS_SITE_LOCALE = 'has-site-locale';
	var CSS_CLASS_SELECT_INIT = 'select2-init';
	var CSS_CLASS_ACTIVE = 'mi-active';

	var DEFAULT_SELECT_OPTIONS = {
		theme: 'vipa',
		minimumResultsForSearch: 10
	};

	var isMacLike = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i)?true:false;

	Handlebars.registerHelper('friendlyDate', function(datetime) {
		return moment(datetime).calendar();
	});

	Handlebars.registerHelper('formatDate', function(datetime, format) {
		return moment(datetime).format(format);
	});

	Handlebars.registerHelper('formatHtmlClass', function(str) {
		return $.map(str.split(/\s+/), function(cls, idx) {
			return '.' + cls;
		}).join(', ');
	});

	Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
		switch (operator) {
			case '==':
				return (v1 == v2) ? options.fn(this) : options.inverse(this);
			case '===':
				return (v1 === v2) ? options.fn(this) : options.inverse(this);
			case '<':
				return (v1 < v2) ? options.fn(this) : options.inverse(this);
			case '<=':
				return (v1 <= v2) ? options.fn(this) : options.inverse(this);
			case '>':
				return (v1 > v2) ? options.fn(this) : options.inverse(this);
			case '>=':
				return (v1 >= v2) ? options.fn(this) : options.inverse(this);
			case '&&':
				return (v1 && v2) ? options.fn(this) : options.inverse(this);
			case '||':
				return (v1 || v2) ? options.fn(this) : options.inverse(this);
			case '!=':
				return (v1 != v2) ? options.fn(this) : options.inverse(this);
			default:
				return options.inverse(this);
		}
	});

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

		function setScrollOffset(offset) {
			if (typeof localStorage === 'undefined') {
				return;
			}

			localStorage.setItem(id + 'scroll', parseInt(offset, 10));
		}

		function getScrollOffset() {
			if (typeof localStorage === 'undefined') {
				return;
			}

			var scrollPercent = localStorage.getItem(id + 'scroll');

			return (scrollPercent ? scrollPercent : 0);
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

			//cache parents
			$menuParents = $root.find('.mi-parent');

			//remove parents with empty children
			$menuParents.find(' > .menu:empty').parent().remove();

			$menuParents.on('click', '.menuitemlabel', function(evt) {
				toggleOpen(this.parentNode);
			});

			loadState();
		}

		init();

		return {
			setScrollOffset: setScrollOffset,
			getScrollOffset: getScrollOffset
		};
	}

	function ContentElement(target, opts) {
		var $target;
		var pageContexts = {};
		var transformedContext = {};
		var originalContext = {};
		var id;
		var template;
		var defaults = {
			template: '/theme/ContentTemplates/page-element-main.hbs',
			context: {
				site: {},
				page: {}
			}
		};
		var settings = {};
		var contextMessages = [];

		function addContextMessage(message, type) {
			contextMessages.push({
				message: message,
				cls: type
			});
		}

		function transformComponentContext(info) {
			var locales = $.map(settings.context.site.locales, function(locale, idx) {
				return {
					key: locale,
					state: typeof info.state[locale] === 'undefined' ? 'unconfigured' : info.state[locale],
					published: typeof info.published[locale] !== "undefined",
					fallback: settings.context.site.fallback_locale == locale
				};
			});

			transformedContext = {
				site: settings.context.site,
				pe: {
					backend_edit_url: info.backend_edit_url,
					component_identifier: info.component_identifier,
					component_name: info.component_name,
					html: {
						id: info.html.id,
						classes: info.html.class ? info.html.class.split(/\s+/) : []
					},
					icon: info.icon,
					id: id.split('#')[1],
					key: info.key,
					labels: info.labels || [],
					modified: info.modified,
					modified_by: info.modified_by,
					name: info.name,
					locales: locales,
					references: info.references,
					visibility_condition: info.visibility_condition
				}
			};
		}

		function addPageContext(id, context) {
			pageContexts[id] = context;
		}

		function getPageContext(id) {
			return pageContexts[id];
		}

		function loadComponentContext() {
			var dfd = $.Deferred();

			$.when(liveEditService.loadComponentContext(id))
				.then(function(data) {
					originalContext = data;
					transformComponentContext(originalContext);
					dfd.resolve();
				});

			return dfd.promise();
		}

		function loadPageContext(pid) {
			var dfd = $.Deferred();

			$.when(liveEditService.loadPageContext(pid))
				.then(function(data) {
					originalContext = data;
					transformComponentContext(originalContext);
					dfd.resolve();
				});

			return dfd.promise();
		}

		function renderContext() {
			console.log(originalContext.key, originalContext.name, originalContext.component_name, originalContext, transformedContext);
			$target.after(template(transformedContext));

/*
				$.each(data.references, function(idx, reference) {
					$.when(liveEditService.getPageInfo(reference[0]))
						.then(function(data) {
							console.log('reference page: ' + data.title + ' | /' + data.primary_path.path);

						});
				});*/
		}

		function handleClick(evt) {
			if (evt.altKey) {
				$.when(loadComponentContext())
					.then(renderContext);
			}
		}

		function init() {
			settings = $.extend(true, {}, defaults, opts);
			$target = $(target);
			id = $target.data('pe');

			if (typeof settings.template === 'string') {
				$.get(settings.template, function(content) {
					template = Handlebars.compile(content);
					$target.on('click', handleClick);
				});
			} else {
				template = settings.template;
				$target.on('click', handleClick);
			}

		}

		init();
	}

	function LiveEditService() {
		var defaults = {
			options: {
				option: 'all',
				url: ''
			},
			wsUrlBase: '/ws/le/',
			wsUrlPage: '/ws/le/page'
		};
		var settings = {};

		var siteId = "";
		var siteUrl = "";
		var dataInit = false;
		var siteContext = {};

		function loadPageElementContext(id) {
			return $.get(settings.wsUrlBase + [siteId, 'pe', cleanPageElementId(id)].join('/'), settings.options);
		}

		function loadSiteContext() {
			var dfd = $.Deferred();

			if (dataInit) {
				w.setTimeout(function() {
					dfd.resolve(siteContext);
				}, 1);
			} else {
				$.get(settings.wsUrlPage, settings.options, function(data) {
					siteContext = data.site;
					console.log(siteContext);
					siteId = siteContext.id;
					siteUrl = 'http://' + siteContext.default_hostname.name;

					dataInit = true;

					dfd.resolve(siteContext);
				});
			}

			return dfd.promise();
		}

		function getSiteContext() {
			return siteContext;
		}

		function cleanPageElementId(id) {
			return id.replace('#', '');
		}

		function init(opts) {
			settings = $.extend(true, {}, defaults, opts);

			return loadSiteContext();
		}

		return {
			init: init,
			getSiteContext: getSiteContext,
			loadSiteContext: loadSiteContext,
			loadPageContext: loadPageElementContext,
			loadComponentContext: loadPageElementContext
		};
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

		if ($con.length && !$con.closest('tr[data-dnd-source-def]').length) {
			$con
					.select2(DEFAULT_SELECT_OPTIONS)
					.addClass(CSS_CLASS_SELECT_INIT)
					.filter('[data-features~="watch"]')
					.on('change', miwt.observerFormSubmit);
		}
	}

	function initContentElements(context) {
		$.when(liveEditService.init({
			options: {
				url: 'http://' + $('.current-site span.hostname').text()
			}
		}), $.get('/theme/ContentTemplates/page-element-main.hbs')).then(function(les, templateXhr) {
			var template = Handlebars.compile(templateXhr[0]);
			var siteContext = liveEditService.getSiteContext();
			$(context).find('.contentelement').each(function(idx, el) {
				new ContentElement(el, {
					context: {
						site: siteContext
					},
					template: template
				});
			});
		});
	}

	function initControls() {
		//find elements
		$appControlsCon = $('.e-app-controls');
		$siteLocaleComponent = $appControlsCon.find('.site-locale');
		$navCon = $('.l-nav');
		var $siteMenuContent = $navCon.find('.site-content-menu > .menu > .mi');

		//move site content menu
		$siteMenuContent.insertAfter('.primary-nav > .menu > .nav-cms-group');

		//remove component selection if any of the site content menu items are active
		if ($siteMenuContent.has('.' + CSS_CLASS_ACTIVE).length) {
			$navCon.find('.nav-cms-group .'+CSS_CLASS_ACTIVE).removeClass(CSS_CLASS_ACTIVE);
		}

		//set up menu
		var menu = new Menu('.primary-nav');

		//add state information to controls
		if ($siteLocaleComponent.length) {
			$appControlsCon.addClass(CSS_CLASS_HAS_SITE_LOCALE);
		}

		//set up scrollbar on menu
		//need to do this https://github.com/malihu/malihu-custom-scrollbar-plugin/issues/187
		$navCon.mCustomScrollbar({
			scrollInertia: 0,
			mouseWheel: {
				deltaFactor: 1,
				normalizeDelta: true,
				scrollAmount: isMacLike ? 30 : 60
			},
			callbacks: {
				onScroll: function() {
					menu.setScrollOffset(this.mcs.top);
				}
			}
		});
		$navCon.mCustomScrollbar('scrollTo', menu.getScrollOffset() + 'px');
	}

	function initContent() {
		//find elements
		$appContentCon = $('.e-app-content');

		//setup LiveEdit API
		liveEditService = new LiveEditService();

		//set up miwt interactions
		$appContentCon.find('form.miwt-form').each(function() {
			var form = this;
			form.submit_options = {
				preProcessNode: function(data) {
					destroySelectUpdates(document.getElementById(data.refid));
					return data.content;
				},
				postProcessNode: function(data) {
					$.each(data, function(idx, d) {
						initSelectUpdates(d.node);
					});
				},
				postUpdate: function() {
					initContentElements(form);
					$(form).trigger('vs:miwt-post-update');
				}
			};

			initContentElements(form);
			initSelectUpdates(form);
		});
	}

	$(d).on('vs:init-controls', initControls).on('vs:init-content', initContent);

	$(d).ready(function() {
		//need select 2 to be fixed for programmatic init
		$(this).trigger('vs:init-content');
	});

})(jQuery, window, document);