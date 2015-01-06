(function(w, d) {
	var SELECTOR_CON = '.site-selector';
	//ALL selectors below the con are searched off the SELECTOR_CON context
	var SELECTOR_SITE_SELECTION_CON = '.selector-sites-con';
	var SELECTOR_OPEN_CONTROLS = '.current-site .icon, .current-site .hostname';
	var SELECTOR_FILTER_FORM = '.ss-search-form';
	var SELECTOR_FILTER_INPUT = 'input[name=ss-site-search]';
	var SELECTOR_CHANGE_LINKS = '.results a.siteselector';
	var SELECTOR_CLOSE_ACTION = '.actions .close';
	var SELECTOR_RESET_ACTION = '.actions .reset';

	var MESSAGE_SESSION_EXPIRED = 'Your session expired. You will need to login again.';

	var CSS_CLASS_OPEN = 'selector-open';
	var CSS_CLASS_LOADING = 'loading';

	function SiteSelector(target) {
		var _self = this;
		var _lastEl = null;
		var _conEl = target;
		var _siteSelectionConEl = _conEl.querySelector(SELECTOR_SITE_SELECTION_CON);

		if (!_siteSelectionConEl) {
			return;
		}

		var _clickLoadEls = null;
		var _submitLoadEls = null;
		var _closeEl = null;
		var _clickChangeEls = null;
		var _filterInputEl = null;
		var _resetEl = null;

		function _loadSelectorForSubmit(evt) {
			evt.preventDefault();
			return _loadSelector(this, false);
		}

		function _loadSelector(el, autoClose) {
			var url = (el.pathname || el.href || el.action);
			if (el.pathname && el.pathname.indexOf('/') != 0) {
				url = '/' + el.pathname; /*For MSIE*/
			}

			autoClose = typeof autoClose == 'undefined' ? true : autoClose;
			_lastEl = el;

			if (autoClose && _self.hasClass(_conEl, CSS_CLASS_OPEN)) {
				_hideSelector();
			} else {
				_self.addClass(_conEl, CSS_CLASS_OPEN);
				if (typeof miwt !== 'undefined') {
					miwt.observe(d, 'keyup', _hideLastEsc);
				}
				_getContent(el, url);
			}

			return false;
		}

		function _hideSelector() {
			_siteSelectionConEl.style.display = 'none';
			_self.removeClass(_conEl, CSS_CLASS_OPEN);
			_self.removeClass(_conEl, CSS_CLASS_LOADING);

			if (typeof miwt !== 'undefined') {
				miwt.stopObserving(d, 'keyup', _hideLast);
			}
		}

		function _hideLast(evt) {
			if (_lastEl) {
				_hideSelector();
			}
		}

		function _hideLastEsc(evt) {
			if (_lastEl) {
				evt = evt || w.event;
				if (evt.keyCode == 27) {
					_hideSelector();
				}
			} else {
				if (typeof miwt !== 'undefined') {
					miwt.stopObserving(d, 'keyup', _hideLast);
				}
			}
		}

		function _changeSite(evt) {
			var form = _self.getClosestParent(this, 'form');
			if (form) {
				form.submit();
			}

			_self.addClass(_conEl, CSS_CLASS_LOADING);
		}

		function _resetFilterInput(evt) {
			if (_filterInputEl) {
				_filterInputEl.value = '';
			}
			return true;
		}

		/**
		 * Get the content.
		 * @param {Object} el the element that received the event.
		 * @param {Object} url the URL.
		 */
		function _getContent(el, url) {
			var ajax = _self.ajax();
			var params = '';

			if (el.nodeName.toLowerCase() == 'form' && typeof miwt !== 'undefined') {
				params = miwt.serialize(el);
			}
			if (url.indexOf("/") == 0 && url.indexOf("/partial") != 0) {
				url = "/partial" + url;
			}

			_self.removeClass(_conEl, CSS_CLASS_LOADING);
			var timer = w.setTimeout(function() {
				_self.addClass(_conEl, CSS_CLASS_LOADING);
			}, 150);

			_siteSelectionConEl.innerHTML = '<span></span>';

			ajax.onreadystatechange = function() {
				if (this.readyState == 4) {
					switch (this.status) {
						case 200:
						case 0:
							var hv = this.getResponseHeader("X-CMS-Login");
							if (hv == "true") {
								alert(MESSAGE_SESSION_EXPIRED);
								w.location.reload();
								return;
							}

							_siteSelectionConEl.innerHTML = this.responseText;

							_removeSiteSelectionListeners();
							_updateSiteSelectionElements();
							_addSiteSelectionListeners();

							if (_filterInputEl) {
								_filterInputEl.focus();
							}

							var siteSelectorList = _siteSelectionConEl.querySelectorAll(SELECTOR_CHANGE_LINKS);
							if (siteSelectorList && siteSelectorList.length == 1) {
								siteSelectorList[0].focus();
							}

							break;
						default:
							_loadSelector(el);
							break;
					}
					w.clearTimeout(timer);
					_self.removeClass(_conEl, CSS_CLASS_LOADING);
				}
			};
			ajax.open('GET', url + '?' + params);
			ajax.send();
		}

		function _removeSiteSelectionListeners() {
			if (_submitLoadEls) {
				_self.removeEventListenerList(_submitLoadEls, 'submit', _loadSelectorForSubmit);
			}
			if (_clickChangeEls) {
				_self.removeEventListenerList(_clickChangeEls, 'click', _changeSite);
			}
			if (_closeEl) {
				_closeEl.removeEventListener('click', _hideLast);
			}
			if (_resetEl) {
				_resetEl.removeEventListener('click', _resetFilterInput);
			}
		}

		function _updateSiteSelectionElements() {
			_submitLoadEls = _self.querySelectorAllArray(_conEl, SELECTOR_FILTER_FORM);
			_clickChangeEls = _self.querySelectorAllArray(_conEl, SELECTOR_CHANGE_LINKS);
			_filterInputEl = _siteSelectionConEl.querySelector(SELECTOR_FILTER_INPUT);
			_closeEl = _conEl.querySelector(SELECTOR_CLOSE_ACTION);
			_resetEl = _conEl.querySelector(SELECTOR_RESET_ACTION);
		}

		function _addSiteSelectionListeners() {
			if (_submitLoadEls) {
				_self.addEventListenerList(_submitLoadEls, 'submit', _loadSelectorForSubmit);
			}
			if (_clickChangeEls) {
				_self.addEventListenerList(_clickChangeEls, 'click', _changeSite);
			}
			if (_closeEl) {
				_closeEl.addEventListener('click', _hideLast, false);
			}
			if (_resetEl) {
				_resetEl.addEventListener('click', _resetFilterInput, false);
			}
		}

		function _init() {
			_clickLoadEls = _self.querySelectorAllArray(_conEl, SELECTOR_OPEN_CONTROLS);

			_self.addEventListenerList(_clickLoadEls, 'click', function(evt) {
				evt.preventDefault();
				return _loadSelector(this, evt);
			});

			_updateSiteSelectionElements();
			_addSiteSelectionListeners();
		}

		_init();
	}

	SiteSelector.prototype = {
		ajax: function() {
			try { return new XMLHttpRequest(); } catch(evt) {}
			return null;
		},
		getClosestParent: function (el, tag) {
			tag = tag.toUpperCase();
			do {
				if (el.nodeName === tag) {
					return el;
				}
			} while (el = el.parentNode);

			return null;
		},
		addEventListenerList: function(els, eventType, fn) {
			for (var i = 0, el; el = els[i]; i++) {
				el.addEventListener(eventType, fn, false);
			}
		},
		removeEventListenerList: function(els, eventType, fn) {
			for (var i = 0, el; el = els[i]; i++) {
				el.removeEventListener(eventType, fn);
			}
		},
		hasClass: function(el, cls) {
			return !!(el.className || '').match(new RegExp(cls));
		},
		removeClass: function(el, cls) {
			el.className = el.className.replace(cls, '').trim();
		},
		addClass: function(el, cls) {
			if (!this.hasClass(el, cls)) {
				el.className += " " + cls;
			}
		},
		querySelectorAllArray: function(con, selector) {
			return [].slice.call(con.querySelectorAll(selector));
		}
	};


	function initSiteSelectors() {
		var siteSelectorEls = [].slice.call(d.querySelectorAll(SELECTOR_CON));

		for (var siteSelectorEl, i = 0; siteSelectorEl = siteSelectorEls[i]; i++) {
			new SiteSelector(siteSelectorEl);
		}

		d.removeEventListener('DOMContentLoaded', initSiteSelectors);
	}

	d.addEventListener('DOMContentLoaded', initSiteSelectors);
})(window, document);