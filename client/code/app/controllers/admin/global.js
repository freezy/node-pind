module.exports = function(module) {
	'use strict';

	module.controller('AdminGlobalCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {

		$scope.checkBtnClass = '';
		$scope.checking = false;

		$scope.checkVersionUpdate = function() {
			$scope.checkBtnClass = 'spin';
			$scope.checking = true;
			$scope.rpc('pind.getAvailableUpdate', {}, function(version) {
				$scope.checkBtnClass = '';
				$scope.checking = false;
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
				$scope.$apply();
			});
		};

		$scope.updatePind = function() {
			rpc('pind.updatePind', { sha: $scope.updateShaFull });
		};

		var refresh = function() {
			$scope.version = $scope.status.version.version.toUpperCase();
			$scope.date = $scope.status.version.dateSince;
			$scope.sha = $scope.status.version.sha.substr(0, 8);
			$scope.url = $scope.status.version.url;
			//$scope.$apply();
			$scope.$broadcast('paramsUpdated');
		};

		$scope.statusReady(refresh);

		ss.server.on('reconnect', refresh);
		$scope.$on('$destroy', function() {
			ss.server.off('reconnect', refresh);
		});

	}]);


	module.controller('AdminUpgradeRowCtrl', ['$scope', '$element', function($scope, $element) {
		$scope.fromVersion = $scope.upgrade.result.updatedFrom ? $scope.upgrade.result.updatedFrom.version : 'n/a';
		$scope.toVersion = $scope.upgrade.result.updatedTo ? $scope.upgrade.result.updatedTo.version : 'n/a';

		// commits
		if ($scope.upgrade.result.commits && $scope.upgrade.result.commits.length > 0) {
			var durationMs = new Date($scope.upgrade.result.commits[0].date).getTime() - new Date($scope.upgrade.result.commits[$scope.upgrade.result.commits.length - 1].date).getTime();
			var durationSecs = Math.round((durationMs) / 3600000) * 3600
			$scope.commitInfo = $scope.upgrade.result.commits.length + ' commits over ' + juration.stringify(durationSecs) + '.';
		} else {
			$scope.commitInfo = '';
		}

		// status
		if ($scope.upgrade.result.errors && $scope.upgrade.result.errors.length > 0) {
			$scope.statusIcon = 'warning-sign';
			$scope.statusInfo = 'Errors while post-processing upgrade'
			$element.find('span.status').attr('data-toggle', 'popover');

		} else if ($scope.upgrade.status == 'success') {
			$scope.statusIcon = 'ok';

			var duration = new Date($scope.upgrade.completedAt).getTime() - new Date($scope.upgrade.startedAt).getTime();
			$scope.statusInfo = 'Successfully updated in ' + juration.stringify(duration / 1000) + '.';
			$element.find('span.status').attr('data-toggle', 'tooltip');
		} else {
			$scope.statusIcon = 'remove';
			$scope.statusInfo = 'Error updating: ' + $scope.upgrade.error.message;
		}

		// settings
		if ($scope.upgrade.result.settings && $scope.upgrade.result.settings.length > 0) {
			var importantSettings = [];
			_.each($scope.upgrade.result.settings, function(setting) {
				setting.warning = '';
				setting.p = '';
				if (setting.important) {
					importantSettings.push(setting);
					setting.warning = '<br><br><div class="alert alert-warning"><i class="icon warning-sign"></i>&nbsp;<strong>Update this setting.</strong> Default value is probably not appropriate.</div>';
				}
				if (setting.parent) {
					setting.p = setting.parent.split(/\./).join(' / ') + ' / ';
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
			$element.find('span[ng-bind-html="settings"]').attr('data-toggle', 'popover');
		} else if ($scope.upgrade.result.settings) {
			$scope.settings = '<i>Nothing new.</i>';
			$scope.settingsInfo = '';
			$scope.newSettings = [];
		} else {
			$scope.settings = '';
			$scope.newSettings = [];
		}

		// deps
		if ($scope.upgrade.result.dependencies) {
			var deps = $scope.upgrade.result.dependencies;
			var t = [];
			var i = [];
			var linkName = function(dep) {
				if (dep.url) {
					dep.linkedName = '<a href="' + dep.url + '" target="_blank">' + dep.name + '</a>';
				} else {
					dep.linkedName = dep.name;
				}
			};
			if (deps.added.length > 0) {
				t.push(deps.added.length + ' added');
				_.each(deps.added, linkName);
			}
			if (deps.updated.length > 0) {
				t.push(deps.updated.length + ' updated');
				_.each(deps.updated, linkName);
			}
			if (deps.removed.length > 0) {
				t.push(deps.removed.length + ' removed');
				_.each(deps.removed, linkName);
			}

			if (t.length > 0) {
				$scope.dependencies = t.join(', ') + '.';
				$element.find('span[ng-bind-html="dependencies"]').attr('data-toggle', 'popover');
			} else {
				$scope.dependencies = '<i>No changes.</i>';
			}

			$scope.dependenciesInfo = 'List here.';

		} else {
			$scope.dependencies = '';
			$scope.dependenciesInfo = '';
		}

		// migrations
		if ($scope.upgrade.result.migrations && $scope.upgrade.result.migrations.length > 0) {
			$scope.migrations = $scope.upgrade.result.migrations.length + ' database migration scripts executed.';
			$scope.migrationsInfo = '';
			_.each($scope.upgrade.result.migrations, function(m) {
				$scope.migrationsInfo += '"' + m.description + '", ';
			});
			$scope.migrationsInfo = $scope.migrationsInfo.substr(0, $scope.migrationsInfo.length - 2);

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
	}]);
};

