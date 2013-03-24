module.exports = function(compound) {
    return typeof window === 'undefined' ? [
        'jugglingdb',
        'co-assets-compiler',
		'co-nib'
    ].concat('development' == compound.app.get('env') ? [
        'jade-ext',
        'seedjs',
        'co-generators'
    ] : []).map(require) : [
    ];
};

