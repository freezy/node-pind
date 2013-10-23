jQuery(document).ready(function() {

    $(window).stellar();

    var mywindow = $(window);
    var htmlbody = $('html,body');


    $('.slide').prev('hr').waypoint(function(direction) {

        dataslide = $(this).next('.slide').data('slide');

        if (direction === 'down') {
            $('.nav li[data-slide="' + dataslide + '"]').addClass('active').prev().removeClass('active');
        }
        else {
            $('.nav li[data-slide="' + dataslide + '"]').removeClass('active').prev().addClass('active');
        }

    }, { offset: 40 });

    mywindow.scroll(function () {
        if (mywindow.scrollTop() == 0) {
            $('.nav li[data-slide="1"]').addClass('active');
            $('.nav li[data-slide="2"]').removeClass('active');
        }
    });


    $('.nav > li > a').click(function (e) {
        e.preventDefault();
        $(this).blur();
        dataslide = $(this).parents('li').attr('data-slide');
        htmlbody.animate({
            scrollTop: $('.slide[data-slide="' + dataslide + '"]').prev('hr').offset().top - 40
        }, 1000, 'easeInOutQuint');

    });


});

  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
  })(window,document,'script','//www.google-analytics.com/analytics.js','ga');

  ga('create', 'UA-45093729-1', 'pind.ch');
  ga('send', 'pageview');