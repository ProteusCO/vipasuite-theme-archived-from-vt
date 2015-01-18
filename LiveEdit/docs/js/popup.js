jQuery(document).ready(function(){
  if ($('.popup').length){
    $('.popup').fancybox({
      type: 'image',
      autoSize: true,
      maxWidth: 1000
    });
  }
});