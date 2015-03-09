jQuery(function($) {

	function titleFormat(obj) {
		var $a = obj.element,
				$tr = $a.closest('.note'),
				principal = $('.principal', $tr).text(),
				time = $('.create_time', $tr).text();

		var nt = '<div id="note-img-title">'
				+ '<span class="cnt">Image ' + (obj.index + 1) + ' of ' + obj.group.length + '</span>'
				+ '<div class="note_info">'
				+ '<div class="principal">' + principal + '</div>'
				+ '<div class="create_time">' + time + '</div>'
				+ '</div>'
				+ '</div>';
		return nt;
	}

	function linkifyHandler(links){
		links.addClass('auto_link').attr('target', '_blank');
	}

	function updateAnchors(ctx){
		if(this.nodeType == 1) ctx = this;

		$('.issue_view .field_description, .issue_view .note_body .content').linkify({handleLinks:linkifyHandler});

		$('ul.files .file a', ctx).each(function(){
			if(/(.jpg|.jpeg|.gif|.bmp|.png|.svg|.ico)([?;#]|$)/ig.test(this.href)) {
				var $a = $(this), $view = $a.clone();
				$view.html('<span>view</span>');
				$view.attr('id', $view.attr('id') + '_fancy');
				$view.attr('rel', 'issue_files');
				$view.addClass('fancybox').addClass('preview');
				$view.attr('href',  $view.attr('href').replace(/disposition=attachment/, ''));
				$a.after($view);
				$a.after('&nbsp;');
				$a.attr('target', '_blank');
			}
		});

		$('ul.files .file a.fancybox', ctx).fancybox({
			minwidth:200,
			title: titleFormat,
			helpers: {
				title : {
					type : 'inside'
				},
				overlay: {
					locked: false
				}
			}
		}).on('click', function(evt) {
			evt.preventDefault();
		});
	}

	function it_postUpdate(data){
		var nodes = $(data.nodesUpdated);
		nodes.each(updateAnchors);
		$('#eminvalidEmail').remove();
		$('.message-container').each(function(){
			if (!$(this).children().length) {
				$(this).remove();
			}
		});
	}


	function it_onSubmit() {
		var $this = $(this);
    var $contactEmail = $this.find('.field_CONTACTEMAIL input');
		var $mc = $this.find('.message-container');

		if ($contactEmail.length && $contactEmail.val().length && $contactEmail.val().indexOf('@') < 0) {
			$contactEmail.parent().addClass('validation_error');

			if (!$mc.length) {
				$mc = $('<div class="message-container" />').prependTo($('.task_container', this));
			}

			$mc.find('#eminvalidEmail').remove();

			$('<div class="message error" />').attr('id', 'eminvalidEmail').text('Contact Email: Invalid email').appendTo($mc);
			return false;
		}

		return true;
	}

	$forms = $('form.miwt-form');
	$forms.each(function(){
		var form = this;
		var oldPostUpdate;

		if (!form.submit_options) {
			form.submit_options = {};
		}

		if (form.submit_options.postUpdate) {
			oldPostUpdate = form.submit_options.postUpdate;

			form.submit_options.postUpdate = function(data) {
				oldPostUpdate(data);
				it_postUpdate(data);
			};
		} else {
			form.submit_options.postUpdate = function(data){
				it_postUpdate(data);
			};
		}

		form.submit_options.onSubmit = it_onSubmit;

		updateAnchors();
	});


	function hashChangeHighlight(){
		if((location.hash||'').indexOf('#note_') == 0) {
			$('.note_selected').removeClass('note_selected');
			$(location.hash).closest('.note').addClass('note_selected');
		}
	}
	if(window.addEventListener)
		window.addEventListener('hashchange', hashChangeHighlight, false);
	hashChangeHighlight();

	var inIE=false, updateMIWTFormFlag=false, lastAutoUpdate=0;
	function updateMIWTForm(){
		if(!updateMIWTFormFlag) return;
		updateMIWTFormFlag=false;
		var now = new Date().getTime(), diff = now - lastAutoUpdate;
		var runSearch = diff > 45000;
		var reload = diff > 3000;
		//console.log(diff);
		if(!reload) return;
		//console.log('Update form');
		$('#issue_tracker').find('.miwt-form').each(function(i, e){
			var submitOptions = {serialize:function(form,sv){
				var fs = miwt.serialize(form,sv);
				if(runSearch) fs = fs + '&il2s=1';
				return fs;
			}};
			e.MIWTSubmit($.extend({}, this.submit_options ? this.submit_options : {}, submitOptions));
		});
		lastAutoUpdate=now;
	}
	function prepareForFocus()
	{
		if(inIE) return;
		updateMIWTFormFlag=true;
		lastAutoUpdate=new Date().getTime();
	}
	// Check to see if we are in an interactive element, that could interfere with the auto update
	function inIECheck(event)
	{
		var el = event.target;
		if(el && el.type == 'file'){
			inIE=true;
		} else {
			inIE=false;
		}
	}
	$(document).click(inIECheck).focus(inIECheck);

	$(window).blur(prepareForFocus).focus(function(){
		// Delay in case focus was regained by clicking an MIWT button - need to give it a chance first.
		// MIWT internally prevents multiple submits back-to-back, so no additional work should need to be done.
		setTimeout(updateMIWTForm,150);
	});

});