// NOTE if functions are used in the bookmarklet, don't use double quotes to make it easier on yourself
CMS_LE_API = (function ($, w, d) {
    var hasCMS_LE = typeof CMS_LE != 'undefined';
    /* @const */
    var UA_GECKO = navigator.userAgent.indexOf("Gecko") != -1
        && navigator.userAgent.indexOf("like Gecko") == -1;
    /* @const */
    var PARAM_CMS_INTEGRATION = '__cms_le__';
    /* @const */
    var DATA_LOOKUP_ID = 'data-lelookupid';
    /* @const */
    var DATA_OP = 'data-op';
    /* @const */
    var DATA_CMS_PE = 'data-cms_pe';
    /* @const */
    var DATA_CMS_PE_EMPTY = 'data-cms_pe_empty';
    /* @const */
    var DATA_DS_CMS_PE = 'data-ds_cms_pe';
    /* @const */
    var DATA_DS_CMS_PE_TYPE = 'data-ds_cms_pe_type';
    /* @const */
    var DND_DATA_TYPE_OPERATION = 'application/x-operation';
    /* @const */
    var DND_DATA_TYPE_COMPONENT_KEY = 'application/x-component-key';
    /* @const */
    var DND_DATA_TYPE_COMPONENT_IDENTIFIER = 'application/x-component-identifier';
    /* @const */
    var DND_DATA_TYPE_SOURCE = 'application/x-component-source';
    /* @const */
    var PAT_JSESSIONID = /(;jsessionid=[^#;&?]+)/i;
    /* @const */
    var DEFAULT_COMPONENT_OPTIONS = ['permissions', 'references'];
    /* @const */
    var NOOP = function NOOP(){};
    /* @const */
    var DEBUG = true;

    if (hasCMS_LE && CMS_LE.bookmarkletInited) return;
    if(!console.groupEnd) console.groupEnd = NOOP;
    if(!console.group) console.group = NOOP;
    if(!console.groupCollapsed) console.groupCollapsed = NOOP;

    /**
     * Test if the browser is supported.
     * @return {boolean} True if the browser is supported.
     */
    function isBrowserSupported() {
        try {
            if (!XMLHttpRequest) return false;
            var req = new XMLHttpRequest();
            if (!('withCredentials' in req)) return false;
            if (!('onloadend' in req)) return false;
            if (!JSON || !JSON.stringify || !JSON.parse) return false;
            if ((typeof Element) == 'undefined') return false;
        } catch (e) {
            console.log(e);
            return false;
        }
        return true;
    }

    function queryStart(path) {
        return (path.indexOf('?') == -1 ? '?' : '&');
    }

    /** XHR with options object and optional callback on completion.
     * @param {object} opts the options. Defaults {"method":"GET", "headers":{}, "url":"$.one(location.href)", "data":null, "withCredentials":null}.
     * @param {function|null} complete optional callback.
     */
    function xhr(opts, complete) {
        opts = opts || {};
        var req = new XMLHttpRequest(), url = (opts.url || location.href).replace(PAT_JSESSIONID, '');
        req.onloadend = complete;
        req.open(opts.method || 'GET', url);
        if (opts.withCredentials) req.withCredentials = opts.withCredentials;
        if (opts.headers) {
            for (var k in opts.headers) {
                if (opts.headers.hasOwnProperty(k)) req.setRequestHeader(k, opts.headers[k]);
            }
        }
        req.send(opts.data);
    }

    function newList(l) {
        if (!l) return []; else return Array.prototype.slice.call(l);
    }

    /** Modes of operation.
     * @enum {number}
     */
    w.LiveEditMode = {
        DISABLED: 0,
        BOOKMARKLET: 1,
        BROWSER_EXTENSION: 2
    };
    Prop = LiveEditStorage({
        PRIMARY_TOOLBAR_LOCATION: {key: 'cms_le_PrimaryToolbarLocation', 'default': 'top',
            classes: ['top', 'bottom'],
            title: function () {
                return this.get() == 'top' ? 'Bottom' : 'Top';
            },
            html: function () {
                return this.get() == 'top' ? 'b' : 't';
            }
        },
        PRIMARY_TOOLBAR_VISIBILITY: {key: 'cms_le_PrimaryToolbarVisibility', 'default': 'shown',
            classes: ['shown', 'hidden'],
            title: function () {
                return this.get() == 'shown' ? 'Hide' : 'Show';
            },
            html: function () {
                var t = Prop.PRIMARY_TOOLBAR_LOCATION.get() == 'top', s = this.get() == 'shown', e = 2303;
                if (!t != !s) e++;
                return '&#x' + (e) + ';';
            }
        },
        PRELOADED_IMAGES: {key: 'cms_le_preloadedImages', 'default': false, storage: 'session'},
        COMPONENT_SEARCH: {key: 'cms_le_componentsearch', 'default': '', storage: 'session'}
    });
    function createOverlay() {
        $.node.create('<div style="display:none" id="cms-le-overlay" class="cms_le_"><table class="cms-le-overlay-layout"><td class="cms-le-overlay-layout"><div id="cms-le-overlay-content"></div></td></table></div>').appendTo('body');
    }

    function overlay(content) {
        var cn = $.one('#cms-le-overlay-content');
        cn.purge(null, null, true);
        if (content.nodeType == 1 || content._node) {
            cn.setHtml('');
            cn.append(content);
        } else {
            cn.setHtml(content);
        }
        $.one('#cms-le-overlay').show();
    }

    function promptLogin() {
        overlay(LiveEditTemplate('tmpl-le-login', CMS_LE_API));
    }

    function promptForbidden() {
        overlay(LiveEditTemplate('tmpl-le-forbidden', CMS_LE_API));
    }

    function promptUnableToLoad(ctx) {
        overlay(LiveEditTemplate('tmpl-le-unable-to-load', ctx));
    }


    function getQuitButton() {
        return $.one('#cms-le-ptb .toolbar-controls .le-quit');
    }

    function getVisibilityButton() {
        return $.one('#cms-le-ptb .toolbar-controls .le-visibility');
    }

    function getLocationButton() {
        return $.one('#cms-le-ptb .toolbar-controls .le-location');
    }

    function getPrimaryToolbar() {
        return $.one('#cms-le-ptb');
    }

    function setupToggle(tb, btn, pref) {
        var cn = pref.get();
        pref.classes.forEach(function (el) {
            tb.removeClass(el);
        });
        tb.addClass(cn);
        btn.setAttribute('title', pref.title());
        btn.setHtml(pref.html());
    }

    function createFloatingPalette() {
        var node = $.node.create('<div class="cms_le_ clearfix" id="cms-le-float-palette"><div class="le-titlebar" draggable="true"><span class="le-title"></span><span class="le-controls le-close ficon" onclick="CMS_LE_API.closeFloatingPalette();">x</span></div><div id="cms-le-float-palette-content"></div></div>').appendTo('body');
        node.hide();
        // NOTE: using DnD API allows automatic document scrolling
        var pos/*position offset*/, maxY, el = node.one('.le-titlebar')._node;
        function dragOverForGecko(e){
          if ((e.pageX == 0 && e.pageY == 0) || e.pageY > maxY || e.pageY < d.body.scrollTop)
            return;
          node.setStyles({left: (e.pageX - pos.x), top: (e.pageY - pos.y)});
        }
        el.addEventListener('mousedown', function(e){
          var r = node.region();
          pos = {x: e.pageX - r.left, y: e.pageY - r.top};
        });
        el.addEventListener('dragstart', function (e) {
            var dataTransfer = e.dataTransfer;
            dataTransfer.effectAllowed = 'all'; // 'move' can trigger browser bug
            if(dataTransfer.setDragImage) {
              dataTransfer.setData("x-do-anything", "nothing"); // Firefox workaround - must call setData to get DnD to work.
              var img = new Image();
              img.src = '/_resources/dyn/docroot/lib/miwt/images/transpixel.gif';
              dataTransfer.setDragImage(img, -12, -22);
            }
            maxY = d.body.scrollHeight;
            if(UA_GECKO){
              d.addEventListener("dragover", dragOverForGecko);
              el.addEventListener("dragend", function(){d.removeEventListener("dragover", dragOverForGecko);});
            }
        });
        el.addEventListener('dragenter', function (e) {e.preventDefault();});
        el.addEventListener('dragover', function (e) {
            if (e.preventDefault) e.preventDefault(); // required to get the drop event
            e.dataTransfer.dropEffect = 'all';
            return false;
        });
        // NOTE: firefox doesn't report mouse coord for drag event, so we also use dragover for mouse events
        el.addEventListener('drag', function (e) {
            //if (DEBUG) console.log('drag event', {x: e.pageX, y: e.pageY}, e);
            if ((e.pageX == 0 && e.pageY == 0) || e.pageY > maxY || e.pageY < d.body.scrollTop)
              return;
            node.setStyles({left: (e.pageX - pos.x), top: (e.pageY - pos.y)});
        });
    }

    function resizeFloatingPalette() {
        var i, node = $.one('#cms-le-float-palette-content'), c, cc = ['.le-search-results'], s,
            de = d.documentElement, vp = $.viewport();
        s = {'max-height': (vp.height * 0.8) - 75};
        for (i = 0; i < cc.length; i++) {
            c = node.one(cc[i]);
            if (c._node) {
                c.setStyles(s);
                return;
            }
        }

    }

    function openFloatingPalette(title, content) {
        var node = $.one('#cms-le-float-palette').show();
        node.one('.le-title').setHtml(title || 'Floating Palette');
        node.setStyles({'top': ((d.body.scrollTop || d.documentElement.scrollTop) + 55)});
        setFloatingPaletteContent(content);
    }

    function setFloatingPaletteContent(content) {
        var node = $.one('#cms-le-float-palette-content');
        // FIXME: Purge is incredibly slow - fix
        node.purge(null, null, true);
        node.setHtml(content);
        resizeFloatingPalette();
    }

    function createDropLocations() {
        function acceptDrop(e) {
            var ee = e._e;
            if (ee.preventDefault) ee.preventDefault(); // required to get the drop event
            ee.dataTransfer.dropEffect = (ee.keyCode) == 27 ? 'none' : 'copy';
            return false;
        }

        $.node.create('<div class="cms_le_ le-drop-location clearfix" id="cms-le-drop-location"><span class="le-target"></span></div>').appendTo('body').hide()
            .on('dragover', acceptDrop);
        $.node.create('<div class="cms_le_ le-drop-location le-alt clearfix" id="cms-le-drop-location-alt"></div>').appendTo('body').hide()
            .one('dragover', acceptDrop);
    }

    function createPrimaryToolbar() {
      var docURL = '//' + CMS_LE_API.backend_host + '/LiveEdit/docs/';
        var node = $.node.create('<div class="cms_le_ clearfix" id="cms-le-ptb">'
            + '<div class="le-branding">'
            + '<span class="le-title"><span class="le-product">VipaSuite</span><span class="le-app-name"><strong>Live Edit</strong></span></span>'
            + '<span class="le-toolbox">'
            + '<button accesskey="x" type="button" id="cms-le-dnd-component" title="Add Component" class="ficon">Add</button>'
            + '</span>'
            + '<span class="le-nav-actions">'
            + '<button type="button" id="cms-le-nav-out" title="Out" class="ficon">&#x2196;</button>'
            + '<button type="button" id="cms-le-nav-up" title="Previous" class="ficon">&#x2191;</button>'
            + '<button type="button" id="cms-le-nav-down" title="Next" class="ficon">&#x2193;</button>'
            + '</span>'
            + '</div>'
            + '<div class="le-component"></div><div class="le-component-actions"></div>'
            + '<div class="toolbar-controls"><a accesskey="h" class="le-help ficon" title="Help" target="help_page" href="'
            + docURL
            + '">?</a><span accesskey="l" class="le-location ficon" title="Bottom">b</span><span accesskey="v" class="le-visibility ficon" title="Hide">h</span><span class="le-quit ficon" title="Quit">q</span></div>'
            + '</div>').appendTo('body');

        var visBtn = getVisibilityButton(), locBtn = getLocationButton();

        function toggleVisibility(evt) {
            var pref = Prop.PRIMARY_TOOLBAR_VISIBILITY, ov = pref.get(), nv = (ov == 'hidden' ? 'shown' : 'hidden');
            pref.set(nv);
            setupToggle(node, visBtn, pref);
        }

        function toggleLocation(evt, init) {
            var pref = Prop.PRIMARY_TOOLBAR_LOCATION, ov = pref.get('top'), nv = (ov == 'bottom' ? 'top' : 'bottom');
            pref.set(nv);
            setupToggle(node, locBtn, pref);
            setupToggle(node, visBtn, Prop.PRIMARY_TOOLBAR_VISIBILITY); // Icon is different depending on location
        }

        visBtn.on('click', toggleVisibility);
        locBtn.on('click', toggleLocation);
        // Initial
        setupToggle(node, visBtn, Prop.PRIMARY_TOOLBAR_VISIBILITY);
        setupToggle(node, locBtn, Prop.PRIMARY_TOOLBAR_LOCATION);
        getQuitButton().on('click', CMS_LE_API.quitLiveEdit);

        $.one('#cms-le-dnd-component').on('click', CMS_LE_API.toggleDnDComponentTool).on('keypress', CMS_LE_API.toggleDnDComponentTool);
        $.one('#cms-le-nav-out').on('click', CMS_LE_API.navParent).on('keypress', CMS_LE_API.navParent);
        $.one('#cms-le-nav-up').on('click', CMS_LE_API.navPrevious).on('keypress', CMS_LE_API.navPrevious);
        $.one('#cms-le-nav-down').on('click', CMS_LE_API.navNext).on('keypress', CMS_LE_API.navNext);
    }

    function createComponentToolbar() {
        var node = $.node.create('<div class="cms_le_ clearfix" id="cms-le-ctb"></div>')
            .appendTo('body').hide();
    }

    function rewriteLinksBookmarklet(enable) {
        // This is required for the bookmarklet version only - cache busting
        Array.prototype.forEach.call(d.links, function (l) {
            if (l.hostname == location.hostname) {
                if (enable) {
                    if (l.pathname.indexOf('/csarf') != 0)
                        l.href = (l.href + queryStart(l.href) + PARAM_CMS_INTEGRATION + '=' + LiveEditMode.BOOKMARKLET);
                } else l.href = l.href.replace(new RegExp('[?&]' + PARAM_CMS_INTEGRATION + '=[0-9]', 'g'), '');
            }
        });
    }

    function isCMSHosted(mode, cb) {
        if (!isBrowserSupported()) {
            cb.call(CMS_LE, {'status': 400, 'statusMessage': 'Your browser does not support the Live Edit application.'});
            return;
        }
        if (hasCMS_LE) {
            cb.call(CMS_LE, {'status': 200});
            return;
        }
        xhr({method: 'POST', headers: {"Cache-Control": "max-age=0", "X-CMS-Integration": mode}}, function () {
                // We should try to uncache all links to local pages in case we exit, then enter live edit pages
                if (this.status == 200) {
                    try {
                        var isCMS = !!this.getResponseHeader('X-CMS-Info') && this.getResponseHeader('Content-Type').substring(0, 16) == 'application/json';
                        if (isCMS) {
                            var json = JSON.parse(this.responseText);
                            json.status = 200;
                            if (!window.CMS_LE) window.CMS_LE = json;
                            cb.call(CMS_LE, json);
                        } else
                            cb.call(CMS_LE, {'status': 404, 'statusMessage': 'Does not appear to be a CMS hosted site.'});
                    } catch (e) {
                        cb.call(CMS_LE, {'status': 500, 'statusMessage': (e + '')});
                    }
                } else {
                    // ERROR
                    cb.call(CMS_LE, {'status': this.status, 'statusMessage': 'Unable to connect to site.'});
                }
            }
        );
    }

    var _keyboardActive = false;

    function keyboardUnpress(e) {
        if (!_keyboardActive) return;
        _keyboardActive = false;
        with (CMS_LE_API) {
            switch (e.which) {
                case 38:/*up*/
                    $.one('#cms-le-nav-up').removeClass('active');
                    break;
                case 40:/*down*/
                    $.one('#cms-le-nav-down').removeClass('active');
                    break;
                case 37:/*left*/
                    $.one('#cms-le-nav-out').removeClass('active');
                    break;
            }
        }
    }

    function keyboardActivation(e) {
        var m = (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey), nn = e.target.nodeName.toUpperCase();
        if (!m || nn == 'INPUT' || nn == 'TEXTAREA') return;
        with (CMS_LE_API) {
            switch (e.which) {
                case 38:/*up*/
                    $.one('#cms-le-nav-up').addClass('active');
                    _keyboardActive = true;
                    navPrevious();
                    break;
                case 40:/*down*/
                    $.one('#cms-le-nav-down').addClass('active');
                    _keyboardActive = true;
                    navNext();
                    break;
                case 37:/*left*/
                    $.one('#cms-le-nav-out').addClass('active');
                    _keyboardActive = true;
                    navParent();
                    break;
                case 39:/*right*/
                    navDescendent();
                    _keyboardActive = true;
                    break;
            }
            var ch = String.fromCharCode(e.keyCode).toLowerCase();
            ch = d.querySelector('[data-accesskey="' + ch + '"]');
            if (ch) {
                ch.click();
                // _keyboardActive=true;
            }
        }
        if (_keyboardActive) {
            e.stopPropagation();
            e.preventDefault();
        }
    }

    function touchStart(e) {
        if (e.touches.length == 2) {
            CMS_LE_API.activate(e.touches[0].target);
            //e.stopPropagation();
            //e.preventDefault();
        }
    }

    function clickActivation(e) {
        var m = (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey), sel = getSelection(),
            t = e.target, nn = t.nodeName.toUpperCase(), ti = (nn == 'INPUT' || nn == 'TEXTAREA'),
            selType = sel.type || 'Range';
        if (!m) return;

        if (selType == 'Range' && !ti && _lastSelectionStart) {
            sel.removeAllRanges(); // Prevent use of shift key in activation from selecting text
        }
        e.stopPropagation();
        e.preventDefault();
        CMS_LE_API.activate(e.target);
    }

    var _lastSelectionStart;

    function clearRecordedSelection() {
        _lastSelectionStart = null;
    }

    function recordSelection(e) {
        var t = e.target, nn = t.nodeName.toUpperCase(),
            ti = (nn == 'INPUT' || nn == 'TEXTAREA');
        _lastSelectionStart = !ti ? true : null;
        setTimeout(clearRecordedSelection, 100);
    }

    function setupEmptyBoxes() {
        getCmsComponents().forEach(setupEmptyBox);
    }

    function startApp() {
        delete CMS_LE;
        if (!CMS_LE_API.page) return; // Must have successfully loaded the page info
        rewriteLinksBookmarklet(true);
        // NWT doesn't support event capture.
        d.addEventListener('selectstart', recordSelection, true);
        d.addEventListener('click', clickActivation, true);
        d.addEventListener('keydown', keyboardActivation, true);
        d.addEventListener('keyup', keyboardUnpress, true);
        d.addEventListener('touchstart', touchStart, true);
        CMS_LE_API.activate(d);
        setupEmptyBoxes();
        convertAccessKey2Shortcut();
        observeMutations(); // Must be last
    }

    function preloadImages() {
        // Preload component images
        if (!Prop.PRELOADED_IMAGES.get()) {
            Prop.PRELOADED_IMAGES.set(true);
            var img, c, k, imgs = {}, cl = CMS_LE_API.page.components;
            for (k in cl) {
                c = cl[k];
                if (!(c.icon in imgs)) {
                    img = new Image();
                    img.src = c.icon;
                    imgs[c.icon] = img;
                }
            }
        }
    }

    function hasOpts(c, opts) {
        if (!c) return false;
        if (!opts || opts.length == 0) return true;
        return opts.every(function (el) {
            return c.options.indexOf(el) != -1;
        });
    }

    function isFresh(c) {
        if (!c || !c.timestamp) return false;
        var d = new Date(c.timestamp), n = new Date();
        return (d.getTime() + 60000) > n;
    }

    function searchPathForAttr(el, att) {
        var p = !el || el.nodeType == 1 ? el : el.parentNode;
        if (!p) return null;
        do {
            if (p.getAttribute && p.getAttribute(att)) return p;
        } while ((p = p.parentElement) != null);
        return null;
    }

    /** Given an element or key return the key.
     */
    function getKeyFromComponent(el) {
        if (!el.nodeType) return el;
        el = findComponentElement(el);
        if (el.parentElement == null) return CMS_LE_API.page.rendered;
        return el.getAttribute(DATA_CMS_PE) || CMS_LE_API.page.rendered;
    }

    function getComponentPath(el) {
        if (el.parentElement == null) return CMS_LE_API.page.rendered;
        var path = [], p = el;
        do {
            path.push(p.getAttribute(DATA_CMS_PE));
        } while ((p = findComponentElement(p.parentElement)) != d);
        path.push(CMS_LE_API.page.rendered);
        return path.reverse().join(',');
    }

    function getComponentFromPath(path) {
        var api = CMS_LE_API;
        if (path.length == 0) return document;
        if (path.length == 1 && path[0] == api.page.root) return document;
        if (path[0] == api.page.root) path.shift();
        var selector = path.map(function (item) {
            return ('[' + DATA_CMS_PE + '="' + item + '"]');
        }).join(' ');
        return d.querySelector(selector);
    }

    /** Given an element in the document, find the CMS component element.
     */
    function findComponentElement(el) {
        return searchPathForAttr(el, DATA_CMS_PE) || d;
    }

    function getServerFrame() {
        var server = $.one('#cms-le-overlay iframe')._node;
        return server ? server.contentWindow : null;
    }

    function getVisibleRegionFromAncestor(el, region) {
        var a = el, hidden = false, found = null;
        while (a) {
            var test = $.one(a), sd = test.computeCss('display');
            if (hidden && found == null && sd != 'none')
                found = a;
            if (sd == 'none') {
                found = null;
                hidden = true;
            }
            a = a.parentElement;
        }
        if (found && hidden)
            return $.one(found).region();
        else
            return region;
    }

    /** Check if still logged in.
     */
    function loginCheck() {
        xhr({url: (CMS_LE_API.api_url + '/ping'), withCredentials: true}, function () {
            switch (this.status) {
                case 401:
                    promptLogin();
                    break;
                default:
                    break;
            }
        });
    }

    function isNotDisplayed(el) {
        // We want to determine if not displayed - not if visible, slight difference
        while (el) {
            if ($.one(el).computeCss('display') == 'none') return true;
            el = el.parentElement;
        }
        return false;
    }

    function getPXValue(px) {
        if (!px) return 0;
        px = +px.replace('px', '');
        return isNaN(px) ? 0 : px;
    }

    function getDim(el) {
        var w = el.get('offsetWidth'), h = el.get('offsetHeight'), px = getPXValue;
        if (el.computeCss('box-sizing') != 'border-box') {
            w = w - px(el.computeCss('padding-left')) - px(el.computeCss('padding-right')) - px(el.computeCss('border-left-width')) - px(el.computeCss('border-right-width'));
            h = h - px(el.computeCss('padding-top')) - px(el.computeCss('padding-bottom')) - px(el.computeCss('border-top-width')) - px(el.computeCss('border-bottom-width'));
        }
        return {width: w, height: h};
    }

    /** Delete the active component.
     */
    function deleteComponent() {
        var me = CMS_LE_API;
        if (!me.activeKey) return;
        if (DEBUG) console.groupCollapsed('deleteComponent() - %s', me.activeKey);
        me.closeOverlay();
        var c = me.page.components[me.activeKey], isdelegate = (me.getComponent(me.activeElement.parentNode) || {}).supports_delegation;
        // This could have questions, in the future we might want to display a UI in an iframe from the server.
        var onpt = (c.content_area_type == 'page_template'), otherpages = false, multiref = ((c.references || []).length > 1),
            msg = 'Are you sure you want to remove "' + (c.title || c.name) + '"?', warn = '';
        if (onpt) warn = 'This component is part of the page template';
        if (multiref) {
            otherpages = c.references.some(function (item) {
                return (item[0] != me.page.root);
            });
            var secondary = '';
            if (!onpt && otherpages) secondary = 'is on multiple pages';
            if (getCmsComponents(c.key).length > 1) {
                if (secondary) secondary += ' and ';
                secondary += 'is on this page multiple times';
            }
            if (secondary) {
                if (warn) warn += ' and ' + secondary;
                else warn += 'This component ' + secondary;
            }
        }
        if (warn) {
            warn += '.\n\n';
            if (onpt) warn += 'Removing this component may affect multiple pages.\n\n';
            msg = warn + msg;
        }
        var latch = new CountDownCallback(function () {
            if (DEBUG)console.groupEnd();
        }, 1);
        if (confirm(msg)) {
            var url = me.editor_url + '/' + me.getActivePath() + '/' + encodeURIComponent(me.activeLocale) + '/detach';
            loginCheck();
            xhr({url: url, method: 'POST', withCredentials: true}, function () {
                switch (this.status) {
                    case 200:
                    case 204:
                        var toRemove = $.one(me.activeElement),
                            dim = getDim(toRemove),
                            dim1 = (toRemove.computeCss('float') != 'none' || toRemove.computeCss('display').indexOf('inline') != -1) ? 'width' : 'height',
                            s = {'overflow': 'hidden', 'opacity': 1};
                        for (var k in dim) s[k] = dim[k] + 'px';
                        toRemove.setStyles(s);
                        setTimeout(function () {
                            s = {'transition': 'all 1s', '-webkit-transition': 'all 1s', 'opacity': 0};
                            s[dim1] = '0px';
                            toRemove.setStyles(s);
                        }, 0);
                        setTimeout(function () {
                            me.navPrevious();
                            toRemove.remove();
                            if (isdelegate) {
                                var path = getComponentPath(me.activeElement);
                                me.refreshContent(me.activeElement.parentElement, function () {
                                    if (DEBUG) console.log('re-activating child of delegate');
                                    me.activate(getComponentFromPath(path.split(',')));
                                    latch.countDown();
                                });
                            } else {
                                latch.countDown();
                            }
                        }, 1000);
                        displayAlert('"' + (c.title || c.name) + '" component deleted', 3);
                        break;
                    default:
                        latch.countDown();
                        displayAlert('Unable to delete the "' + (c.title || c.name) + '" component (code: ' + this.status + ')');
                        break;
                }
            });
        } else {
            latch.countDown();
        }
    }

    function resizeCallback() {
        var me = CMS_LE_API;
        me.updateComponentModel(me.getComponent(me.activeKey));
        resizeFloatingPalette();
    }

    /** Show the drop location.
     * @param {boolean} vert orientation.
     * @param {object} coord top, left, bottom, right coordinates in the document|page.
     * @param {string|null} mesg optional message to display with the drop location.
     * @param {boolean|null} alt optional boolean to show the alternate drop location. Message is ignored if set.
     */
    function showDropLocation(vert, coord, mesg, alt) {
        var node = $.one('#cms-le-drop-location' + (alt ? '-alt' : ''));
        node.setStyles(coord);
        if (vert) node.addClass('le-vertical');
        else node.removeClass('le-vertical');
        node.show();
        if (!alt) node.one('.le-target').setHtml(mesg || '');
    }

    function hideDropLocation(alt) {
        $.one('#cms-le-drop-location' + (alt ? '-alt' : '')).hide();
    }

    function sqr(x) {
        return x * x;
    }

    function lineDistance(v, w) {
        return Math.sqrt(sqr(v.x - w.x) + sqr(v.y - w.y));
    }

    // 3 args: point, line point 1, line point 2
    function distanceToLine(p, v, w) {
        var ld = lineDistance(v, w);
        if (ld == 0) return lineDistance(p, v);
        var proj = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / (ld * ld);
        if (proj < 0) return lineDistance(p, v);
        if (proj > 1) return lineDistance(p, w);
        var pOnVW = { x: v.x + proj * (w.x - v.x), y: v.y + proj * (w.y - v.y) };
        return lineDistance(p, pOnVW);
    }

    function isIntersection(r1, r2) {
        return !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);
    }

    function getRectAtPoint(p, l) {
        var l1 = l / 2;
        return {width: l, height: l, left: p.x - l1, right: p.x + l1, top: p.y - l1, bottom: p.y + l1, point: p};
    }

    function addLookupId(el) {
        var lookupid = el.getAttribute(DATA_LOOKUP_ID);
        if (!lookupid) {
            // We cannot depend on HTML IDs being unique. Some sites - using AJAX - add dup IDs to pages.
            el.setAttribute(DATA_LOOKUP_ID, lookupid = $.uuid());
        }
        return lookupid;
    }

    function getElementLookupSelector(lookupid) {
        return '[' + DATA_LOOKUP_ID + '="' + lookupid + '"]';
    }

    /** Add element lookup to the specified object for the specified element.
     */
    function addElementLookup(el, obj) {
        var lid = addLookupId(el), selector = getElementLookupSelector(lid);
        obj.getElement = function () {
            return d.querySelector(selector);
        };
    }

    function getCmsComponent(key) {
        return d.querySelector('[' + DATA_CMS_PE + '="' + key + '"]');
    }

    function getCmsComponents(key) {
        return newList(d.querySelectorAll('[' + DATA_CMS_PE + (key ? ('="' + key + '"') : '') + ']'));
    }

    function getComponentRects() {
        return getCmsComponents().map(function (c) {
            var obj = {rect: c.getBoundingClientRect(), el: c.id, key: c.getAttribute(DATA_CMS_PE)};
            addElementLookup(c, obj);
            return obj;
        });
    }

    function getEdgeDistance(vertical, p, r) {
        var l1v, l1w, l2v, l2w;
        l1v = {x: r.left, y: r.top};
        l2w = {x: r.right, y: r.bottom};
        if (vertical) {
            l1w = {x: r.left, y: r.bottom};
            l2v = {x: r.right, y: r.top};
        } else {
            l1w = {x: r.right, y: r.top};
            l2v = {x: r.left, y: r.bottom};
        }
        return Math.min(distanceToLine(p, l1v, l1w), distanceToLine(p, l2v, l2w));
    }

    function isPositioned(el) {
        var v, p = newList((el._node || el).children);
        p.push(el);
        return p.some(function (item) {
            v = $.one(item).computeCss('position');
            return v == 'absolute' || v == 'fixed';
        });
    }

    function getCandidateComponents(mouse) {
        var ml = Number.MAX_VALUE, prime, primePath,
            matches = getComponentRects().filter(function (item) {
                if (!isIntersection(item.rect, mouse)) return false;
                var valid = false, el = item.getElement(),
                    c = CMS_LE_API.getComponent(el), p = CMS_LE_API.getComponent(el.parentElement),
                    isEmptyBox = (c && c.key.indexOf('bx#') == 0 && (el.children.length == 0 || newList(el.getElementsByTagName('*')).every(function (item) {
                        return item.classList.contains('box_wc');
                    }) )),
                    isContentElement = (c && c.key.indexOf('cb#') == 0),
                    node = $.one(el);
                var floatValue = node.computeCss('float') || 'none';
                item.horiz = (floatValue != 'none' || node.computeCss('display').indexOf('inline') != -1);
                item.distance = getEdgeDistance(item.horiz/*horiz layout -> vertical edges*/, mouse.point, item.rect);
                if (!isPositioned(el) && (isContentElement || isEmptyBox)) {
                    if (isEmptyBox) {
                        item.type = 'container';
                        item.content_area_type = c.content_area_type;
                        item.insert_type = 'child';
                        valid = true;
                    } else if (c && c.supports_delegation && (c.permissions || {}).add_child) {
                        item.type = 'delegating';
                        valid = true;
                    } else if (p && (p.permissions || {}).add_child) {
                        item.type = 'sibling';
                        valid = true;
                    }
                }
                if (valid && item.distance <= ml) {
                    prime = item;
                    ml = item.distance;
                }
                return valid;
            });
        if (prime) {
            // Remove items that are not an ancestor of prime - children too?
            primePath = getComponentPath(prime.getElement());
            matches = matches.filter(function (item) {
                if (item != prime
                    && item.distance < 40 // threshold for how close to the edge you must be
                    && primePath.match(new RegExp('.*' + item.key + '(,|$)'))) {
                    return true;
                } else {
                    return false;
                }
            });
            matches.sort(function (a, b) {
                return a.distance - b.distance;
            });
            return {
                addProperty: function (name, value) {
                    this[name] = this.prime[name] = value;
                    this.related.forEach(function (item) {
                        item[name] = value;
                    });
                },
                prime: prime,
                related: matches,
                drop_options_required: (prime.type == 'delegating') || matches.length > 0
            };
        } else {
            return null;
        }
    }

    var _inDnD = false;
    var _ieDnDData;
    // Drag enter needs to be listened on our artificial drop targets.
    // Also required for IE support
    function dragEnter(e) {
        if (!_inDnD) return false;
        if (e.preventDefault) e.preventDefault(); // required to get the drop event
        e.dataTransfer.dropEffect = (e.keyCode) == 27 ? 'none' : 'copy';
        //if(DEBUG) console.log('DragEnter', e);
        return false; // argh
    }

  function dragOverDocument(e) {
    //if(DEBUG) console.log('DragOver doc', e);
    drag(e);
    return false;
  }

    // Drag over needs to be listened on our components so we can display our artificial drop targets.
    function dragOverComponent(e) {
        if (e.preventDefault) e.preventDefault(); // required to get the drop event
        e.dataTransfer.dropEffect = (e.keyCode) == 27 ? 'none' : 'copy';
        //if(DEBUG) console.log('DragOver', e);
        return false; // argh
    }

    function dragStart(ne) {
        _inDnD = true;
        _ieDnDData = {};
        var api = CMS_LE_API, e = ne._e, img,
            type = DND_DATA_TYPE_COMPONENT_KEY,
            t = e.target;
        op = t.getAttribute(DATA_OP) || 'add',
            key = t.getAttribute(DATA_DS_CMS_PE);
        if (!key && (key = t.getAttribute(DATA_DS_CMS_PE_TYPE))) type = DND_DATA_TYPE_COMPONENT_IDENTIFIER;
        if (!key) {
            if (DEBUG) console.log('NO KEY', e);
            return;
        }
        d.documentElement.classList.add('le-dnd');
        if (DEBUG) console.groupCollapsed('Starting DnD %s operation for %s', op, key);
        var dataTransfer = e.dataTransfer;
        dataTransfer.effectAllowed = 'copy'; // 'move' can trigger browser bug - use copy instead
        // IE workaround - cannot use setData with anything other than "Text" or "URL".
        _ieDnDData[type] = key;
        _ieDnDData[DND_DATA_TYPE_OPERATION] = op;
        dataTransfer.setData("Text", "dragging"); // Firefox workaround - must call setData to get DnD to work.

        if (t.getElement) {
            console.assert(t.getElement() != null, 'Missing target element for %s', key);
            _ieDnDData[DND_DATA_TYPE_SOURCE]=t.getElement().getAttribute(DATA_LOOKUP_ID);
        }
        var c = type == DND_DATA_TYPE_COMPONENT_KEY ? api.getComponent(key) : null;
        if (c) {
            img = d.createElement('img');
            img.src = c.icon;
        }
        else {
            img = t.querySelector('img.le-icon');
        }
        if (img && dataTransfer.setDragImage) dataTransfer.setDragImage(img, 0, 0);
        getCmsComponents().forEach(function (c) {
            c.addEventListener('dragover', dragOverComponent);
            c.addEventListener('dragenter', dragEnter);
        });
        t.addEventListener('dragend', dragEnd);

      if(UA_GECKO) {
        d.addEventListener('dragover', dragOverDocument);
      }
        d.addEventListener('drag', drag);
        d.addEventListener('drop', drop);
        if (api.activeKey == key && api.activeElement.nodeType == 1) api.activeElement.classList.add('le-dnd');
        if (op == 'move'
            && api.activeKey == key
            && api.activeElement.nodeType == 1
            && d.querySelector('[' + DATA_CMS_PE_EMPTY + ']')) {
            // Make sure the Component Toolbar is repositioned for empty elements suddenly taking up space.
            api.positionComponentToolbar();
        }

    }

    function dragEnd(e) {
        d.removeEventListener('dragover', dragOverDocument);
        loginCheck();
        var api = CMS_LE_API;
        d.documentElement.classList.remove('le-dnd');
        if (api.activeElement.nodeType == 1) {
            api.activeElement.classList.remove('le-dnd');
            api.positionComponentToolbar();
        }
        if (DEBUG) console.log('Drag End. Canceled?' + (e.dataTransfer.dropEffect == 'none'));
        d.removeEventListener('drop', drop);
        d.removeEventListener('drag', drag);

        getCmsComponents().forEach(function (c) {
            c.removeEventListener('dragover', dragOverComponent);
            c.removeEventListener('dragenter', dragEnter);
        });
        clearDropLocation();
        if (DEBUG) console.groupEnd(); // dragStart(ne)
    }

    var _lastDLCoord, _lastMatches;

    function clearDropLocation() {
        hideDropLocation();
        hideDropLocation(true);
        _lastMatches = null;
        _lastDLCoord = null;
    }

    function drag(e) {
        if(e.clientX == 0 && e.clientY == 0 && UA_GECKO)
          return;
        var api = CMS_LE_API,
            mouse = getRectAtPoint({x: e.clientX, y: e.clientY}, 40 /*40x40 box around pointer*/),
            matches = getCandidateComponents(mouse),
            primeComponent, dropLocationComponent, dropLocationComponentNode,
            isHoriz, showAltDropLocation;
        if (matches && JSON.stringify(matches) != JSON.stringify(_lastMatches)) {
            _lastMatches = matches;
            //if(DEBUG) console.log('matches', matches);
        } else {
            if (!matches) {
                clearDropLocation();
            }
            return;
        }
        matches.mouse = mouse;
        dropLocationComponent = primeComponent = matches.prime;
        if (matches.related.length > 0) dropLocationComponent = matches.related[matches.related.length - 1];
        isHoriz = primeComponent.horiz;
        showAltDropLocation = matches.related.some(function (item) {
            return item.horiz !== isHoriz;
        });
        // webkit soon fixed : https://bugs.webkit.org/show_bug.cgi?id=23695
        if (_ieDnDData[DND_DATA_TYPE_OPERATION] == 'move'
            && (primeComponent.key == api.activeKey || matches.related.some(function (item) {
            return item.key == api.activeKey
        }))) {
            // We should not drop onto ourselves
            // FIXME : we should not drop next to ourselves - parent cannot have multiple children with the same key
            //if(DEBUG) console.log('oops', elp);
            return clearDropLocation();
        }
        dropLocationComponentNode = $.one(dropLocationComponent.getElement());
        var c = api.getComponent(dropLocationComponentNode._node), region = dropLocationComponentNode.region();
        if (!c) {
            return clearDropLocation();
        }
        var dlCoord = computeDropLocationCoord(e, region, isHoriz);
        matches.addProperty('position', dlCoord.location);
        if (JSON.stringify(_lastDLCoord) != JSON.stringify(dlCoord)) {
            _lastDLCoord = dlCoord;
            var location = primeComponent.type == 'container' ? 'Into' : dlCoord.location,
                dlMessage = matches.drop_options_required ? 'Multiple Options' : (location + ' ' + (c.title || c.name || ''));
            showDropLocation(isHoriz, dlCoord.region, dlMessage);
            if (showAltDropLocation) {
                //if(DEBUG) console.log('Showing alternate drop location');
                dlCoord = computeDropLocationCoord(e, region, !isHoriz);
                showDropLocation(!isHoriz, dlCoord.region, dlMessage, true);
            } else {
                hideDropLocation(true);
            }
            //if(DEBUG) console.log(dlCoord, region);
            //if(DEBUG) console.log('Over "' + c.name + '", ' + c.component_identifier, isHoriz, location, region, e.pageX, e.pageY);
        }
    }

    function drop(e) {
      var api = CMS_LE_API,
            m = _lastMatches,
            func,
            lid = _ieDnDData[DND_DATA_TYPE_SOURCE],
            data = {
                component_identifier: _ieDnDData[DND_DATA_TYPE_COMPONENT_IDENTIFIER],
                key: _ieDnDData[DND_DATA_TYPE_COMPONENT_KEY]
            };
        if (lid) data.getElement = function () {
            return d.querySelector(getElementLookupSelector(lid));
        };

        e.preventDefault();
        if (api.activeElement.nodeType == 1) api.activeElement.classList.remove('le-dnd');
        if (!m || m.prime.key == data.key) return false;
        m.addProperty('operation', _ieDnDData[DND_DATA_TYPE_OPERATION]);
        if (data.key) {
            // Component Instance
            func = executeComponentDrop;
        } else if (data.component_identifier) {
            // New Component
            func = executeNewComponentDrop;
        } else {
            data = null;
        }

        if (data) {
            if (m.drop_options_required) showDropOptions(m.mouse, data, m, func);
            else {
                m.prime.description = createDropDescription(m.prime);
                func(data, m.prime);
            }
        } else {
            console.error('No source data for drop');
        }
        return false;
    }

    function computeDropLocationCoord(e, region, horizLayout) {
        var dlCoord = cloneObject(region), location = 'before';
        if (horizLayout) {
            dlCoord.width = 3;
            dlCoord.height = dlCoord.height - 6;
            dlCoord.right = 'auto';
            if ((e.pageX - region.left) > (region.width / 2)) {
                location = 'after';
                dlCoord.left = region.right + 6;
            } else {
                dlCoord.left = region.left - 6;
            }
        } else {
            dlCoord.height = 3;
            dlCoord.width = dlCoord.width - 6;
            dlCoord.bottom = 'auto';
            if ((e.pageY - region.top) > (region.height / 2)) {
                dlCoord.top = region.bottom + 6;
                location = 'after';
            } else {
                dlCoord.top = region.top - 6;
            }
        }
        return {location: location, region: dlCoord};
    }

    function createDropDescription(dest, delegatePurpose) {
        var api = CMS_LE_API;
        if (delegatePurpose)
            return dest.operation.capitalize() + " As " + delegatePurpose.displayName + " Into " + api.getComponent(dest.key).name;
        else
            return dest.operation.capitalize() + " " + dest.position.capitalize() + " " + api.getComponent(dest.key).name;
    }

    function showDropOptions(mouse, source, matches, cb) {
        var node = $.node.create('<section class="cms_le_" id="cms-le-drop-options"><h1>Drop Options</h1></section>');
        overlay(node);
        var api = CMS_LE_API, list = [matches.prime].concat(matches.related);
        list.forEach(function (item) {
            var dest = cloneObject(item), i, c = api.getComponent(item.key), destinations = [dest];
            dest.description = createDropDescription(dest);
            dest.icon = item.icon = c.icon;
            if (c.supports_delegation) {
                for (i = 0; i < c.delegate_types.length; i++) {
                    dest = cloneObject(item);
                    dest.delegate_type = c.delegate_types[i];
                    dest.description = createDropDescription(dest, dest.delegate_type);
                    destinations.push(dest);
                }
            }
            for (i = 0; i < destinations.length; i++) {
                (function () {
                    var selection = destinations[i];

                    function dropSelectionCB() {
                        var api = CMS_LE_API;
                        cb.call(this, source, selection);
                        api.closeOverlay();
                    }

                    dropSelectionCB.selection = selection;
                    var cl = (matches.prime == item ? 'prime' : ''), b;
                    // TODO recompute which item(s) are alternate drop locations and add a class name
                    b = $.node.create('<button type="button" class="le-location ' + cl + '"">'
                        + '<img width="18" height="18" src="' + selection.icon + '" alt="Component Icon"> <span class="le-drop-description">' + selection.description + '</span></button>');
                    node.append(b);
                    b.on('click', dropSelectionCB);
                })();
            }
        });
        node.append($.node.create('<button type="button" class="le-cancel-drop" onclick="CMS_LE_API.closeOverlay();"><span class="le-drop-description">Cancel</span></button>'));
    }

    function executeNewComponentDrop(source, dest) {
        if (DEBUG) console.log(':executeNewComponentDrop(%s, %s)', source.component_identifier, dest.key);
        var api = CMS_LE_API, url = api.editor_url + '/' + getComponentPath(dest.getElement()).replace(/#/g, '') + '/' + encodeURIComponent(api.activeLocale) + '/' + dest.operation, params = [];
        params.push('position=' + dest.position);
        params.push('component_identifier=' + encodeURIComponent(source.component_identifier));
        if (dest.delegate_type) params.push('delegate_purpose=' + encodeURIComponent(dest.delegate_type.name));
        if (dest.content_area_type) params.push('content_area_type=' + encodeURIComponent(dest.content_area_type));
        params.push('insert_type=' + encodeURIComponent(dest.insert_type || 'sibling'));
        url += ('?' + params.join('&'));
        xhr({url: url, method: 'POST', withCredentials: true}, function () {
            switch (this.status) {
                case 200:
                case 204:
                    var drc = findComponentElement(dest.getElement().parentElement), path = getComponentPath(drc).split(','), key;
                    try {
                        if (this.responseText) path.push(key = JSON.parse(this.responseText).key);
                    } catch (e) {
                    }
                    /*if(key){
                     api.getComponent(key, null, function(c){
                     // FIXME : js template
                     displayAlert('"' + (c.title||c.name) + '" component ' + (dest.operation + 'ed.'));
                     });
                     }*/
                    api.refreshContent(drc, function () {
                        var toActivate = getComponentFromPath(path);
                        if (toActivate) {
                            api.activate(toActivate);
                            api.editComponent();
                        }
                    });
                    break;
                default:
                    displayAlert('Unable to ' + dest.operation + ' the "' + (c.title || c.name) + '" component (code: ' + this.status + ')');
                    break;
            }
        });
    }

    function executeComponentDrop(source, dest) {
        if (DEBUG) console.log(':executeComponentDrop(%s, %s)', source.key, dest.key);
        var api = CMS_LE_API, url = api.editor_url + '/' + getComponentPath(dest.getElement()).replace(/#/g, '') + '/' + encodeURIComponent(api.activeLocale) + '/' + dest.operation, params = [];
        params.push('position=' + dest.position);
        if (source.getElement) params.push('pepath=' + encodeURIComponent(getComponentPath(source.getElement()).replace(/#/g, '')));
        else params.push('pe=' + encodeURIComponent(source.key));
        if (dest.delegate_type) params.push('delegate_purpose=' + encodeURIComponent(dest.delegate_type.name));
        if (dest.content_area_type) params.push('content_area_type=' + encodeURIComponent(dest.content_area_type));
        params.push('insert_type=' + encodeURIComponent(dest.insert_type || 'sibling'));
        url += ('?' + params.join('&'));
        var c = api.getComponent(source.key);
        xhr({url: url, method: 'POST', withCredentials: true}, function () {
            switch (this.status) {
                case 200:
                case 204:
                    // FIXME : JS template for feedback
                    displayAlert('"' + (c.title || c.name) + '" component ' + (dest.operation + 'ed.').replace('eed.', 'ed.'), 3);
                    var src, drc = findComponentElement(dest.getElement().parentElement), path = getComponentPath(drc), pathList = path.split(',');
                    if (source.getElement) src = source.getElement().parentElement;
                    pathList.push(source.key);

                    var f = function postRefreshActivation() {
                        if (DEBUG) console.log('Activating dropped component: ' + path);
                        var toActivate = getComponentFromPath(pathList);
                        if (toActivate) api.activate(toActivate);
                        else api.activate(d);
                    };

                    if (src && drc !== src) {
                        api.refreshContent(src, function () {
                            api.refreshContent(drc, f);
                        });
                    } else {
                        api.refreshContent(drc, f);
                    }

                    break;
                default:
                    displayAlert('Unable to ' + dest.operation + ' the "' + (c.title || c.name) + '" component (code: ' + this.status + ')');
                    break;
            }
        });
    }

    /** Do component search and update the results.
     * @param {string|null} keyword the keyword.
     */
    function doComponentSearch(keyword) {
        $.one('#cms-le-float-palette').addClass('le-loading');
        xhr({url: (CMS_LE_API.api_url + '/component_search?type=mru,type,component&keyword=' + encodeURIComponent(keyword || '')), withCredentials: true}, function () {
            $.one('#cms-le-float-palette').removeClass('le-loading');
            switch (this.status) {
                case 200:
                    var data = JSON.parse(this.responseText), content, search, oldSearch = $.one('#cms-le-float-palette-content input.le-search');
                    if (oldSearch && oldSearch.val() != keyword) {
                        if (!oldSearch.isEventSupported('search')) to = setTimeout(function () {
                            doComponentSearch(search.val());
                        }, 250);
                        return;
                    }
                    Prop.COMPONENT_SEARCH.set(keyword);
                    data.search = {keyword: (keyword || '')};
                    content = LiveEditTemplate('tmpl-le-dnd-component', data);
                    setFloatingPaletteContent(content);
                    search = $.one('#cms-le-float-palette-content input.le-search');
                    if (search._node) {
                        var sn = search._node, to = null, cd = search.val(), doTO = !search.isEventSupported('search');
                        sn.focus();
                        sn.selectionStart = sn.selectionEnd = cd.length;
                        function updateCheck(e) {
                            var ee = e._e;
                            if (to != null) clearTimeout(to);
                            to = null;
                            if (ee.keyCode == 13 || ee.type == 'search') {
                                doComponentSearch(search.val());
                            } else if (doTO && cd != search.val()) {
                                to = setTimeout(function () {
                                    doComponentSearch(search.val());
                                }, 700);
                            }
                        }

                        search.on('search', updateCheck);
                        search.on('keypress', updateCheck);
                    }
                    $.all('#cms-le-float-palette-content .le-search-results [draggable]').each(function (el) {
                        el.on('dragstart', dragStart);
                    });
                    break;
                case 401:
                    promptLogin();
                    break;
                default:
                    displayAlert('Error executing search (' + this.status + ')');
                    break;
            }
            $.one('#cms-le-float-palette').removeClass('loading');
        });
    }

    function setupEmptyBox(item) {
        CMS_LE_API.getComponent(item, ['permissions', 'children'], function (c) {
            if (isEmptyBox(item, c)) {
                var name;
                if (c.name) name = c.name + ' (' + c.component_name + ')';
                else name = c.component_name;
                if(DEBUG) console.log("setupEmptyBox(" + c.key +") -> " + name);
                item.setAttribute(DATA_CMS_PE_EMPTY, name);
            } else {
                if(DEBUG) console.log("setupEmptyBox(" + c.key +") -> REMOVING");
                item.removeAttribute(DATA_CMS_PE_EMPTY);
            }
        });
    }

    function isEmptyBox(el, c) {
      var innerText = el.textContent || el.innerText || "";
        var empty = (innerText.replace(/\s*/, '') == '' && c && (c.supports_delegation || c.key.indexOf('bx#') == 0));
        if(DEBUG) console.log("isEmptyBox(" + el.id + ", " + c.key +") = " + empty);
        if (empty && el.children.length > 0) {
            if(DEBUG) console.log("isEmptyBox(" + el.id + ", " + c.key +") checking children...");
            empty = newList(el.children).every(function (child) {
                var tag = child.nodeName.toLowerCase();
                if (child.getAttribute(DATA_CMS_PE)
                    || tag == 'img'
                    || tag == 'audio'
                    || tag == 'video'
                    || tag == 'input'
                    || tag == 'data'
                    || tag == 'keygen'
                    || tag == 'hr'
                    || tag == 'meta'
                    || tag == 'embed'
                    ) {
                    return false;
                }
                return true;
            });
        }
        return empty;
    }

    function nodeHasCmsComponent(node) {
        return node.nodeType == 1 && node.querySelector('[' + DATA_CMS_PE + ']');
    }

    function convertAccessKey2Shortcut() {
        // Convert our access keys to javascript shortcuts for easier invocation.
        newList(d.querySelectorAll('.cms_le_ [accesskey]')).forEach(function (item) {
            var ak = item.getAttribute('accesskey');
            if (ak) {
                item.removeAttribute('accesskey');
                item.setAttribute('data-accesskey', ak);
            }
        });
    }

    function observeMutations() {
        function loadComponents(el) {
            if (el.nodeType != 1) return;
            newList(el.querySelectorAll('[' + DATA_CMS_PE + ']')).forEach(function (item) {
                // refresh the component info - setupEmptyBox does this as a side effect
                setupEmptyBox(item);
            });
            if (el.getAttribute(DATA_CMS_PE))CMS_LE_API.getComponent(el);
        }

        var mo = window.MutationObserver || window.WebKitMutationObserver;
        if (mo) {
            mo = new mo(function (mutations) {
                var nodes = [];
                mutations.forEach(function (item) {
                    if (item.addedNodes) nodes = nodes.concat(newList(item.addedNodes));
                    if (item.removedNodes) {
                      newList(item.removedNodes).forEach(function(el){
                        if(el.parentElement)
                          nodes.push(el.parentElement);
                      });
                    }
                });
                nodes = nodes.filter(function (item) {
                    return nodeHasCmsComponent(item);
                });
                setTimeout(function(){ // Timeout for firefox
                  if (nodes.length > 0) {
                      if (DEBUG) console.groupCollapsed('MutationObserver');
                      try {
                          nodes.forEach(loadComponents);
                      } finally {
                          if (DEBUG) console.groupEnd();
                      }
                  }
                  convertAccessKey2Shortcut();
                }, 50);
            });
            mo.observe(document, { childList: true, subtree: true });
        } // NOTE : IE10 does not support mutation events
    }

    return {
        bind: function (cb) {
            return function () {
                cb.call(CMS_LE_API);
            };
        },
        closeFloatingPalette: function () {
            $.one('#cms-le-float-palette').hide();
            $.one('#cms-le-dnd-component')._node.classList.remove('active');
            setTimeout(function () {
                setFloatingPaletteContent('');
            }, 20);
        },
        toggleDnDComponentTool: function () {
            var node = $.one('#cms-le-float-palette'), btn = $.one('#cms-le-dnd-component')._node;
            if (btn.classList.toggle('active')) {
                openFloatingPalette('Drag Component Onto Page', 'Loading...');
                doComponentSearch(Prop.COMPONENT_SEARCH.get());
            } else {
                CMS_LE_API.closeFloatingPalette();
            }
        },
        /** Test if component is dynamic on this page. Requires that the component information has already been loaded with the references option.
         * If it hasn't, then this returns false.
         * @param {object} c the component information.
         * @return {boolean} true or false.
         */
        isDynamicComponent: function (c) {
            if (c.key.indexOf('cb#') != 0 || c.options.indexOf('references') == -1) {
                return false;
            }
            if ((c.references || []).length == 0) {
                return true;
            }
            for (var i = 0, el; el = c.references[i]; i++) {
                if (el[0] != this.root) return false;
            }
            return true;
        },
        closeOverlay: function () {
            $.one('#cms-le-overlay').hide();
            window.focus();
        },
        quitLiveEdit: function quitLiveEdit() {
            // TODO add check for pending actions and prompt
            rewriteLinksBookmarklet(false);
            var newLocation = location.href.replace(new RegExp('[?&]' + PARAM_CMS_INTEGRATION + '=[0-9]', 'g'), '');
            var disableURL = CMS_LE_API.page ? newLocation : (location.protocol + "//" + location.hostname);
            xhr({method: 'POST', url: disableURL, headers: {"Cache-Control": "max-age=0", "X-CMS-Integration": LiveEditMode.DISABLED}}, function () {
                location = newLocation;
            });
        },
        init: function () {
            isCMSHosted(LiveEditMode.BOOKMARKLET, function (response) {
                if (response.status == 200) {
                    if ($.one('[' + DATA_CMS_PE + ']') == null && location.href.indexOf(PARAM_CMS_INTEGRATION) == -1) {
                        location = (location.href + queryStart(location.href) + PARAM_CMS_INTEGRATION + '=' + LiveEditMode.BOOKMARKLET)
                    } else {
                        for (var k in CMS_LE)if (CMS_LE.hasOwnProperty(k))CMS_LE_API[k] = CMS_LE[k];
                        $.ready(function () {
                            createPrimaryToolbar();
                            createComponentToolbar();
                            createOverlay();
                            createDropLocations();
                            createFloatingPalette();
                            doInit();
                        });
                        var latch = new CountDownCallback(startApp, 2);

                        function doInit() {
                            xhr({url: (CMS_LE.api_url + '/page?children=true&permissions=true'), withCredentials: true}, function () {
                                switch (this.status) {
                                    case 200:
                                    case 203:
                                        CMS_LE_API.page = JSON.parse(this.responseText);
                                        preloadImages();
                                        w.addEventListener('resize', resizeCallback);
                                        break;
                                    case 404:
                                        latch.queue(function () {
                                            $.one('#cms-le-ptb .le-component').setHtml(LiveEditTemplate('tmpl-ptb-component-info', {}));
                                        });
                                        break;
                                    case 401:
                                        latch.queue(promptLogin);
                                        break;
                                    case 403:
                                        latch.queue(promptForbidden);
                                        break;
                                    default:
                                        // If I can't load the editor, I'll assume loading templates might be a problem
                                        overlay('<p>I\'m sorry, I was unable to load the editor for this page. Code #' + this.status + '.</p><button type="button" onclick="CMS_LE_API.quitLiveEdit();">Quit</button>');
                                        break;
                                }
                                latch.countDown();
                            });
                            // NOTE: templates must always be loaded - cannot be permission protected
                            xhr({url: CMS_LE.tmpl_url, withCredentials: true}, function () {
                                switch (this.status) {
                                    case 200:
                                    case 203:
                                        $.node.create('<div style="display:none" id="cms-le-templates" class="cms_le_"></div>').appendTo('body').setHtml(this.responseText);
                                        latch.countDown();
                                        break;
                                    default:
                                        $.ready(function () {
                                            overlay('<p>I\'m sorry. I was unable to load the template files.</p><button type="button" onclick="CMS_LE_API.quitLiveEdit();">Quit</button>');
                                        });
                                        break;
                                }
                            });
                        }
                    }
                    w.addEventListener('message', CMS_LE_API.receiveMessage);
                } else {
                    displayAlert(response.statusMessage || 'Unable to determine hosting information');
                }
            });
        },
        /** Invalidate the specified component.
         * @param {string} key the component key.
         */
        invalidateComponent: function (key) {
            if (!key) return;
            var c = this.page.components[key];
            if (c) {
                c.timestamp = new Date(0).toString();
                if (this.activeKey == key) {
                    // Refresh
                    this.getComponent(key, null, function (c) {
                        CMS_LE_API.updateComponentModel(c);
                    });
                }
            }
        },
        /** Get the path of the active element.
         * @return {string|null}  the path as a string useful for making API calls to the server.
         */
        getActivePath: function () {
            if (!this.activeElement) return null;
            return getComponentPath(this.activeElement).replace(/#/g, '').replace(/%2C/g, ',');
        },
        /** Get the component information.
         * @param {array} opts optional options.
         * @param {string} keyp the component key or element.
         * @param {object|null} cb optional callback. This is called with the result of
         * looking up the component by the specified key. This callback argument will be a component or null.
         * @return {string|null} the component that is currently in the cache. If a callback is specified,
         * the server may be queried to get newer or more complete information depending on
         * options and when the cached component was last retrieved. If the component
         * key doesn't exist on the server then null is returned.
         */
        getComponent: function (keyp, opts, cb) {
            var key = getKeyFromComponent(keyp);
            // If we can determine a path, send that to the server for a more accurate response
            opts = opts || DEFAULT_COMPONENT_OPTIONS.slice(0);
            var c = this.page.components[key], valid = isFresh(c) && hasOpts(c, opts),
                path = this.activeKey == key ? getComponentPath(this.activeElement) : (!!keyp.nodeType ? getComponentPath(findComponentElement(keyp)) : key),
                neverFresh = (c && getCmsComponents(c.key).length > 1)
                ;
            if (DEBUG) console.groupCollapsed(':getComponent(%s, %s, %s)', key, '[' + opts + ']', (cb ? cb.name || 'anonymous' : null));
            var latch = new CountDownCallback(function () {
                if (DEBUG) console.groupEnd();
            }, 1);
            if (cb || !c) {
                if (valid) {
                    if (cb)cb.call(CMS_LE_API, c);
                    latch.countDown();
                } else {
                    // Ask server for an updated version
                    var path = [this.page.site.id, 'pe', encodeURIComponent(path.replace(/#/g, '')).replace(/%2C/g, ',')].join('/'),
                        params = (c ? opts.concat(c.options) : opts).map(function (el) {
                            return el + '=true';
                        }).unique().join('&');
                    xhr({url: (this.api_url + '/' + path + '?' + params), withCredentials: true}, function () {
                        if (DEBUG) console.log('Checking for updates');
                        try {
                            switch (this.status) {
                                case 200:
                                case 203:
                                    c = JSON.parse(this.responseText);
                                    if (JSON.stringify(c) != JSON.stringify(CMS_LE_API.page.components[key])) {
                                        /* dont compare responseText. */
                                        if (neverFresh) c.timestamp = null;
                                        if (DEBUG) console.log('Component info changed');
                                        CMS_LE_API.page.components[key] = c;
                                        if (cb)cb.call(CMS_LE_API, c);
                                    } else {
                                        if (DEBUG) console.log('Component info not changed');
                                    }
                                    break;
                                case 401:
                                    promptLogin();
                                    break;
                                default:
                                    promptUnableToLoad({name: 'component information'});
                                    if (cb)cb.call(CMS_LE_API, null);
                                    break;
                            }
                        } finally {
                            latch.countDown();
                        }
                    });
                }
            } else {
                latch.countDown();
            }
            return c;
        },
        /** Active Key. */
        activeKey: null,
        /** Active TS. */
        activeTimestamp: new Date().getTime(),
        /** Active Locale. */
        activeLocale: 'en',
        /** Active Locale. */
        activeElement: null,
        _activateInternal: function (el) {
            el = findComponentElement(el);
            var oldEl = this.activeElement, localeEl = searchPathForAttr(el, 'lang') || d.documentElement;
            if (oldEl && oldEl.nodeType == 1) $.all('.le-selected').removeClass('le-selected');
            this.activeElement = el;
            this.activeKey = getKeyFromComponent(el);
            this.activeLocale = localeEl.getAttribute('lang') || this.page.site.locales[0];
        },
        /** Activate an element in the document.
         * @param {string} el the element or the component key.
         * @param {array|null} opts optional list of options.
         */
        activate: function (el, opts) {
            if (!el) return;
            this._activateInternal(el);
            if (DEBUG) console.groupCollapsed(':activate(%s)', this.activeKey);
            var me = this;
            this.updateComponentModel(this.getComponent(this.activeKey, opts || ['permissions', 'workflow', 'advisories', 'references'],
                function updateComponentModelCB(c) {
                    me.updateComponentModel(c);
                    if (DEBUG) console.groupEnd();
                }));
        },
        navParent: function () {
            if (DEBUG) console.group(':navParent()');
            try {
                var me = CMS_LE_API;
                me.activate(me.activeElement.parentElement);
            } finally {
                if (DEBUG) console.groupEnd();
            }
        },
        navDescendent: function () {
            if (DEBUG) console.group(':navDescendent()');
            try {
                var me = CMS_LE_API;
                me.activate(me.activeElement.querySelector('[' + DATA_CMS_PE + ']'));
            } finally {
                if (DEBUG) console.groupEnd();
            }
        },
        navDFS: function (offset) {
            if (DEBUG) console.group(':navDFS(%s)', offset);
            try {
                var me = CMS_LE_API;
                var all = [d].concat(getCmsComponents()),
                    i = all.indexOf(me.activeElement);
                if (i == -1) i = 0;
                i = (i + offset);
                if (i < 0)i = all.length + i;
                if (i >= all.length) me.activate(me.page.rendered);
                else me.activate(all[i]);
            } finally {
                if (DEBUG) console.groupEnd();
            }
        },
        navNext: function () {
            CMS_LE_API.navDFS(1);
        },
        navPrevious: function () {
            CMS_LE_API.navDFS(-1);
        },
        positionComponentToolbar: function () {
            if (!this.activeElement || this.activeElement.nodeType != 1) return;
            var ctb, region,
                el = this.activeElement, localeEl = searchPathForAttr(el, 'lang') || d.documentElement;
            this.activeLocale = localeEl.getAttribute('lang') || this.page.site.locales[0];
            if (el && el.nodeType == 1) {
                region = $.one(el).region(), ctb = $.one('#cms-le-ctb');
                if (isNotDisplayed(el)) { // note: we check not-displayed instead of offsetWidth and offsetHeight for a reason - see below.
                    region = getVisibleRegionFromAncestor(el, region);
                } else if (region.height == 0 || region.width == 0) {
                    // Find child with size
                    var check, children = newList(el.children);
                    while ((check = children.shift())) {
                        if (check.offsetHeight > 0 && check.offsetWidth > 0) {
                            el = check;
                            // Last Region Encountered Is First in DFS - highlight all visible regions
                            region = $.one(el).region();
                        } else {
                            newList(check.children).forEach(function (item) {
                                children.push(item);
                            });
                        }
                    }
                }
                ctb.setStyles({top: region.top, left: region.left});
            }
        },
        /** Update the current model for the specified component if the specified component matches the activeKey.
         * @param {object|null} c the component.
         */
        updateComponentModel: function (c) {
            if (!c || c.key != this.activeKey) return;
            var ts = new Date(c.timetamp).getTime();
            if (this.activeTimestamp <= ts) return;
            if (DEBUG) console.group(':updateComponentModel(%s)', c.key, c);
            try {
                this.activeTimestamp = ts;
                var ctb, region, lec = $.one('#cms-le-ptb .le-component'), leca = $.one('#cms-le-ptb .le-component-actions'),
                    data = cloneObject(c), visible = true,
                    el = this.activeElement, localeEl = searchPathForAttr(el, 'lang') || d.documentElement;
                this.activeLocale = localeEl.getAttribute('lang') || this.page.site.locales[0];
                if (el && el.nodeType == 1) {
                    region = $.one(el).region(), ctb = $.one('#cms-le-ctb');
                    if (region.height > 0 && region.width > 0)
                        $.one(el).addClass('le-selected');
                    if (isNotDisplayed(el)) { // note: we check not-displayed instead of offsetWidth and offsetHeight for a reason - see below.
                        visible = false;
                        data.invisible = true;
                        region = getVisibleRegionFromAncestor(el, region);
                        if (region.height > 0 && region.width > 0)
                            $.one(el).addClass('le-selected');
                    } else if (region.height == 0 || region.width == 0) {
                        // Find child with size
                        var check, children = newList(el.children);
                        while ((check = children.shift())) {
                            if (check.offsetHeight > 0 && check.offsetWidth > 0) {
                                el = check;
                                // Last Region Encountered Is First in DFS - highlight all visible regions
                                region = $.one(el).addClass('le-selected').region();
                            } else {
                                newList(check.children).forEach(function (item) {
                                    children.push(item);
                                });
                            }
                        }
                    }
                    var cl, cll = {
                        'le-shared': ((c.references || []).length > 1),
                        'le-invisible': !visible,
                        'le-cat-page': c.content_area_type == 'page',
                        'le-cat-page-template': c.content_area_type == 'page_template',
                        'le-box-locked': !!c.box_locked
                    };
                    for (cl in cll) {
                        if (cll[cl]) {
                            ctb.addClass(cl);
                            lec.addClass(cl);
                            leca.addClass(cl);
                        } else {
                            ctb.removeClass(cl);
                            lec.removeClass(cl);
                            leca.removeClass(cl);
                        }
                    }
                    ctb.purge(null, null, true);
                    ctb.setHtml(LiveEditTemplate('tmpl-ctb', data)).show();
                    if (region.top > 50) ctb.addClass('outset');
                    else ctb.removeClass('outset');
                    this.registerActionListeners(ctb);
                    ctb.setStyles({top: region.top, left: region.left});
                    el.scrollForLEActivation(Prop.PRIMARY_TOOLBAR_LOCATION.get() == 'top' ? -100 : -50);
                } else {
                    $.one('#cms-le-ctb').hide();
                    ['le-shared', 'le-invisible', 'le-cat-page', 'le-cat-page-template', 'le-box-locked'].forEach(function (cl) {
                        lec.removeClass(cl);
                        leca.removeClass(cl);
                    });
                }
                data.activeLocale = this.activeLocale;
                lec.setHtml(LiveEditTemplate('tmpl-ptb-component-info', data));
                leca.purge(null, null, true);
                leca.setHtml(LiveEditTemplate('tmpl-ptb-component-actions', data));
                this.registerActionListeners(leca);
            } finally {
                if (DEBUG) console.groupEnd();
            }
        },
        /** Register action listeners for the common component actions. The element should have children with the proper class names.
         * @param {object} el the element.
         */
        registerActionListeners: function (el) {
            var n, k1, k2, a = {
                '.le-edit': {'click': this.editComponent},
                '.le-detach': {'click': deleteComponent},
                '.le-delete': {'click': deleteComponent},
                '.le-move': function (node) {
                    addElementLookup(this.activeElement, node._node);
                    node.on('dragstart', dragStart);
                }
            };
            for (k1 in a) {
                n = el.one(k1);
                if (n && n._node) {
                    if (typeof a[k1] == 'function')
                        a[k1].call(this, n);
                    else {
                        for (k2 in a[k1]) n.on(k2, a[k1][k2]);
                    }
                }
            }
        },
        /** Post a message to the active backend iframe.
         * @param {object} d the data.
         */
        postMessage: function (d) {
            var me = CMS_LE_API, target = "https://" + me.backend_host, server = getServerFrame();
            server.postMessage(d, target);
        },
        /** Receive a message from the active backend iframe.
         * @param {object} e the event.
         */
        receiveMessage: function (e) {
            var me = CMS_LE_API, acceptOrigin = "https://" + me.backend_host, de = d.documentElement;
            if (acceptOrigin != e.origin) return;
            var action = e.data.action, data = e.data.data;
            switch (action) {
                case 'sizeIframe':
                    //if(DEBUG) console.log(e.data);
                    var iframe = $.one('#cms-le-overlay-content iframe')._node;
                    if (iframe) {
                        if (e.data.oncetype) {
                            if (iframe[e.data.oncetype] === true) return;
                            else iframe[e.data.oncetype] = true;
                        }
                        var cw, cy, olh = .9, olm = 40, /*See table.cms-le-overlay-layout margin and height*/
                            vp = {width: Math.round((w.innerWidth | de.innerWidth) * olh), height: Math.round((w.innerHeight | de.innerHeight) * olh)},
                            mw = Math.min(vp.width, data.width), mh = Math.min(vp.height - olm, data.height);
                        cw = (iframe.width / mw);
                        cy = (iframe.height / mh);
                        // Prefer expansion to shrinking
                        if (cw > 1.4 || cy > 1.4 || cw < .9 || cy < .9) {
                            iframe.width = mw;
                            iframe.height = mh + 30;
                        }
                    }
                    break;
                case 'editorClosed':
                    me.closeOverlay();
                    break;
                case 'editorSaved':
                    me.refreshContent();
                    break;
                case 'log':
                    console.log(data);
                    break;
            }
        },
        /** Edit the active component
         */
        editComponent: function () {
            var me = CMS_LE_API;
            if (!me.activeElement) return;
            me.closeOverlay();
            var url = me.editor_url + '/' + me.getActivePath() + '/' + encodeURIComponent(me.activeLocale) + '/edit';
            overlay('<iframe class="component-editor" src="' + url + '" width="600" height="200"></iframe>');
            // Check if we are still logged in
            loginCheck();
        },
        /** Refresh the content on the page for specified element or the active component.
         * @param {object|null} element optional element.
         * @param {object|null} cb optional callback.
         */
        refreshContent: function (element, cb) {
            if (DEBUG) console.group(':refreshContent(%s, %s)', (element ? element.lookupid || element.id : this.activeKey), (cb ? cb.name || 'anonymous' : null));
            // Initial implementation is direct-update only - needs augmented with general-update impl for components that are not optin for direct-update
            var key, pc, p, origPath, origKey;
            if (element) {
                p = findComponentElement(element);
                pc = this.getComponent(p);
                key = pc.key;
            } else {
                key = this.activeKey;
                pc = this.getComponent(key);
                p = this.activeElement;
            }
            origPath = getComponentPath(p);
            origKey = key;
            this.invalidateComponent(key);
            if ((this.getComponent(p.parentNode) || {}).supports_delegation) {
                if (DEBUG) console.log('Component is a delegating component - refreshing parent');
                p = p.parentNode;
                pc = this.getComponent(p);
                if (!pc || pc.key == this.root) return;
                this._activateInternal(p);
                key = pc.key;
                this.invalidateComponent(key);
            }
            while (this.isDynamicComponent(pc)) {
                if (DEBUG) console.log('Component "%s" is a dynamic component - refreshing parent', (pc ? pc.key : null));
                if (!p.parentNode) {
                    location.reload(true);
                    return;
                }
                p = p.parentNode;
                pc = this.getComponent(p);
                if (!pc || pc.key == this.root) {
                    location.reload(true);
                    return;
                }
                this._activateInternal(p);
                key = pc.key;
                this.invalidateComponent(key);
            }

            var urlBase, ps = '', path, list = getCmsComponents(key), sid = PAT_JSESSIONID.test(location.pathname) ? PAT_JSESSIONID.exec(location.pathname)[1] : '';
            urlBase = location.protocol + '//' + location.hostname + '/partial' + location.pathname.replace(PAT_JSESSIONID, '');
            if (urlBase[urlBase.length - 1] != '/') ps = '/';
            ps += this.page_element_path_suffix;
            if (urlBase.indexOf(ps) != -1) {
                urlBase = urlBase.substring(0, urlBase.indexOf(ps));
            }
            var reActivate = function () {
                if (DEBUG) console.group(':reActivate');
                var api = CMS_LE_API;
                try {
                    if (cb)cb.call(this);
                    else {
                        // Nav back to origPath
                        var toActivate = getComponentFromPath(origPath.split(','));
                        if (toActivate) api.activate(toActivate);
                        else api.activate(document);
                    }
                    setupEmptyBoxes();
                } finally {
                    if (DEBUG) console.groupEnd(); // reActivate
                    if (DEBUG) console.groupEnd(); // refreshContent:
                }
            };
            var latch = new CountDownCallback(reActivate, list.length);
            list.forEach(function (el) {
                path = getComponentPath(el);
                xhr({url: (urlBase + ps + path.replace(/#/g, '') + sid + location.search)}, function () {
                    switch (this.status) {
                        case 200:
                        case 203:
                            var processed = LiveEditAJAXContent(this.responseText);
                            if(el.parentNode)
                              el.outerHTML = processed.html;
                            processed.addScripts();
                            break;
                        default:
                            if (DEBUG) console.error('Unable to fetch content for %s. Status = %s.', key, this.status);
                            break;
                    }
                    latch.countDown();
                });
            });
        }
    };
})(LiveEditNWT, window, document);
CMS_LE_API.init();

