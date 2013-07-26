module.exports = function(module) {
	'use strict';

	module.controller('AdminTableCtrl', ['$scope', '$log', 'pubsub', 'rpc', function($scope, $log, pubsub, rpc) {


		$scope.hpsync = function(event) {
			event.target.blur();
			rpc('hyperpin.sync');
		};

		$scope.ipdbsync = function(event) {
			event.target.blur();
			rpc('pind.fetchIpdb');
		};

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

		var processingStarted = function(data) {
			switch (data.id) {
				case 'hpsync':
					$scope.status.processing.hp = true;
					$('#hpsync > button > i').addClass('spin');
					break;
				case 'ipdbsync':
					$scope.status.processing.ipdb = true;
					$('#ipdbsync > button > i').addClass('spin');
					break;
			}
			$('.row.footer > h2').addClass('disabled');
			$('.action').addClass('disabled').find('button').attr('disabled', 'disabled');
		};
		var processingCompleted = function(data) {
			switch (data.id) {
				case 'hpsync':
					$scope.status.processing.hp = false;
					break;
				case 'ipdbsync':
					$scope.status.processing.ipdb = false;
					break;
			}
			$('.row.footer > h2').removeClass('disabled');
			$('.action').removeClass('disabled').find('button').removeAttr('disabled', 'disabled');
			$('.action > button > i').removeClass('spin');
		};

		var updateStatus = function() {
			if ($scope.status.processing.hp) {
				processingStarted({ id: 'hpsync' });
			}
			if ($scope.status.processing.ipdb) {
				processingStarted({ id: 'ipdbsync' });
			}
		};

		if (!$scope.statusAvailable) {
			$scope.$on('statusAvailable', function() {
				$scope.$apply(updateStatus);
			});
		} else {
			updateStatus();
		}

		// events
		ss.event.on('hp.processingStarted', processingStarted);
		ss.event.on('hp.processingCompleted', processingCompleted);
		ss.event.on('ipdb.processingStarted', processingStarted);
		ss.event.on('ipdb.processingCompleted', processingCompleted);
		$scope.$on('$destroy', function() {
			ss.event.off('hp.processingStarted', processingStarted);
			ss.event.off('hp.processingCompleted', processingCompleted);
			ss.event.off('ipdb.processingStarted', processingStarted);
			ss.event.off('ipdb.processingCompleted', processingCompleted);
		})

	}]);

};


$(document).ready(function() {
	return false;



	/*
	 * bottom actions
	 */

	// enable sync hyperpin button
	var syncHyperPin = function() {
		processing('#hpsync');
		var labels = [];
		[$('.nodata button'), $('#hpsync button')].forEach(function(btn) {
			labels.push(btn.find('span').html());
			btn.attr('disabled', 'disabled');
			btn.find('.icon.refresh').addClass('spin');
			btn.find('span').html('Syncing...');
		});

		var limit = $('select.numrows').val();
		var offset = ($('.pagination ul').data('page') - 1) * limit;

		api('HyperPin.Sync', { limit: limit, offset: offset }, function(err, result) {
			processed('#hpsync');
			if (err) {
				alert('Problem Syncing: ' + err);
			} else {
				[$('.nodata button'), $('#hpsync button')].forEach(function(btn) {
					btn.removeAttr('disabled');
					btn.find('.icon.refresh').removeClass('spin');
					btn.find('span').html(labels.shift());
				});
				scope.$broadcast('paramsUpdated');
			}
		});
	};

	// enable sync ipdb button
	var syncIPDB = function() {
		processing('#ipdbsync');
		var limit = $('select.numrows').val();
		var offset = ($('.pagination ul').data('page') - 1) * limit;

		api('Pind.FetchIPDB', { limit: limit, offset: offset }, function(err, result) {
			processed('#ipdbsync');
			if (err) {
				alert('Problem Syncing: ' + err);
			} else {
				scope.$broadcast('paramsUpdated');
			}
		});
	};

	// enable download missing roms button
	var downloadRoms = function() {
		processing('#dlrom');

		api('Pind.FetchMissingRoms', { }, function(err, result) {
			processed('#dlrom');
			if (err) {
				alert('Problem Syncing: ' + err);
			} else {
				console.log('Downloaded ROMs: ' + result.filepaths);
				scope.$broadcast('paramsUpdated');
			}
		});
	};

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
