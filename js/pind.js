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