jQuery(document).ready(function() {

    $(window).stellar();

    slide = $('.slide');
    button = $('.nav > li > a');
    mywindow = $(window);
    htmlbody = $('html,body');


    slide.waypoint(function(direction) {

        dataslide = $(this).attr('data-slide');

        if (direction === 'down') {
            $('.nav li[data-slide="' + dataslide + '"]').addClass('active').prev().removeClass('active');
        }
        else {
            $('.nav li[data-slide="' + dataslide + '"]').addClass('active').next().removeClass('active');
        }

    });
 
    mywindow.scroll(function () {
        if (mywindow.scrollTop() == 0) {
            $('.nav li[data-slide="1"]').addClass('active');
            $('.nav li[data-slide="2"]').removeClass('active');
        }
    });

    function goToByScroll(dataslide) {
        htmlbody.animate({
            scrollTop: $('.slide[data-slide="' + dataslide + '"]').offset().top + 2
        }, 1000, 'easeInOutQuint');
    }

    button.click(function (e) {
        e.preventDefault();
        dataslide = $(this).parents('li').attr('data-slide');
        goToByScroll(dataslide);

    });


});