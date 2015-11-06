jQuery(function($) {
	var popupContent = [
		'<h1>Vipa Solutions has exciting news!</h1>',
		'<h3>We are making it easier for you to get in touch with our support team.</h3>',
		'<p>We invite you to email your request or question to <a href="mailto:support@vipasolutions.com">support@vipasolutions.com</a> and a ticket will automatically be created on your behalf. Our support team will be in touch with you promptly.</p>',
		'<div class="faq">',
			'<div class="faq-question">Why is Vipa Solutions changing VipaSuite\'s ticketing process?</div>',
			'<div class="faq-answer">We want to make contacting support as easy as possible. It\'s simple, easier and faster.</div>',
		'</div>',
		'<div class="faq">',
			'<div class="faq-question">Can I still view my older tickets?</div>',
			'<div class="faq-answer">Yes. The VipaSuite\'s ticketing system will be accessible until December 31, 2015.</div>',
		'</div>',
		'<div class="notification-actions">',
			'<a href="mailto:support@vipasolutions.com" class="action btn send-email">Send Email Now</a>',
			'<a href="#" class="action close">View Ticket History</a>',
		'</div>'
	].join('');

	$.fancybox(popupContent, {
		maxWidth: 600,
		wrapCSS: 'popup-notification',
		padding: 25,
		afterShow: function() {
			$('.popup-notification .notification-actions .close').on('click', function(evt) {
				evt.preventDefault();
				$.fancybox.close();
			});
		}
	});
});