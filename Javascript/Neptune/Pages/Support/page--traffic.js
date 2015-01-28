jQuery(function($) {
	var updates=0,to;

	function startWatch(event){
		updates=0;
		event.preventDefault();
		this.disabled=true;
		watch();
	}
	function stopWatch(event){
		event.preventDefault();
		_stopWatch();
	}
	function _stopWatch(){
		$('.search_actions .watch').text('Watch').click(startWatch);
		clearTimeout(to);
		to = null;
	}
	function watch() {
		if(updates++ > 250){
			_stopWatch();
			return;
		}
		$('.search_actions .watch').text('Loading...');
		var ds = new Date();
		var url = '/partial' + $('#request_stats form').attr('action');
		to=1;
		$.ajax({
			url: url,
			data: $('#request_stats form').serialize(),
			success: function(html){
				$('#request_stats').replaceWith(html);
				$('#request_stats .search_actions').append('<button class="watch" title="Click to toggle">Watching...</button>');
				var de = new Date();
				if(to){
					to=setTimeout(watch, Math.max(2500, (de-ds)*4));
					$('.search_actions .watch').click(stopWatch);
				}
			}
		});
	}

	var rs = $('#request_stats');
	if(!rs) return;
	$('.search_actions', rs).append('<button class="watch" title="Click to toggle">Watch</button>');
	$('.search_actions .watch', rs).click(startWatch);
});