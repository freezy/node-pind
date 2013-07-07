$(document).ready(function() {


	//$('.modal.no-update').modal('show');
});

function GlobalCtrl($scope, Jsonrpc) {

	$scope.version;
	$scope.date;
	$scope.url;
	$scope.sha;
	$scope.checkBtnClass = '';
	$scope.checking = false;

	$scope.updateVersion;
	$scope.updateSince;
	$scope.updateAuthor;
	$scope.updateLink;
	$scope.updateSha;
	$scope.updateShaFull;

	$scope.checkVersionUpdate = function() {
		$scope.checkBtnClass = 'spin';
		$scope.checking = true;
		Jsonrpc.call('Pind.GetAvailableUpdate', {}, function(err, version) {
			$scope.checkBtnClass = '';
			$scope.checking = false;
			if (err) {
				return alert('ERROR: ' + err);
			}
			if (version.noUpdates) {
				$('.modal.no-update').modal('show');
			} else {
				$scope.updateVersion = version.version;
				$scope.updateSince = version.dateSince;
				$scope.updateAuthor = version.commit.commit.author.name;
				$scope.updateLink = version.commit.html_url;
				$scope.updateSha = version.commit.sha.substr(0, 8);
				$scope.updateShaFull = version.commit.sha;
				$('.modal.update-found').modal('show');
			}
		});
	};

	$scope.updatePind = function() {
		var waiting = $('.modal.update-progressing');
		waiting.modal({
			show: true,
			keyboard: false,
			backdrop: 'static'
		});
		Jsonrpc.call('Pind.UpdatePind', { sha: $scope.updateShaFull }, function(err, version) {

			waiting.modal('hide');
			if (err) {
				return alert('ERROR: ' + err);
			}
			updateVersion(version);
		});
	};

	Jsonrpc.call('Pind.GetVersion', {}, function(err, version) {
		updateVersion(version);
	});

	function updateVersion(version) {
		$scope.version = version.version.toUpperCase();
		$scope.date = version.dateSince;
		$scope.sha = version.sha.substr(0, 8);
		$scope.url = version.url;
	}
}

function UpgradeRowController($scope, $element) {

	$scope.fromVersion = $scope.upgrade.result.updatedFrom ? $scope.upgrade.result.updatedFrom.version : 'n/a';
	$scope.toVersion = $scope.upgrade.result.updatedTo ? $scope.upgrade.result.updatedTo.version : 'n/a';

	// commits
	if ($scope.upgrade.result.commits) {
		var durationMs = new Date($scope.upgrade.result.commits[0].date).getTime() - new Date($scope.upgrade.result.commits[$scope.upgrade.result.commits.length - 1].date).getTime();
		var durationSecs = Math.round((durationMs) / 3600000) * 3600
		$scope.commitInfo = $scope.upgrade.result.commits.length + ' commits over ' + juration.stringify(durationSecs) + '.';
	} else {
		$scope.commitInfo = '';
	}

	// status
	if ($scope.upgrade.status == 'success') {
		$scope.statusIcon = 'ok';

		var duration = new Date($scope.upgrade.completedAt).getTime() - new Date($scope.upgrade.startedAt).getTime();
		$scope.statusInfo = 'Successfully updated in ' + juration.stringify(duration / 1000) + '.';
	} else {
		$scope.statusIcon = 'remove';
		$scope.statusInfo = 'Error updating: ' + $scope.upgrade.error.message;
	}

	// settings
	if ($scope.upgrade.result.settings && $scope.upgrade.result.settings.length > 0) {
		var importantSettings = [];
		_.each($scope.upgrade.result.settings, function(setting) {
			if (setting.important) {
				importantSettings.push(setting);
				setting.warning = '<br><br><div class="alert alert-warning"><i class="icon warning-sign"></i>&nbsp;<strong>Update this setting.</strong> Default value is probably not appropriate.</div>';
			} else {
				setting.warning = '';
			}
			if (setting.parent) {
				setting.p = setting.parent.split(/\./).join(' / ') + ' / ';
			} else {
				setting.p = '';
			}
			var e = setting.valuetype == 'string' ? '"' : '';
			setting.v = e + setting.value + e;
			setting.d = setting.description ? setting.description.replace(/\n/g, '<br>') : '<i>No description.</i>';

		});
		var importantIcon = '';
		if (importantSettings.length > 0) {
			importantIcon = '<i class="icon warning-sign"></i>&nbsp;';
		}
		$scope.newSettings = $scope.upgrade.result.settings;
		$scope.settings = importantIcon + $scope.upgrade.result.settings.length + ' new setting' + ($scope.upgrade.result.settings.length == 1 ? '' : 's');
		$scope.settingsTitle = 'New Settings';
	} else if ($scope.upgrade.result.settings) {
		$scope.settings = 'none';
		$scope.settingsInfo = '';
		$scope.newSettings = [];
	} else {
		$scope.settings = 'n/a';
		$scope.newSettings = [];
	}

	// deps
	if ($scope.upgrade.result.dependencies) {
		$scope.dependencies = 'none';
		$scope.dependenciesInfo = 'List here.';

	} else if ($scope.upgrade.result.dependencies) {
		$scope.dependencies = 'none';
		$scope.dependenciesInfo = '';
	} else {
		$scope.dependencies = 'n/a';
	}

	// migrations
	if ($scope.upgrade.result.migrations && $scope.upgrade.result.migrations.length > 0) {
		$scope.migrations = $scope.upgrade.result.migrations.length + ' database migration scripts executed.';
		$scope.migrationsInfo = 'List here.';

	} else if ($scope.upgrade.result.migrations) {
		$scope.migrations = 'none';
		$scope.migrationsInfo = '';
	} else {
		$scope.migrations = 'n/a';
	}

	$element.find('span[data-toggle="tooltip"]').tooltip();
	$element.find('span[data-toggle="popover"]').popover({
		html: true,
		placement: 'top',
		content: function() {
			return $(this).next('.popover').html();
		}
	});
}

pindAppModule.filter('githubRange', function() {
	return function(result) {
		var from = result.fromSha.substr(0, 7);
		var to = result.toSha.substr(0, 7);
		return '<a href="https://github.com/' + result.repo + '/compare/' + from + '...' + to + '" target="_blank" class="tt">' + from + '...' + to + '</a>';
	}
});