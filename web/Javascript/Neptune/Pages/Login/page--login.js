jQuery(function($) {
	var placeholders = [
		{
			selector: '.password-entry .field.username input',
			text: 'Username'
		},
		{
			selector: '.password-entry .field.password input',
			text: 'Password'
		},
		{
			selector: '.password-reset .field.password input',
			text: 'New Password'
		},
		{
			selector: '.password-reset .field.verify-password input',
			text: 'Verify New Password'
		}
	];

	$.each(placeholders, function(idx, placeholder) {
		$(placeholder.selector).attr('placeholder', placeholder.text);
	});

	$(document).placeholdr();
});