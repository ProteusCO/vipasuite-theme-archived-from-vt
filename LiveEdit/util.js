// Modified for use in LiveEdit
//  * the global variable has been changed (local variables fixed too) 
//  * some additional utility functions were added
//  * Fixed many errors in NWT

!function(z,y){
/**
 * NWT primary entry point
 * @constructor
 */
function NWT() {

};

NWT.prototype = {

/**
 * Implements an interface on an object
 */
implement: function(implClass, modClass) {

	var impls = {
		DelayableQueue : [

			/**
			 * Returns a queueable interface to the original object
			 * This allows us to insert delays between chainable method calls using the .wait() method
			 * Currently this is only implemented for the node class, but it should be possible to use this with any object.
			 */
			'wait', function () {

				/**
				 * Queueable object which implements methods from another interface
				 * @param object Context for the callback
				 */
				function QueueableObject(context) {
					this.queue = [];
					this.context = context;
					this.inWork = false;
				}
				
				QueueableObject.prototype = {
					_add: function(func, args) {

						var self = this;

						self.queue.push({type: 'chain', func: func, args: args});
						if (!self.inWork) {
							return self._process();
						}
					},

					/**
					 * Process the queue
					 * Shifts an item off the queue and waits for it to finish
					 */
					_process: function() {

						var self = this, item;

						self.inWork = true;
						
						if (!self.queue.length) {
							return;
						}
						
						item = self.queue.shift();

						if (item.type == 'wait') {
							setTimeout(function(){
								self._process();
							}, item.duration*1000);
						} else {
							self.context = item.func.apply(self.context, item.args);
							self._process();
						}
						return self;
					},

					/**
					 * Updates the current delay timer
					 */
					wait: function(duration) {
						this.queue.push({type: 'wait', duration: duration});
						return this;
					}
				};
				
				return function (duration) {

					var self = this,
						mockObj = new QueueableObject(self);

					/**
					 * Returns an executable function
					 * uses setTimeout and the total queueTimer
					 */
					getQueuedFunction = function(func) {
						return function() {
							mockObj._add(func, arguments);
							return mockObj;
						}
					};

					/**
					 * Wrap all class functions
					 * We can unwrap at the end if the current wait is 0
					 */
					for( var i in self ) {
						if (typeof self[i] != 'function' || i == 'wait' ) { continue; }
						mockObj[i] = getQueuedFunction(self[i]);
					}

					mockObj.wait(duration);
					
					return mockObj;
				}
			}
		]
	};

	modClass[impls[implClass][0]] = impls[implClass][1]();
},

/**
 * Declares a class on the n.* namespace
 * This allows us to play with the prototype and do other things later
 */
declare: function(name, clazz) {
	localnwt._lib = localnwt._lib || {}
	localnwt._lib[name] = clazz
},

/**
 * Augments a class namespaced on n._lib
 */
augment: function(name, fnName, fn) {
	localnwt._lib[name].prototype[fnName] = fn; 
},

viewport: function(){
    return  {width:(z.innerWidth|y.documentElement.innerWidth),height:(z.innerHeight|y.documentElement.innerHeight)};
},

/**
 * Generates a unique id
 */
uuid: function() {
	var counter = 0;

	return function(){
		counter++;
		return counter.toString(36)
	}
}()
};

// localnwt variable used for minification.
// We should reference localnwt wherever needed inside of our source scripts.
var localnwt = new NWT()

// Window namespaces
//z.nwt = z.n = localnwt
z.LiveEditNWT = localnwt

/**
 * Wraps an XHR response object 
 * This allows us to parse on demand with o.obj()
 * The toString method will also spit out the flat response
 * @param object XHR request
 */
function NWTIOResponse (request) {
	this.request = request;
	try {
		this.obj = JSON.parse(request.responseText);
	} catch(e) {}
}

NWTIOResponse.prototype = {
/**
 * Returns the non-parse responseText
 */
toString: function () {
	return this.request.responseText;
}
};


/**
 * Provides ajax communication methods
 * The folllowing methods are chainable
 * success - success handler
 * failure - failure handler
 * serialize - serialize a form, selector, array, or object to send
 * @constructor
 */
function NWTIO(args) {
	this.req = new XMLHttpRequest();
	this.config = {};
	this.url = args[0];

	// Data to send as
	this.ioData = '';

	var chainableSetters = ['success', 'failure', 'serialize'],
		i,
		setter,
		mythis = this,

		// Returns the setter function
		getSetter = function (setter) {
			return function (value) {
				mythis.config[setter] = value;
				return this;
			}
		};

	for (i = 0, setter; setter = chainableSetters[i]; i++) {
		this[setter] = getSetter(setter);
	}
}

NWTIO.prototype = {
/**
 * Runs the IO call
 * @param string Type of call
 */
_run: function() {
	var mythis = this;
	this.req.onreadystatechange = function() {		
		var callback,
			state = mythis.req.readyState;

		if (state == 4 && mythis.req.status == 200) {
			callback = 'success';
		} else if (state == 4) {
			callback = 'failure';
		}

		if (callback && mythis.config[callback]) {
			var response = new NWTIOResponse(mythis.req);
			mythis.config[callback](response);
		}
	};

	this.req.send(this.ioData ? this.ioData : null);
	return this;
},


/**
 * Runs IO POST
 * We also use post for PUT or DELETE requests
 */
post: function(data, method) {

	var urlencodedForm = true;
	
	if (typeof data == 'string') {
		this.ioData = data;
	} else if (typeof data == 'object' && data._node) {

		if (data.getAttribute('enctype')) {
			urlencodedForm = false;
		}
		
		this.ioData = new FormData(data._node);
	}

	var req = this.req,
		method = method || 'POST';

	req.open(method, this.url);

	//Send the proper header information along with the request
	// Send as form encoded if we do not have a file field
	if (urlencodedForm) {
		req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	}

	return this._run();
},


/**
 * Runs IO GET
 * @param string We update the URL if we receive data to GET here
 */
get: function(data) {

	// Strip out the old query string and append the new one
	if (data) {
		this.url = this.url.split('?', 1)[0] + '?' + data;
	}

	this.req.open('GET', this.url);
	return this._run();
},


/**
 * Runs IO PUT
 */
put: function(data) {
	return this.post('?' + data, 'PUT');
},


/**
 * Runs IO DELETE
 */
'delete': function(data) {
	return this.post('?' + data, 'DELETE');	
},


/**
 * Aborts this request
 */
abort: function() {
	this.req.abort();
	return this;
}
};


localnwt.io = function() {
	return new NWTIO(arguments);
};
var fxObj = {
	// <id> : { ..obj mapping.. }
}

/**
 * Individually wrapped NWTNode
 * @constructor
 */
function NWTNodeInstance(node) {
	localnwt.implement('DelayableQueue', this);
	this._node = node;
}
localnwt.declare('Node', NWTNodeInstance);

NWTNodeInstance.prototype = {

/**
 * Gets the region of a node (top, left, bottom, right)
 */
region: function() {

	var region = {
		width: this.get('offsetWidth'),
		height: this.get('offsetHeight')
	},

	box = this._node.getBoundingClientRect(),

	doc = y,
	docElem = doc.documentElement,
	body = doc.body,
	win = z,

	clientTop  = docElem.clientTop  || body.clientTop  || 0,
	clientLeft = docElem.clientLeft || body.clientLeft || 0,
	scrollTop  = win.pageYOffset || docElem.scrollTop  || body.scrollTop,
	scrollLeft = win.pageXOffset || docElem.scrollLeft || body.scrollLeft;

	region.top  = box.top  + scrollTop  - clientTop,
	region.left = box.left + scrollLeft - clientLeft;

	region.bottom = region.top + region.height;
	region.right = region.left + region.width;

	return region;
},


/**
 * Checks if a given node intersects another
 * @param object Node to check against
 */
intersects: function(other) {
	var me = this.region(),
		you = other.region();

	return !(
			me.left > you.right ||
			me.right < you.left ||
			me.top > you.bottom ||
			me.bottom < you.top ||

			you.left > me.right ||
			you.right < me.left ||
			you.top > me.bottom ||
			you.bottom < me.top 
	);
},


/**
 * Returns the ancestor that matches the css selector
 * @param string CSS Selector
 */
ancestor: function(selector) {

	var allMatches = localnwt.all(selector),
		testNode = this._node,
		ancestor = null,
		maxDepth = 0;

	if( allMatches.size() == 0 ) {
		return null;
	}

	while( true ) {

		// Iterate through all matches for each parent, and exit as soon as we have a match
		// Pretty bad performance, but super small. TODO: Omtimize
		allMatches.each(function (el) {
			if (el._node == testNode) {
				ancestor = el;
			}
		});

		var parentNode = testNode.parentNode;

		if( ancestor || !parentNode) { break; }
		testNode = parentNode;
	}

	if( ancestor ) {
		return ancestor;
	} else {
		return null;
	}
},

parent: function() {
	var parent = this._node.parentNode ? new NWTNodeInstance(this._node.parentNode) : null;
	return parent;
},

/**
 * Returns true if the class exists on the node, false if not
 */
hasClass: function(className) {
	var regex = new RegExp('(^|\\s+)' + className + '(\\s+|$)')
    return regex.test(this._node.className)
},


/**
 * Adds a class to the node
 */
addClass: function(className) {
	if( !this.hasClass(className)  ) {
		this._node.className = this._node.className +  ' ' + className;
	}
	return this;
},


/**
 * Removes a class from the node.
 */
removeClass: function(className) {
	return this.swapClass(className, '');
},


/**
 * Replaces a class on a node
 * @param string oldClass Old class name
 * @param string newClass New class name
 */
swapClass: function(oldClass, newClass) {
	var el = this._node;
	el.className = (el.className || '').replace(RegExp("(^|\\s+)" + oldClass.trim() + "(\\s+|$)",'g'), newClass + ' ').trim();
	return this;
},


/**
 * Gets a data attribute from the node
 * Pass just whatever comes after data-
 * If the attribute were data-user-id,
 * you should pass 'user-id' to this function
 * @param string Data attribute to get
 */
data: function(property) {
	return this._node.getAttribute('data-' + property);
},


/**
 * Sets a data attribute from the node
 * @param string Data attribute to get
 * @param mixed Value to set
 */
setData: function(property, val) {
	return this._node.setAttribute('data-' + property, val);
},


/**
 * Gets a property from the node object
 * @param string Attribute to get
 */
get: function(property) {

	if( property === 'parentNode' ) {
		var node = this._node[property];
		if( !node ) { return null; }
		return new NWTNodeInstance(node);
	}

	return this._node[property];
},


/**
 * Sets an attribute on the node
 * @param string Attribute to set
 * @param string Value to set
 */
set: function(property, value) {
	this._node[property] = value;
	return this;
},


/**
 * Gets an attribute from the DOM node
 * @param string Attribute to get
 */
getAttribute: function(property) {
	return this._node.getAttribute(property);
},


/**
 * Pass-thru to node.hasAttribute
 * @param string Attribute to test for
 */
hasAttribute: function(property) {
	return this._node.hasAttribute(property);
},


/**
 * Sets an attribute on the DOM node
 * @param string Attribute to set
 */
setAttribute: function(property, value) {
	this._node.setAttribute(property, value);
	return this;
},
isEventSupported: function (eventName) {
    var el = y.createElement(this._node.nodeName);
    eventName = 'on' + eventName;
    var isSupported = (eventName in el);
    if (!isSupported) {
      el.setAttribute(eventName, 'return;');
      isSupported = typeof el[eventName] == 'function';
    }
    el = null;
    return isSupported;
},

_jsStyleLookupMap: {float: 'cssFloat'},
/**
 * Resolves JS Styles
 */
_jsStyle: function (name) {
	if (this._jsStyleLookupMap[name]) name = _jsStyleLookupMap[name];
	return name.replace(/-([0-9a-zA-Z_$])/g, function(match, p1, offset, str){return p1.toUpperCase()});
},


/**
 * Gets a style attribute set on the node
 * @param string Style attribute to get
 */
getStyle: function(property) {

	if( !this.getAttribute('style') ) {
		return '';
	}

	property = this._jsStyle(property);

	var matchedStyle = this._node.style[property];

	if( matchedStyle ) {
		return matchedStyle;
	} else {
		return null;
	}
},


/**
 * Removes a style attribute
 * @param string Style attribute to remove
 */
removeStyle: function(property) {
	return this.removeStyles(property);
},


/**
 * Removes an array of styles from a node
 * @param array Array of styles to remove
 */
removeStyles: function(props) {
	// Default properties to an array
	if (typeof props == 'string') {
		props = [props];
	}

	var i,
		propsLen = props.length;

	for (i = 0; i < propsLen; i += 1) {
		this._node.style[props[i]] = '';
	}
	return this;
},


/**
 * Sets a style attribute
 * @param string Style attribute to set
 * @param string Value to set
 */
setStyle: function(property, value) {
	var newStyle = {};
	newStyle[property] = value;
	return this.setStyles(newStyle);
},

show: function(property, value) {
	this.removeStyle('display');
	if(this.computeCss('display') == 'none') this.setStyle('display', 'block');
	return this;
},
hide: function(property, value) {
    return this.setStyle('display', 'none');
},
toggle: function(property, value) {
    return this.setStyle('display', (this.computeCss('display') == 'none') ? 'block' : 'none');
},

/**
 * Sets multiple styles
 * @param object Object map of styles to set
 */
setStyles: function(newStyles) {

	if( !this.getAttribute('style') ) {
		this.setAttribute('style', '');
	}

	var newStyle = '',

		// If the style matches one of the following, and we pass in an integer, default the unit
		// E.g., 10 becomes 10px
		defaultToUnit = {
			top: 'px',
			left: 'px',
			bottom: 'px',
			right: 'px',
			width: 'px',
			height: 'px',
			'max-width': 'px',
			'max-height': 'px',
			'min-width': 'px',
			'min-height': 'px'
		},

		i,

		eachStyleValue,

		// Keep track of an array of styles that we need to remove
		newStyleKeys = [];

	for( i in newStyles ) {
		var styleKey = this._jsStyle(i),
		eachStyleVal = newStyles[i];

		// Default the unit if necessary
		if (defaultToUnit[i] && !isNaN(eachStyleVal)) {
			eachStyleVal += defaultToUnit[i];
		}

		this._node.style[styleKey] = eachStyleVal;
	}

	return this;
},


/**
 * Serializes sub children of the current node into post data
 */
serialize: function() {

    var retVal = '',

    // Getting ALL elements inside of form element
    els = this._node.getElementsByTagName('*');

    // Looping through all elements inside of form and checking to see if they're "form elements"
    for( var i = 0, el; el = els[i]; i++ ) {
      if( !el.disabled && el.name && el.name.length > 0 ) {
        switch(el.tagName.toLowerCase()) {
          case 'input':
            switch( el.type ) {
              // Note we SKIP Buttons and Submits since there are no reasons as to why we 
              // should submit those anyway
              case 'checkbox':
              case 'radio':
                if( el.checked ) {
                  if( retVal.length > 0 ) {
                    retVal += '&';
                  }
                  retVal += el.name + '=' + encodeURIComponent(el.value);
                }
                break;
              case 'hidden':
              case 'password':
              case 'text':
                if( retVal.length > 0 ) {
                  retVal  += '&';
                }
                retVal += el.name + '=' + encodeURIComponent(el.value);
                break;
            }
            break;
          case 'select':
          case 'textarea':
            if( retVal.length > 0 ) {
              retVal  += '&';
            }
            retVal += el.name  + '=' + encodeURIComponent(el.value);
            break;
        }
      }
    }
    return retVal;
},


/**
 * Gets the html of the node
 */
getHtml: function() {
	return this._node.innerHTML;
},


/**
 * Sets the html of the node
 * @param string Html to set
 */
setHtml: function(html) {
	var self = this,
		processScripts,
		scriptTags;

	self._node.innerHTML = html;

	// Re-append any script tags introduced
	// We need to synchronously process them
	scriptTags = self.all('script');
	processScripts = function() {

		var rawEl = scriptTags.nodes.shift();

		if (!rawEl || !rawEl._node) {
			return;
		}

		// If there is script html, eval it instead of appending it
		var scriptSrc = rawEl.getAttribute('src');

		if (scriptSrc) {
			var newScript = y.createElement('script'),
				done;

			newScript.type = "text/javascript";
			newScript.src = scriptSrc;
	
			newScript.onload = newScript.onreadystatechange = function() {
				if ( !done && (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") ) {
					done = true;
					processScripts();
				}
			};

			self._node.appendChild(newScript);
		} else if (rawEl.get('text')){
			var evalRef = eval
			evalRef(rawEl.get('text'));
			processScripts();
		}
	}
	try {
		processScripts();
	}catch(e){}

	return this;
},


/**
 * Passthrough to node.get('val')
 */
val: function() {
	return this.get('value');
},

/**
 * Finds a node based on direction
 * @param string Native method to iterate nodes {previous | next}
 * @param string criteria CSS selector or Filtering function
 */
_find: function(method, criteria) {
	// Iterate on the raw node
	var node = this._node,

		// Method to iterate on
		siblingType = method + 'Sibling',

		// Filter to test the node
		filter,

		validItems;

	// CSS Selector case
	if (typeof criteria == "string") {
		validItems = localnwt.all(criteria);
		filter = function(rawNode) {
			var found = false;
			
			validItems.each(function(el){
				if (rawNode == el._node) {
					found = true;
				}
			});
			return found;
		}; 

	// Default the filter to return true
	} else if (!criteria) {
		filter = function(){ return true }
	} else {
		filter = function(rawEl) {
			return criteria(new NWTNodeInstance(rawEl));
		}
	}

	while(node) {
		node = node[siblingType];

		if (node && node.nodeType == 1 && filter(node)) {
			break;
		}	
	}

	return node ? new NWTNodeInstance(node) : null;
},

/**
 * Returns the next node
 */
next: function(filter) {
	return this._find('next', filter)
},


/**
 * Returns the previous node
 */
previous: function(filter) {
	return this._find('previous', filter)
},


/**
 * Returns a child node instance based on a selector
 * Implements querySelector
 * @param string css selector
 */
one: function(selector) {
	var node = this._node.querySelector(selector);
	return new NWTNodeInstance(node);
},


/**
 * Returns a child nodelist based on a selector
 * Implements querySelector
 * @param string CSS Selector
 */
all: function(selector) {
	var nodelist = this._node.querySelectorAll(selector);
	return new NWTNodeList(nodelist);
},


/**
 * Appends a node instance to this node
 */
append: function(node) {

	if( node instanceof NWTNodeInstance ) {
		node = node._node;
	}

	this._node.appendChild(node);
	return this;
},


/**
 * Appends the current node to another node
 * @param {string|object} Either a CSS selector, or node instance
 * @return object The node that we appended the current node to
 */
appendTo: function(node) {

	var newParent = ( node instanceof NWTNodeInstance ) ? node : localnwt.one(node);

	newParent.append(this);

	return this;
},


/**
 * Prepends a node to the beginning of the children of this node
 */
prepend: function(node) {

	if( node instanceof NWTNodeInstance ) {
		node = node._node;
	}

	var child = this.one('*');

	this._node.insertBefore(node, (child._node? child._node : null));
	
	return this;
},


/**
 * Inserts the current node into another node
 * @param {string|object} Either a CSS selector, or node instance
 * @param string Position to insert at. Defaults to 'before'
 * @return object The node that we inserted the current node into
 */
insertTo: function(node, position) {

	var newParent = ( node instanceof NWTNodeInstance ) ? node : localnwt.one(node);

	newParent.insert(this, position);

	return this;
},


/**
 * Removes a node instance from the dom
 */
remove: function() {
	this._node.parentNode.removeChild(this._node);
},


/**
 * Inserts a given node into this node at the proper position
 */
insert: function(node, position) {
	position = position || 'before';

	if( position == 'before'  ) {
		this._node.parentNode.insertBefore(node._node, this._node);
	} else if ( position == 'after' ) {
		this._node.parentNode.insertBefore(node._node, this.next() ? this.next()._node : null);
	}
},


/**
 * Simulates a click event on a node
 */
click: function() {
	var evt = y.createEvent("MouseEvents");
	evt.initMouseEvent("click", true, true, z,
		0, 0, 0, 0, 0, false, false, false, false, 0, null);

	return !this._node.dispatchEvent(evt);
},


// Begin NWT Event hooks
/**
 * Stub out the Node addEventListener/removeEventListener interfaces
 */
addEventListener: function(ev, fn) {
	return this._node.addEventListener(ev, fn, false);
},
removeEventListener: function(ev, fn) {
	return this._node.removeEventListener(ev, fn, false);
},


/**
 * Implement a node API to for event listeners
 * @see NWTEvent::on
 */
on: function(event, fn, selector, context) {	
	return localnwt.event.on(this, event, fn, selector,context);
},


/**
 * Implement a node API to for event listeners
 * @see NWTEvent::once
 */
once: function(event, fn, selector, context) {
	return localnwt.event.on(this, event, fn, selector, context, true);
},


/**
 * Implement a node API to for event listeners
 * @see NWTEvent::off
 */
off: function(event, fn) {
	return localnwt.event.off(this, event, fn);
},


/**
 * Purges a node of all listeners
 * @param string If passed, only purges this type of listener
 * @param function If passed, only purges the node of this listener
 * @param bool If true, purges children
 */
purge: function(type, callback, recurse) {
	var evt = localnwt.event;

	for (var i in evt._cached) {
		for(var j=0,numCbs=evt._cached[i].length; j < numCbs; j++) {
			var thisEvt = evt._cached[i][j];
			if (this._node == thisEvt.obj._node && (!type || type == thisEvt.type)) {
				evt.off(thisEvt.obj, thisEvt.type, thisEvt.raw)
			}
		}
	}

	if (recurse) {
		this.all('*').each(function(el){
			el.purge(type, callback, false);
		})
	}
},


/**
 * Fires an event on a node
 */
fire: function(event, callback) {	
	var args = Array.prototype.slice.call(arguments, 1);

	localnwt.event._eventData = args;

	var customEvt = y.createEvent("UIEvents");
	customEvt.initEvent(event, true, false);
	this._node.dispatchEvent(customEvt);
},

uuid: function() {
	if (!this._node.id) {
		this._node.id = 'n' + localnwt.uuid()
	}
	return this._node.id
},

/**
 * Returns the computed CSS for a given style(s)
 * @param String|Array List of styles to compute. If multiple styles are passed in, an object map is returned 
 */
computeCss: function(styles) {

	var computedStyles = y.defaultView.getComputedStyle(this._node),
		i,
		eachStyle,
		cssMap = {}

	// String case, just return the correct style
	if (typeof styles == "string") {
		return computedStyles[styles]
	}

	for (i=0; eachStyle = styles[i]; i++) {
		cssMap[eachStyle] = computedStyles[eachStyle]
	}
	return cssMap
},

/**
 * Implement a node API to animate
 * Takes an additional argument, pushState which signals whether or not to push this anim state onto fxStack
 * @see NWTAnimate::anin
 */
anim: function(styles, duration, easing, pushState) {
	if (!pushState) {

		var styleAttrs = [],
			defaultStyles,
			animHistory,
			i

		for (i in styles) {
			styleAttrs.push(i) 
		}
		defaultStyles = this.computeCss(styleAttrs)

		animHistory = {
			from: [defaultStyles, duration, easing, true /* This makes it so we do not push this again */],
			to: [styles, duration, easing]
		}
		
		fxObj[this.uuid()] = animHistory

		this.fire('anim:push', animHistory)
	}

	return localnwt.anim(this, styles, duration, easing);
},

/**
 * Implement a node API to reverse animations
 * This function will return true if we have a reversible animation to run allowing for syntax like:
 * this.popAnim() || this.anim()
 */
popAnim: function() {
	var id = this.uuid()
		, fx = fxObj[id]

	if (!fx) { return false }

	delete fxObj[id]

	this.fire('anim:pop', fx)
	
	return this.anim.apply(this, fx.from)
},

/**
 * Implement a node API for plugins
 * @see localnwt.plugin
 */
plug: function(plugin, config) {	
	config = config || {};
	config.node = this;
	return localnwt.plugin(plugin, config);
}
};


/**
 * NWTNode Class
 * Used for getting elements
 * @constructor
 */
function NWTNode() {
	
}
localnwt.declare('NodeMgr', NWTNode);

NWTNode.prototype = {
/**
 * Creates a node from markup
 * @param string Node markup
 */
create: function(markup) {

	var container = y.createElement('div');
	container.innerHTML = markup;

	return new NWTNodeInstance(container.childNodes[0]);
},


/**
 * Returns a NWTNodeInstance class
 * @constructor
 */
one: function(selector) {

	if( typeof selector == 'string' ) {
		var node = y.querySelectorAll(selector);

		if( node.length == 0 ) {
			return null;
		}

		return new NWTNodeInstance(node[0]);
	} else {
		return new NWTNodeInstance(selector);
	}
},


/**
 * Returns a NWTNodeList class
 * @constructor
 */
all: function(selector) {
	var nodelist = y.querySelectorAll(selector);
	return new NWTNodeList(nodelist);
}
};


localnwt.node = new NWTNode();
localnwt.one = localnwt.node.one;
/**
 * A node iterator
 * @constructor
 */
function NWTNodeList(nodes) {

	localnwt.implement('DelayableQueue', this);

	var wrappedNodes = [];

	for( var i = 0, node ; node = nodes[i] ; i++  ) {
		wrappedNodes.push(new NWTNodeInstance(node));
	}  
	this.nodes = wrappedNodes;

	var iteratedFunctions = [
		'anim', 'remove', 'addClass', 'removeClass', 'setStyle', 'setStyles', 'removeStyle', 'removeStyles', 'swapClass', 'plug'
	],

	mythis = this;

	function getIteratedCallback(method) {
		return function() {
			for( var j = 0 , node ; node = mythis.nodes[j] ; j++ ) {
				node[method].apply(node, arguments);
			}
			return mythis;
		};		
	};

	for( var i = 0, func; func = iteratedFunctions[i] ; i++ ) {
		this[func] = getIteratedCallback(func);
	}
}
localnwt.declare('NodeList', NWTNodeList);

NWTNodeList.prototype = {
/**
 * Node iterator
 * @param function Callback for each node
 */
each: function(callback) {
	for( var i = 0 , node ; node = this.nodes[i] ; i++ ) {
		callback(node);
	}
},


/**
 * Returns a node specified by an offset
 * @param integer Offset of the item
 */
item: function(offset) {
	return this.nodes[offset];
},


/**
 * Returns the size of the current nodelist
 * @return integer
 */
size: function() {
	return this.nodes.length;
}
};

localnwt.all = localnwt.node.all;
// Map of all registered plugsin to definitions
var pluginMap = {};


/**
 * Registers a plugin
 * @param object Definition of the plugin
 */
localnwt.register = function(definition) {
	pluginMap[definition.name] = definition;
};

/**
 * Instantiates a plugin
 */
localnwt.plugin = function(plugin) {
	var params = Array.prototype.slice.call(arguments),

		i,

		name = params.shift(),

		def = pluginMap[plugin];

	var tempHolder = function(){},
		myPluginClass;

	wrapPluginCall = function (method) {

		var _super;
		if (def.extend) {
			_super = function() {
				pluginMap[def.extend].methods[method].apply(this, arguments);
			};
		}

		return function() {
			this._super = _super;
			return def.methods[method].apply(this, arguments);
		}
	};

	// Wrap each method call so we can expose the super variable to it
	if (def.methods) {
		for (i in def.methods) {
			tempHolder.prototype[i] = wrapPluginCall(i);
		}
	}

	// Init plugins on dom ready
	localnwt.ready(function(){
		myPluginClass = new tempHolder();
		myPluginClass.init.apply(myPluginClass, params);
	});
};
/**
 * Animation utility
 * @constructor
 */
function NWTAnimate () {
	this.animClass = 'nwt-anim-on';
}

NWTAnimate.prototype = {

/**
 * Initializes CSS for transforms
 */
init: function(duration, easing) {
	
	var newStylesheet = localnwt.node.create('<style type="text/css"></style>');

	easing = easing || 'ease-in';
	duration = duration || 1;

	var trail = ' ' + duration + 's ' + easing,

		// Just support all browsers for now
		cssTransitionProperties = {
			'-webkit-transition': 'all' + trail,
			'-moz-transition': ' all' + trail,
			'-o-ransition': ' all' + trail,
			'ms-transition': ' all' + trail,
			'transition': ' all' + trail
		},

		newContent = '';

	for (i in cssTransitionProperties) {
		newContent += i + ': ' + cssTransitionProperties[i] + ';';
	}
	newStylesheet.setHtml('.' + this.animClass + '{' + newContent + '}');

	localnwt.one('head').append(newStylesheet);

	setTimeout(function(){
		newStylesheet.remove()
	}, 
	duration*1001)
},


/**
 * Method to animate a node
 * @param object NWTNode instance
 * @param object Object of styles to animate. E.g., {top: 10}
 * @param integer Duration in seconds to animate
 * @param string Easing type. One of: linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier(n,n,n,n);
 */
anim: function(node, styles, duration, easing) {

	animation.init(duration, easing);

	node.fire('anim:start', [styles, duration, easing])

	setTimeout(function(){
		node.fire('anim:done', [styles, duration, easing])
	}, duration*1000)

	// Need to be sure to implement the transition function first
	node.addClass(animation.animClass);
	
	node.setStyles(styles);


	return node;
}
};

var animation = new NWTAnimate();
localnwt.anim = animation.anim;
/**
 * NWTEventInstance Class
 * Event object wrapper
 * @param event Event object
 * @param object (Optional) attributes to populate the event object with
 * @constructor
 */
function NWTEventInstance (e, attrs) {
	this._e = e;
	this.target = new NWTNodeInstance(e.target);

	for (var i in attrs) {
		this[i] = attrs[i];
	}
}
localnwt.declare('Event', NWTEventInstance);


NWTEventInstance.prototype = {

/**
 * Returns the pageX coordinate
 */
pageX: function() {
	return this._e.pageX
},

/**
 * Returns the pageY coordinate
 */
pageY: function() {
	return this._e.pageY
},

/**
 * Interface to get the keycode
 */
code: function() {
	return this._e.keyCode;
},


/**
 * Stops the event totally
 * Calls NWTEventInstance noDefault and noBubble
 */
stop: function() {
	return this.noBubble().noDefault();
},


/**
 * Prevents the default action of the event
 */
noDefault: function() {
	this._e.preventDefault();
	return this;
},


/**
 * Stops the propagation of the event
 */
noBubble: function() {
	this._e.stopPropagation();
	return this;
}
};


/**
 * NWTEvent Class
 * Event class
 * @constructor
 */
function NWTEvent() {
	// Cached events which have been added
	// Cache the wrapped events so if the user calls node.off(...)
	// we can easily look up the function reference
	this._cached = {};

	// Cached event data for custom events
	this._eventData = [];
}


NWTEvent.prototype = {

/**
 * Adds a live listener to the page
 * This allows us to update page components,
 * and still have javascript function properly
 * @param string Attribute to check on
 * @param regex Pattern to match against the string
 * @param function callback if matched
 * @param string Type of listener to use, one of: click | mousemove | mouseout
 * @param integer Max depth to search. Defaults to 1 for a mouseover action
 */
live: function(attribute, pattern, callback, interaction, maxDepth) {
	var classPattern = new RegExp(pattern),

		interaction = interaction || 'click',

		maxSearch,

		dispatcher,

		body = localnwt.one('body');

	// Currently only search one level for a mouse listener for performance reasons
	if (interaction == 'click') {
		maxSearch = 100;
	} else {
		maxSearch = maxDepth || 1;
	}

	dispatcher = 
	function(e) {
		var originalTarget = e.target,
			target = originalTarget,

			// Did we find it?
			found = true,

			// Keep track of how many times we bubble up
			depthSearched = 0;

		while(target && target._node && target._node.parentNode) {

			if (target._node == localnwt.one('body')._node || depthSearched >= maxSearch) { break; }

			if (target.hasAttribute(attribute)) {

				var matches = target.getAttribute(attribute).match(pattern);

				if (matches) {
					callback(originalTarget, target, matches);
	
					// If we found a callback, we usually want to stop the event
					// Except for input elements (still want checkboxes to check and stuff)
					if( target.get('nodeName').toUpperCase() !== "INPUT") {
						e.stop();
					}

					break;
				}
			}

			depthSearched++;
			target = target.parent();
		};

		return;
	};


	var enableListener = function() {
		body.on(interaction, dispatcher);
	};
	enableListener();

	if (interaction !== 'click') {

		// Disable mouseover listeners on scroll
		var timer = false;

		localnwt.one(y).on('scroll', function() {

			body.off(interaction, dispatcher);

			if (timer) {
				clearTimeout(timer);
				timer = false;
			}
			timer = setTimeout(enableListener, 75);
		});
	}
},


/**
 * Wraps an event callback so we can attach/detach it
 */
_getEventCallback: function(implementOn, event, callback, selector, context, once) {
	var self = this,

	stringy = callback.toString(),
	
	wrappedListener = function (e){

		var eventWrapper = new NWTEventInstance(e),

		selfCallee = arguments.callee,

		returnControl = function() {
			// Call the callback
			// Prepend the wrapped event onto the argument list so we can expect what arguments we get
			localnwt.event._eventData.unshift(eventWrapper);
			callback.apply(implementOn, localnwt.event._eventData);
			localnwt.event._eventData = [];

			if (once) {
				implementOn.removeEventListener(event, selfCallee);
			}
		};

		if (selector) {
			implementOn.all(selector).each(function(userEl) {
				if (userEl._node == eventWrapper.target._node) {
					returnControl();
				}
			});
			return;
		}
		returnControl();
	};

	// Push the callback onto the cached string
	self._cached[stringy] = self._cached[stringy] || [];
	self._cached[stringy].push({
		type: event,
		obj: implementOn,
		fn: wrappedListener,
		raw: callback
	})

	return wrappedListener;
},


/**
 * Adds an event listener
 * @param object toImplement Any object which can be evented.
 * @param string Name Event name
 * @param function Callback Event callback
 * @param string CSS selector for event bubbling
 * @param object context Execution context
 * @param bool once If true, discards the event callback after is runs
 */
on: function (implementOn, event, callback, selector, context, once) {
	implementOn.addEventListener(event, this._getEventCallback.apply(this, arguments));
	return implementOn;
},

/**
 * Removes an event listener from an eventable object
 * @param string Name Event name
 * @param function Callback Event callback
 */
off: function (implementOn, event, callback) {
	var stringy = callback.toString();

	if (this._cached[stringy]) {

		// Iteratre through the cached callbacks and remove the correct one based on reference
		for(var i=0,numCbs=this._cached[stringy].length; i < numCbs; i++) {
			if (this._cached[stringy][i].raw === callback) {
				implementOn.removeEventListener(event, this._cached[stringy][i].fn);
			}
		}
	}
},

/**
 * Fires a callback when the dom is ready
 */
ready: function(fn) {
	/*!
	 * contentloaded.js
	 *
	 * Author: Diego Perini (diego.perini at gmail.com)
	 * Summary: cross-browser wrapper for DOMContentLoaded
	 * Updated: 20101020
	 * License: MIT
	 * Version: 1.2
	 *
	 * URL:
	 * http://javascript.nwbox.com/ContentLoaded/
	 * http://javascript.nwbox.com/ContentLoaded/MIT-LICENSE
	 *
	 */
	
	// @fn function reference

	var done = false,
		top = true,

		root = y.documentElement,
	
		add = y.attachEvent ? 'attachEvent' : 'addEventListener',
		rem = y.attachEvent ? 'detachEvent' : 'removeEventListener',
		pre = y.attachEvent ? 'on' : '',
	
		init = function(e) {
			if (e.type == 'readystatechange' && y.readyState != 'complete') return;
			(e.type == 'load' ? z : y)[rem](pre + e.type, init, false);
			if (!done && (done = true)) fn.call(z, e.type || e);
		},
	
		poll = function() {
			try { 
				if(!root.doScroll('left')){ 
					setTimeout(poll, 50); return;
				} 
			} catch(e) { setTimeout(poll, 50); return; }
			init('poll');
		};

	if (y.readyState == 'complete') fn.call(z, 'lazy');
	else {
		if (y.createEventObject && root.doScroll) {
			try { top = !z.frameElement; } catch(e) { }
			if (top) poll();
		}
		y[add](pre + 'DOMContentLoaded', init, false);
		y[add](pre + 'readystatechange', init, false);
		z[add](pre + 'load', init, false);
	}
}

};


localnwt.event = new NWTEvent();

localnwt.ready = localnwt.event.ready;


}(window, document);

(function(w){

  w.parseURI =   function parseURI(url) {
    /*!(c) Steven Levithan <stevenlevithan.com> MIT License*/
    var p=['source','protocol','authority','userInfo','user','password','host','port','relative','path','directory','file','query','anchor'],
	    u={},i=p.length,
	    m=/^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/.exec(url);
    while (i--) u[p[i]] = m[i] || '';
    return u;
  };
  if(!Array.prototype.unique){
    Array.prototype.unique = function () {
      var r=[],i=0,ib=this.length;
      for(i;i<ib;i++) if(r.indexOf(this[i]) == -1) r.push(this[i]);
      return r;
    };
  }
  if(!String.prototype.capitalize){
    String.prototype.capitalize = function() {return this.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });};
  }
  if((typeof Element) != 'undefined') {
    // FIXME - remove this method - I don't think we will use it.
    if(!Element.prototype.scrollIntoViewIfNeeded){
      Element.prototype.scrollIntoViewIfNeeded = function (centerIfNeeded) {
	centerIfNeeded = arguments.length === 0 ? true : !!centerIfNeeded;
    
	var d=document, de=d.documentElement, b=d.body, docOS = {x:(w.pageXOffset||de.scrollLeft||b.scrollLeft), y:(w.pageYOffset||de.scrollTop||b.scrollTop)},
	    wh = (w.innerHeight||de.clientHeight||b.clientHeight),
	    os = {y:LiveEditNWT.one(this).region().top},
	    ch = this.clientHeight,
	    // above/below -> overlap
	    aboveViewport = os.y < docOS.y,
	    belowViewport = os.y + ch > docOS.y + wh,
	    // alignWithTop => Top edge above viewport and bottom edge inside viewport OR bigger than viewport
	    alignWithTop = (os.y < docOS.y && os.y + ch < docOS.y + wh)
		    || (ch > wh); 

	if (aboveViewport || belowViewport) {
	  if(centerIfNeeded && ch < wh){
	    window.scrollTo(docOS.x, os.y - (wh-ch/2));
	  } else {
	    this.scrollIntoView(alignWithTop);
	  }
	}
      };
    }
    if(!Element.prototype.scrollForLEActivation) {
      Element.prototype.scrollForLEActivation = function (os) {
	os = os || -30;
	var d=document, de=d.documentElement, b=d.body, 
	    scroll = {left:(w.pageXOffset||de.scrollLeft||b.scrollLeft), top:(w.pageYOffset||de.scrollTop||b.scrollTop)},
	    // Viewport
	    vp = {width:(w.innerWidth|de.innerWidth),height:(w.innerHeight|de.innerHeight)}, // Assuming IE10
	    // Relative Viewport
	    rvp = {left:scroll.left, top:(scroll.top), right: (scroll.left+vp.width), bottom:(scroll.top+vp.height)},
	    cr = LiveEditNWT.one(this).region(),
	    shouldMove = cr.top < rvp.top || cr.top > rvp.bottom;
	    ;
	if (shouldMove) {
	    window.scrollTo(scroll.left, cr.top + os);
	}
      };
    }
  }
   
  
  function LES(opts){
    for(var k in opts){
      if(opts.hasOwnProperty(k))this[k] = opts[k];
    }
  }
  LES.prototype = {
      getStorage:function(){
	return this.storage=='session'?sessionStorage:localStorage;
      },
      get:function get(){
	var val = this.getStorage().getItem(this.key);
	if(val == null) return this['default'] == undefined ? null : this['default'];
	else return val;
      },
      set:function set(val){this.getStorage().setItem(this.key, val);},
      remove:function(){this.getStorage().removeItem(this.key);}
  };
  w.LiveEditStorage = function(obj){
    var ls = {};
    for(var k in obj){
      if(obj.hasOwnProperty(k)){
	ls[k] = new LES(obj[k]);
      }
    }
    return ls;
  };
  w.CountDownCallback = function (cb, count) {
    this.cb = [];
    this.cb.push(cb);
    this.count = Math.max(count,0);
  };
  w.CountDownCallback.prototype = {
    countDown: function(){
      if(--this.count == 0) this.fire();
      return this.count;
    },
    isDone: function(){
      return this.count < 1;
    },
    fire: function(){
      if(!this.isDone())return;
      var me = this;
      this.cb.forEach(function(el){el.call(me);});
    },
    queue: function(cb){
      this.cb.push(cb);
      this.fire();
    }
  };
  w.cloneObject = function (obj) {
      if (null == obj || "object" != typeof obj) return obj;
      var copy = obj.constructor();
      for (var attr in obj){if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];}
      return copy;
  };


  /*
  * JavaScript Templates 2.1.0
  * https://github.com/blueimp/JavaScript-Templates
  *
  * Copyright 2011, Sebastian Tschan
  * https://blueimp.net
  *
  * Licensed under the MIT license:
  * http://www.opensource.org/licenses/MIT
  *
  * Inspired by John Resig's JavaScript Micro-Templating:
  * http://ejohn.org/blog/javascript-micro-templating/
  */
  (function ($) {
      "use strict";
      var tmpl = function (str, data) {
	  var f = !/[^\w\-\.:]/.test(str) ? tmpl.cache[str] = tmpl.cache[str] ||
		  tmpl(tmpl.load(str)) :
		      new Function(
			  tmpl.arg + ',tmpl',
			  "var _e=tmpl.encode" + tmpl.helper + ",_s='" +
			      str.replace(tmpl.regexp, tmpl.func) +
			      "';return _s;"
		      );
	  return data ? f(data, tmpl) : function (data) {
	      return f(data, tmpl);
	  };
      };
      tmpl.cache = {};
      tmpl.load = function (id) {
	  return document.getElementById(id).innerHTML;
      };
      tmpl.regexp = /([\s'\\])(?![^%]*%\})|(?:\{%(=|#)([\s\S]+?)%\})|(\{%)|(%\})/g;
      tmpl.func = function (s, p1, p2, p3, p4, p5) {
	  if (p1) { // whitespace, quote and backspace in interpolation context
	      return {
		  "\n": "\\n",
		  "\r": "\\r",
		  "\t": "\\t",
		  " " : " "
	      }[s] || "\\" + s;
	  }
	  if (p2) { // interpolation: {%=prop%}, or unescaped: {%#prop%}
	      if (p2 === "=") {
		  return "'+_e(" + p3 + ")+'";
	      }
	      return "'+(" + p3 + "||'')+'";
	  }
	  if (p4) { // evaluation start tag: {%
	      return "';";
	  }
	  if (p5) { // evaluation end tag: %}
	      return "_s+='";
	  }
      };
      tmpl.encReg = /[<>&"'\x00]/g;
      tmpl.encMap = {
	  "<"   : "&lt;",
	  ">"   : "&gt;",
	  "&"   : "&amp;",
	  "\""  : "&quot;",
	  "'"   : "&#39;"
      };
      tmpl.encode = function (s) {
	  return String(s || "").replace(
	      tmpl.encReg,
	      function (c) {
		  return tmpl.encMap[c] || "";
	      }
	  );
      };
      tmpl.arg = "o";
      tmpl.helper = ",print=function(s,e){_s+=e&&(s||'')||_e(s);}" +
	  ",include=function(s,d){_s+=tmpl(s,d);}";
      if (typeof define === "function" && define.amd) {
	  define(function () {
	      return tmpl;
	  });
      } else {
	  $.LiveEditTemplate = tmpl;
      }
  }(this));
   
  /*
 * Date Format 1.2.3
 * (c) 2007-2009 Steven Levithan <stevenlevithan.com>
 * MIT license
 * http://blog.stevenlevithan.com/archives/date-time-format
 * Includes enhancements by Scott Trenda <scott.trenda.net>
 * and Kris Kowal <cixar.com/~kris.kowal/>
 *
 * Accepts a date, a mask, or a date and a mask.
 * Returns a formatted version of the given date.
 * The date defaults to the current date/time.
 * The mask defaults to dateFormat.masks.default.
 */

  w.dateFormat = function () {
	  var	token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
		  timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
		  timezoneClip = /[^-+\dA-Z]/g,
		  pad = function (val, len) {
			  val = String(val);
			  len = len || 2;
			  while (val.length < len) val = "0" + val;
			  return val;
		  };

	  // Regexes and supporting functions are cached through closure
	  return function (date, mask, utc) {
		  var dF = dateFormat;

		  // You can't provide utc if you skip other args (use the "UTC:" mask prefix)
		  if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
			  mask = date;
			  date = undefined;
		  }

		  // Passing date through Date applies Date.parse, if necessary
		  date = date ? new Date(date) : new Date;
		  if (isNaN(date)) throw SyntaxError("invalid date");

		  mask = String(dF.masks[mask] || mask || dF.masks["default"]);

		  // Allow setting the utc argument via the mask
		  if (mask.slice(0, 4) == "UTC:") {
			  mask = mask.slice(4);
			  utc = true;
		  }

		  var	_ = utc ? "getUTC" : "get",
			  d = date[_ + "Date"](),
			  D = date[_ + "Day"](),
			  m = date[_ + "Month"](),
			  y = date[_ + "FullYear"](),
			  H = date[_ + "Hours"](),
			  M = date[_ + "Minutes"](),
			  s = date[_ + "Seconds"](),
			  L = date[_ + "Milliseconds"](),
			  o = utc ? 0 : date.getTimezoneOffset(),
			  flags = {
				  d:    d,
				  dd:   pad(d),
				  ddd:  dF.i18n.dayNames[D],
				  dddd: dF.i18n.dayNames[D + 7],
				  m:    m + 1,
				  mm:   pad(m + 1),
				  mmm:  dF.i18n.monthNames[m],
				  mmmm: dF.i18n.monthNames[m + 12],
				  yy:   String(y).slice(2),
				  yyyy: y,
				  h:    H % 12 || 12,
				  hh:   pad(H % 12 || 12),
				  H:    H,
				  HH:   pad(H),
				  M:    M,
				  MM:   pad(M),
				  s:    s,
				  ss:   pad(s),
				  l:    pad(L, 3),
				  L:    pad(L > 99 ? Math.round(L / 10) : L),
				  t:    H < 12 ? "a"  : "p",
				  tt:   H < 12 ? "am" : "pm",
				  T:    H < 12 ? "A"  : "P",
				  TT:   H < 12 ? "AM" : "PM",
				  Z:    utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
				  o:    (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
				  S:    ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
			  };

		  return mask.replace(token, function ($0) {
			  return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
		  });
	  };
  }();

  // Some common format strings
  dateFormat.masks = {
	  "default":      "ddd mmm dd yyyy HH:MM:ss",
	  shortDate:      "m/d/yy",
	  mediumDate:     "mmm d, yyyy",
	  longDate:       "mmmm d, yyyy",
	  fullDate:       "dddd, mmmm d, yyyy",
	  shortTime:      "h:MM TT",
	  mediumTime:     "h:MM:ss TT",
	  longTime:       "h:MM:ss TT Z",
	  isoDate:        "yyyy-mm-dd",
	  isoTime:        "HH:MM:ss",
	  isoDateTime:    "yyyy-mm-dd'T'HH:MM:ss",
	  isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
  };

  // Internationalization strings
  dateFormat.i18n = {
	  dayNames: [
		  "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
		  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
	  ],
	  monthNames: [
		  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
		  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
	  ]
  };

  // For convenience...
  Date.prototype.format = function (mask, utc) {
	  return dateFormat(this, mask, utc);
  };
    /**
   * Display an alert to the user.
   * @param {string} msg The message to display.
   * @param {number|null} to Optional timeout in seconds. 
   */
  w.displayAlert = function displayAlert(msg, to) {
    var styles =['position:fixed','top:5px','left:5px','z-index:880001','background-color:#F9EDBE','border:1px solid #F0C36D', 
    'box-shadow:0 0 4px rgba(0,0,0,.5)','padding:15px','color:#333','line-height:19px','-webkit-transition:all 1s','transition:all 1s']
	.join(' !important;'),
      html = '<img> ' + msg, img,
      node = document.createElement('div');
    node.innerHTML = html;
    document.body.appendChild(node);
    node.setAttribute('style',styles);
    (img=node.firstChild).src = '//vipasuite.com/LiveEdit/vipa-icon-19.png';
    img.setAttribute('style','vertical-align:bottom;width:19px;height:19px;');
    to=(to||9)*1000;
    setTimeout(function(){node.style.left=-node.offsetWidth+'px';node.style.opacity=0;},to);
    setTimeout(function(){node.parentNode.removeChild(node);},(to+2000));
  }
  var scriptRX=/<script[^>]*>([\S\s]*?)<\/script>/gim;
  /** Returns an object with a scripts property and an addScripts method. */
  w.LiveEditAJAXContent=function(h){
      return {
	  html:h.replace(scriptRX, ''),
	  scripts:(function(){
		  try{scriptRX.lastIndex=0;}catch(e){}
	      var m=[],i,arr;
	      while( (arr = scriptRX.exec(h)) ){
		  if(arr[1]){m[m.length]=arr[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');}
	      }
	      return m;
	  })(),
	  addScripts:function(){
		  var e,t,i,s=this.scripts,h=document.getElementsByTagName("head")[0];
		  if(!s || s.length < 1)return;
			  for(i=0;t=s[i]; i++) {
				  e = document.createElement("script");
				  e.setAttribute("type", "text/javascript");
				  e.text = t;
				  h.appendChild((s[i]=e));
			  }
			  setTimeout(function(){for(var i=0; i<s.length; i++)h.removeChild(s[i]);}, 30000);
	  }
      }; 
  };
  
})(window);