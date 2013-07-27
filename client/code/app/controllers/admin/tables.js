module.exports = function(module) {
	'use strict';

	module.controller('AdminTableCtrl', ['$scope', '$log', 'pubsub', 'rpc', function($scope, $log, pubsub, rpc) {


		// ------------------------------------------------------------------------
		// actions
		// ------------------------------------------------------------------------

		$scope.hpsync = function(event) {
			event.target.blur();
			rpc('hyperpin.sync');
		};

		$scope.ipdbsync = function(event) {
			event.target.blur();
			rpc('pind.fetchIpdb');
		};

		$scope.dlrom = function(event) {
			event.target.blur();
			rpc('pind.fetchMissingRoms');
		};

		$scope.dlmedia = function(event) {
			event.target.blur();
			rpc('hyperpin.findMissingMedia');
		};


		// ------------------------------------------------------------------------
		// data mapping
		// ------------------------------------------------------------------------

		$scope.mapperFn = function(table) {

			if (table.name && table.year && table.manufacturer) {
				table.title = (table.name_match ? table.name_match : table.name) + ' (' + table.manufacturer + ' ' + table.year + ')';
			} else {
				table.title = table.hpid;
			}

			table.badge_table = table.table_file ? 'success' : 'important';
			table.badge_rom = table.rom_file ? 'success' : table.rom_file === null ? null : 'important';
			table.badge_media_wheel = table.media_wheel ? 'success' : 'important';
			table.badge_media_backglass = table.media_backglass ? 'success' : 'important';
			table.badge_media_table = table.media_table ? 'success' : 'important';
			table.badge_media_video = table.media_video ? 'success' : 'important';

			if (table.type != 'OG' && table.platform == 'VP' && table.rom === null) {
				if (table.table_file) {
					table.rom_display = 'missing';
					table.rom_class = ' missing';
				} else {
					table.rom_display = '(unknown)';
					table.rom_class = ' unknown';
				}
			} else {
				if (table.rom) {
					table.rom_display = table.rom;
					table.rom_class = '';
				} else {
					table.rom_display = '(n/a)';
					table.rom_class = ' na';
				}
			}
			return table;
		};


		// ------------------------------------------------------------------------
		// status handling
		// ------------------------------------------------------------------------

		$scope.registerEvents({
			hpsync:   [ 'hp.processingStarted', 'hp.processingCompleted' ],
			ipdbsync: [ 'ipdb.processingStarted', 'ipdb.processingCompleted' ],
			dlrom:    [ 'vpm.processingStarted', 'vpm.processingCompleted' ],
			dlmedia:  [ 'vpf.processingStarted', 'vpf.processingCompleted' ],
			fetchhs:  [ 'vpm.processingStarted', 'vpm.processingCompleted' ]
		});

	}]);

};


$(document).ready(function() {
	return false;


	// enable download missing media button
	var downloadMedia = function() {
		processing('#dlmedia');

		api('HyperPin.FindMissingMedia', { }, function(err) {
			processed('#dlmedia');
			if (err) {
				alert('Problem Downloading: ' + err);
			} else {
				scope.$broadcast('paramsUpdated');
			}
		});
	};

	// enable fetchHiscores button
	var fetchHiscores = function() {
		processing('#fetchhs');
		api('Pind.FetchHiscores', { }, function(err, result) {
			processed('#fetchhs');
			if (err) {
				alert('Problem Syncing: ' + err);
			}
		});
	};

	$('.nodata button').click(syncHyperPin);
	$('#hpsync button').click(syncHyperPin);
	$('#ipdbsync button').click(syncIPDB);
	$('#dlrom button').click(downloadRoms);
	$('#dlmedia button').click(downloadMedia);
	$('#fetchhs button').click(fetchHiscores);

	// real time code
/*	var socket = io.connect('/');
	var $console = $('#console');
	var timer;

	socket.on('startProcessing', function(msg) {
		processing(msg.id);
	});
	socket.on('endProcessing', function(msg) {
		processed(msg.id);
	});
	socket.on('tableUpdate', function(msg) {
		if ($('tr[data-id="' + msg.key + '"]').length > 0) {
			scope.$broadcast('paramsUpdated');
		}
	});*/
});

function updateActions() {
	$('.action').removeClass('disabled').find('button').removeAttr('disabled').find('i').removeClass('spin');
	$('.action').each(function() {
		if ($(this).data('processing')) {
			$($(this).data('exclusive'))
				.addClass('disabled')
				.find('button')
				.attr('disabled', 'disabled');
			$(this).find('button').attr('disabled', 'disabled').find('i').addClass('spin');
		}
	});
}

function processing(section) {
	$(section).data('processing', true);
	updateActions();
}

function processed(section) {
	$(section).data('processing', false);
	updateActions()
}
