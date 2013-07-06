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

	$scope.statusIcon = $scope.upgrade.status == 'success' ? 'ok' : 'remove';
	$scope.fromVersion = $scope.upgrade.result.updatedFrom ? $scope.upgrade.result.updatedFrom.version : 'n/a';
	$scope.toVersion = $scope.upgrade.result.updatedTo ? $scope.upgrade.result.updatedTo.version : 'n/a';

	$element.find('span[data-toggle="tooltip"]').tooltip();
}

pindAppModule.filter('githubRange', function() {
	return function(result) {
		var from = result.fromSha.substr(0, 7);
		var to = result.toSha.substr(0, 7);
		return '<a href="https://github.com/' + result.repo + '/compare/' + from + '...' + to + '" target="_blank" class="tt">' + from + '...' + to + '</a>';
	}
});