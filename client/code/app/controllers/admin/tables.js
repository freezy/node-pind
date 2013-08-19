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

		$scope.fetchhs = function(event) {
			event.target.blur();
			rpc('pind.fetchHiscores');
		};


		// ------------------------------------------------------------------------
		// data mapping
		// ------------------------------------------------------------------------

		$scope.mapperFn = function(table) {

			if (table.name && table.year && table.manufacturer) {
				table.title = (table.name_match ? table.name_match : table.name) + ' (' + table.manufacturer + ' ' + table.year + ')';
			} else if (table.hpid) {
				table.title = table.hpid;
			} else if (table.name && table.year) {
				table.title = (table.name_match ? table.name_match : table.name) + ' (' + table.year + ')';
			} else if (table.name) {
				table.title = (table.name_match ? table.name_match : table.name);
			} else {
				table.title = '<i>Not Available</i>';
			}

			table.badge_table = table.table_file ? 'success' : 'important';
			table.badge_rom = table.rom_file ? 'success' : table.rom_file === null ? null : 'important';
			table.badge_media_wheel = table.media_wheel ? 'success' : 'important';
			table.badge_media_backglass = table.media_backglass ? 'success' : 'important';
			table.badge_media_table = table.media_table ? 'success' : 'important';
			table.badge_media_video = table.media_video ? 'success' : 'important';
			table.hpicon = table.hpenabled ? 'hplogo.svg' : 'hplogo-grey.svg';
			table.hpiconclass = table.hpenabled ? 'hplogo-enabled' : 'hplogo-disabled';

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
		// real time code
		// ------------------------------------------------------------------------


		// hp processing completed
		var processingCompleted = function() {
			$scope.$broadcast('paramsUpdated');
		};

		// hook up events
		ss.event.on('hp.processingCompleted', processingCompleted);

		// cleanup on destruction
		$scope.$on('$destroy', function() {
			ss.event.off('hp.processingCompleted', processingCompleted);
		});

		// ------------------------------------------------------------------------
		// status handling
		// ------------------------------------------------------------------------

		$scope.registerEvents({
			hpsync:   [ 'hp.processingStarted', 'hp.processingCompleted' ],
			ipdbsync: [ 'ipdb.processingStarted', 'ipdb.processingCompleted' ],
			dlrom:    [ 'vpm.processingStarted', 'vpm.processingCompleted' ],
			dlmedia:  [ 'vpf.processingStarted', 'vpf.processingCompleted' ],
			fetchhs:  [ 'hiscore.processingStarted', 'hiscore.processingCompleted' ]
		});

	}]);

};