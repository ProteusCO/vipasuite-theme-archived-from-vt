/**
 * Example script to create a drop zone for DnD file support
 * as well as picking multiples of multiples from a file input (useful for
 * picking from multiple different directories).
 */

(function (global, d, $) {
	"use strict";

	if (!global.cms || !global.cms.file || !global.cms.file.DnD) {
		return;
	}

	function FileSelector(root, opts) {
		var _defaults = {
			validPreviewImageTypes: ['jpg', 'jpeg', 'png', 'gif', 'bmp'],
			imgBase: '/_resources/dyn/docroot/cms/filesystem/icons/extension/',
			defaultExtImg: '/_resources/dyn/docroot/cms/filesystem/icons/extension/default.png',
			dropZone: null,
			thumbnailSize: {
				w: 50,
				h: 50
			}
		};
		var _self = this;
		var $root, $input, $dndZone, $fileList, $fileListHeading;
		var _dnd;
		_self._files = {};
		_self._settings = {};

		function updateUi() {
			var previewCount = 0;
			var totalFileSize = 0;
			var fileCount = Object.keys(_self._files).length;

			$.each(_self._files, function(idx, file) {
				totalFileSize += file.data.size;
				if (file.hasPreview) {
					previewCount++;
				}
			});

			if (Object.keys(_self._files).length) {
				$root.addClass('has-files');
			} else {
				$root.removeClass('has-files');
			}

			if (previewCount) {
				$fileList.addClass('has-preview');
			} else {
				$fileList.removeClass('has-preview');
			}

			$fileListHeading.text(fileCount + ' File' + (fileCount != 1 ? 's' : '') + ' to be uploaded (' + _self.getBytesFormatted(totalFileSize) + ')');
		}

		function filesSelected(fileList, dataTransfer) {
			$.each($.makeArray(fileList), function (idx, file) {
				// Output file entry on and save files for removal / submission.
				var fileKey = _self.makeFileKey(file);

				if (_self.checkFileKeyExists(fileKey)) {
					console.warn('Tried adding the same file: ' + file.name);
					return;
				}

				if (_self.checkIsDirectory(idx, dataTransfer)) {
					console.warn('Tried adding a directory');
					return;
				}

				var ext = _self.getExtensionOrSubtype(file);
				var lm = file.lastModifiedDate ? file.lastModifiedDate.toLocaleDateString() : 'n/a';
				var fileExtImg =  _self._settings.imgBase + ext + '.gif';

				var $file = $('<div class="file-upload nopreview" />').appendTo($fileList);
				var $preview = $('<span class="file-preview file-upload-part" />').appendTo($file);
				var $info = $('<span class="file-info file-upload-part" />').appendTo($file);
				var $actions = $('<span class="file-actions file-upload-part" />').appendTo($file);

				if (typeof global.URL !== 'undefined' && typeof global.URL.createObjectURL !== 'undefined') {
					var $previewLink = $('<a class="file-preview-link" target="_blank" title="Click to Preview" />')
							.attr('href', global.URL.createObjectURL(file))
							.appendTo($preview);

					$('<img alt="" />')
							.attr('src', fileExtImg)
							.on('error', function() {
								$previewLink.css('backgroundImage', 'url(' + _self._settings.defaultExtImg + ')');
							})
							.on('load', function() {
								$previewLink.css('backgroundImage', 'url(' + fileExtImg + ')');
							});
				}

				if (_self.checkValidPreviewImage(ext)) {
					var reader = new FileReader();
					$file.removeClass('nopreview');

					reader.onload = function(evt) {
						$previewLink.removeAttr('style');
						$('<img alt="" />').attr('src', _self.makeThumbnailDataUrl(evt.target.result, _self._settings.thumbnailSize.w, _self._settings.thumbnailSize.h)).appendTo($preview.children());
					};

					reader.readAsDataURL(file);
				}

				$('<span class="file-name" />').text(file.name).appendTo($info);
				$('<span class="file-size" />').text('(' + _self.getBytesFormatted(file.size) + ')').appendTo($info);
				$('<span class="file-modified" />').text('Last modified ' + lm).appendTo($info);
				$('<button class="btn remove">Remove</button>').appendTo($actions);

				var $hiddenFileInput = $('<input type="hidden" />').attr('name', _dnd.getInput().name).appendTo($actions);
				$hiddenFileInput.get(0)._file = file;
				$hiddenFileInput.get(0).appendFormData = _self.appendFormData;

				$file.data('key', fileKey);
				_self._files[fileKey] = {
					data: file,
					$file: $file,
					hasPreview: _self.checkValidPreviewImage(ext)
				};

				updateUi();
			});
			_dnd.clearFileInput();
		}

		function init() {
			var dropZoneTarget;
			$root = $(root);
			$input = $root.find('input.file-upload-browse');

			if (!!_self._initfs || !$root.length || !$input.length) {
				return;
			}

			_self._settings = $.extend({}, _defaults, opts);

			$('<div class="drop-zone-option-title" />').appendTo($root);
			$dndZone = $(['<div class="file-upload-drop-zone">',
				'<span class="drop-zone-text drop-zone-text-inactive">Drag and Drop Files Here</span><span class="drop-zone-text drop-zone-text-active">Drop Files Here</span>',
				'<span class="drop-zone-file-con"><span class="drop-zone-file drop-zone-file1"></span><span class="drop-zone-file drop-zone-file2"></span><span class="drop-zone-file drop-zone-file3"></span></span>',
				'</div>'].join('')).appendTo($root);
			$fileListHeading = $('<div class="file-upload-list-heading">Files to be uploaded</div>').appendTo($root);
			$fileList = $('<div class="file-upload-list" />').appendTo($root);

			$fileList.on('click', '.btn.remove', function(evt) {
				var $file = $(this).parent().parent();

				delete _self._files[$file.data('key')];
				$file.remove();

				updateUi();
			});

			$dndZone.on('dragover', function(evt) {
				$dndZone.addClass('zone-active');
			});

			$dndZone.on('dragleave drop dragend', function(evt) {
				$dndZone.removeClass('zone-active');
			});

			if (_dnd) {
				_dnd.destroy();
			}

			if (_self._settings.dropZone) {
				dropZoneTarget = $(_self._settings.dropZone).get(0);
			} else {
				dropZoneTarget = $root.get(0);
			}

			_dnd = new cms.file.DnD($input.get(0), dropZoneTarget, $fileList.get(0));
			_dnd.addListener(filesSelected);

			_self._initfs = true;
		}

		init();
	}

	FileSelector.prototype = {
		BYTE_SIZES: {
			KILO: 1024,
			MEGA: 1048576,
			GIGA: 1073741824
		},

		compareFileName: function compareFileName(a,b) {
			a = (a.name||'').toLowerCase();
			b = (b.name||'').toLowerCase();
			if(a > b){return 1;}
			if(a < b){return -1;}
			return 0;
		},

		checkValidPreviewImage: function checkValidPreviewImage(type) {
			return this._settings.validPreviewImageTypes.indexOf(type) != -1;
		},

		appendFormData: function appendFormData(form, formData, elementName) {
			if (this._file) {
				formData.append(elementName, this._file);
			}
		},

		getBytesFormatted: function getBytesFormatted(b) {
			if (b > this.BYTE_SIZES.GIGA) {
				return (b / this.BYTE_SIZES.GIGA).toFixed(1).toLocaleString() + 'G';
			} else if (b > this.BYTE_SIZES.MEGA) {
				return (b / this.BYTE_SIZES.MEGA).toFixed(1).toLocaleString() + 'M';
			}
			if (b == 0) {
				return '0.0K';
			}
			return (b / this.BYTE_SIZES.KILO).toFixed(1).toLocaleString() + 'K';
		},

		getExtensionOrSubtype: function getExtensionOrSubtype(file) {
			var ext = "txt", idx, s;
			if (!file || (!file.name && !file.type)) {
				return ext;
			}
			s = file.name;
			idx = s.lastIndexOf('.');
			if (idx == -1 && file.type) {
				s = file.type;
				idx = s.lastIndexOf('/');
			}
			if (idx != -1 && idx < s.length) {
				ext = s.substring(idx + 1);
			}
			return ext.toLowerCase();
		},

		checkIsDirectory: function checkIsDirectory(idx, dataTransfer) {

			if (typeof dataTransfer != 'undefined'
					&& typeof dataTransfer.items != 'undefined'
					&& typeof dataTransfer.items[idx] != 'undefined'
					&& typeof dataTransfer.items[idx].webkitGetAsEntry != 'undefined') {
				var entry = dataTransfer.items[idx].webkitGetAsEntry();

				if (entry.isDirectory) {
					return true;
				}
			}

			return false;
		},

		makeFileKey: function makeFileKey(file) {
			return file.name + file.size + file.lastModifiedDate + file.type;
		},


		checkFileKeyExists: function checkFileKeyExists(key) {
			return typeof this._files[key] !== 'undefined';
		},

		makeThumbnailDataUrl: function makeThumbnailDataUrl(base64, maxWidth, maxHeight) {

			// Max size for thumbnail
			if(typeof(maxWidth) === 'undefined') maxWidth = 500;
			if(typeof(maxHeight) === 'undefined') maxHeight = 500;

			// Create and initialize two canvas
			var canvas = document.createElement("canvas");
			var ctx = canvas.getContext("2d");
			var canvasCopy = document.createElement("canvas");
			var copyContext = canvasCopy.getContext("2d");

			// Create original image
			var img = new Image();
			img.src = base64;

			// Determine new ratio based on max size
			var ratio = 1;
			if(img.width > maxWidth && img.width >= img.height)
				ratio = maxWidth / img.width;
			else if(img.height > maxHeight && img.height > img.width)
				ratio = maxHeight / img.height;

			// Draw original image in second canvas
			canvasCopy.width = img.width;
			canvasCopy.height = img.height;
			copyContext.drawImage(img, 0, 0);

			// Copy and resize second canvas to first canvas
			canvas.width = img.width * ratio;
			canvas.height = img.height * ratio;
			ctx.drawImage(canvasCopy, 0, 0, canvasCopy.width, canvasCopy.height, 0, 0, canvas.width, canvas.height);

			return canvas.toDataURL();
		}
	};


	function initFileSelectors(con) {
		$(con).find('div.file-upload-browse').each(function() {
			new FileSelector(this, {
				dropZone: $(this).closest('.file_upload_container')
			});
		});

		//remove nbsp elements
		$('.upload_options .ctb input[type=checkbox]').each(function() {
			if (this.nextSibling.nodeValue == '\u00a0') {
				this.parentNode.removeChild(this.nextSibling);
			}
		});
	}

	function init() {
		$('form.miwt-form').each(function() {
			var form = this;
			var oldPostUpdate;

			if (form.submit_options && form.submit_options.postUpdate) {
				oldPostUpdate = form.submit_options.postUpdate;

				form.submit_options.postUpdate = function() {
					oldPostUpdate();
					initFileSelectors(form);
				};
			} else {
				form.submit_options = {
					postUpdate: function(){ initFileSelectors(form); }
				}
			}

			initFileSelectors(form);
		});

		d.removeEventListener('DOMContentLoaded', init);
	}

	d.addEventListener('DOMContentLoaded', init);

})(window, document, jQuery);