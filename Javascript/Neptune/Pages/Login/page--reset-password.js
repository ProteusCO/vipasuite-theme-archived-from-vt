jQuery(function($) {
	var placeholders = [
		{
			selector: '.retrieve-password .email input',
			text: 'Email'
		}
	];

	$.each(placeholders, function(idx, placeholder) {
		$(placeholder.selector).attr('placeholder', placeholder.text);
	});

	$(document).placeholdr();
});