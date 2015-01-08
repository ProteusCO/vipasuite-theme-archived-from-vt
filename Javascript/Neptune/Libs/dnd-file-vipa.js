/*
 * Copyright (c) Interactive Information R & D (I2RD) LLC.
 * All Rights Reserved.
 *
 * This software is confidential and proprietary information of
 * I2RD LLC ("Confidential Information"). You shall not disclose
 * such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered
 * into with I2RD.
 */

/**
 * DnD file helper.
 */
if (!window.cms) cms = {};
if (!cms.file) cms.file = {};
cms.file.DnD = (function (w, d) {
	if (!(w.File && w.FileReader && w.FileList && w.Blob))
		return false; // File APIs not supported

	var agc = 1;

	/**
	 * Get ID from element or create one if one doesn't exist.
	 * @param {HTMLElement} el the element.
	 * @returns {string} the element ID.
	 */
	function getId(el) {
		if (!el) return null;
		if (!el.id) el.id = "cf_ag_" + (agc++);
		return el.id;
	}

	function $(id) {
		return d.getElementById(id);
	}

	/**
	 * Event listener used to enable support for the 'drop' event.
	 * Must be registered for both 'dragEnter' and 'dragOver' or the 'drop' event will not
	 * be fired in all browsers.
	 * @param {object} e the event.
	 * @returns {boolean} always returns false. Required for some browsers regardless of how event listener is registered.
	 */
	function handleDragEnterOver(e) {
		if (e.preventDefault) e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
		return false;
	}

	function handleDrop(e) {
		if (e.preventDefault) e.preventDefault();
		this.fireListeners(e.dataTransfer.files, e.dataTransfer); // Requires .bind(this)
		return false;
	}

	/**
	 * Creates a new instance of the drag and drop utility.
	 * @constructor
	 * @param {HTMLElement} input the file input element.
	 * @param {HTMLElement|null} dropZone optional element to treat as a drop zone.
	 * @param {HTMLElement|null} output optional element to treat as an area for output information.
	 */
	function DnD(input, dropZone, output) {
		this.initialize.call(this, input, dropZone, output);
	}

	DnD.prototype = {
		SUFFIX_DATA_URL: "[data-url]",
		SUFFIX_DATA_URL_NAME: "[name]",
		fireListeners: function (files, dataTransfer) {
			this.listeners.forEach(
					function (l) {
						l.call(this, files, dataTransfer);
					});
		},
		/**
		 * Destroy the utility. Removes all listeners.
		 */
		destroy: function () {
			var dropZone = this.getDropZone();
			var input = this.getInput();
			if (input) input.removeEventListener('change', this.inputChanged, false);
			if (dropZone) {
				dropZone.removeEventListener('dragenter', handleDragEnterOver, false);
				dropZone.removeEventListener('dragover', handleDragEnterOver, false);
				dropZone.removeEventListener('drop', this.handleDrop, false);
			}
		},
		initialize: function (input, dropZone, output) {
			this.listeners = [];
			this.inputId = getId(input);
			this.dropZoneId = getId(dropZone);
			this.outputId = getId(output);
			this.inputChanged = function (evt) {
				this.fireListeners(evt.target.files);
			}.bind(this);
			this.handleDrop = handleDrop.bind(this);
			if (input) {
				input.addEventListener('change', this.inputChanged);
			}
			if (dropZone) {
				// Have to cancel both dragenter & dragover to receive drop event
				//  - http://www.quirksmode.org/blog/archives/2009/09/the_html5_drag.html
				dropZone.addEventListener('dragenter', handleDragEnterOver, false);
				dropZone.addEventListener('dragover', handleDragEnterOver, false);
				dropZone.addEventListener('drop', this.handleDrop, false);
			}
		},
		getInput: function () {
			return $(this.inputId);
		},
		getDropZone: function () {
			return $(this.dropZoneId);
		},
		getOutput: function () {
			return $(this.outputId);
		},
		addListener: function (listener) {
			this.listeners.push(listener);
		},
		/**
		 * Clear the file input.
		 * Useful if the selected files are tracked separately from the file input.
		 */
		clearFileInput: function () {
			var input = this.getInput();
			if (!input) return;
			try {
				input.value = null;
			} catch (ex) {
			}
			if (input.value) {
				var newInput = input.cloneNode(true);
				input.removeEventListener('change', this.inputChanged);
				input.parentNode.replaceChild(newInput, input);
				newInput.addEventListener('change', this.inputChanged);
			}
		}
	};

	return DnD;

})(window, document);