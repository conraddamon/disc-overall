/**
 * Functions to help with display of tournament or player results.
 */

/**
 * Tournament page launch function. Tournament ID comes from HTML page.
 *
 * @param {string} tournamentId    tournament ID
 */
function initializeTournament(tournamentId) {

    window.tournamentId = String(tournamentId);

    // handle event link click
    $('.pageLink').click(pageLinkClicked);
	
    // handle change in division
    $('#divisionSelect,#poolSelect').change(function(e) {
	    showPage(window.curPage);
	});

    window.qs = parseQueryString();

    loadInitialData(showPage.bind(null, window.qs.page || 'players'));
}

/**
 * Player page launch function. Tournament ID comes from HTML page.
 *
 * @param {string} playerId        player ID
 * @param {string} tournamentId    tournament ID
 */
function initializePlayer(playerId, tournamentId) {

    window.playerPageId = String(playerId);
    window.tournamentId = String(tournamentId);

    loadInitialData(showPlayerPage);
}

/**
 * Grab the data we'll need before we can get started.
 *
 * {function} callback     function to call when all the data has been received
 */
function loadInitialData(callback) {

    // send the set of requests for data that we need to get going; the requests are not dependent on each
    // other, so are sent in parallel
    var getTournament = sendRequest('get-tournament', { tournamentId: window.tournamentId }),
        getEvents = sendRequest('get-event', { tournamentId: window.tournamentId }),
        getPlayers = sendRequest('load-player', { tournamentId: window.tournamentId, getName: true });

    var requests = [ getTournament, getEvents, getPlayers ],
        callbacks = [ handleTournamentInfo, saveEvents, handleNameInfo ];

    // once we have data, we can show a page
    sendRequests(requests, callbacks).then(getTeamInfo).then(callback);
}

/**
 * Sets up the division select now that we know what divisions are offered.
 *
 * @param {object} data    tournament data
 */
function handleTournamentInfo(data) {

    var td = window.tournamentData = data;
    populateDivisionSelect(td.divisions);
    if (data.pools) {
        $('.poolSelect').show();
        populatePoolSelect(data.pools, true);
    }
    if (data.junior_scoring_separate == 1) {
	delete DIV_MATCH['O']['OJ'];
	delete DIV_MATCH['W']['WJ'];
    }
    for (var param in window.qs) {
	window.tournamentData[param] = window.qs[param];
    }
}

function getTeamInfo() {

    var requests = [], callbacks = [];
    TEAM_EVENTS.forEach(function(event) {
	    var eventId = window.eventData[event] && window.eventData[event].id;
	    if (eventId) {
		requests.push(sendRequest('get-teams', { eventId: eventId }));
		callbacks.push(handleTeamInfo);
	    }
	});

    return sendRequests(requests, callbacks);
}

/**
 * User has selected a page from the link bar.
 *
 * @param {string} page    event name, or 'players'
 */
function showPage(page, data) {

    if (page === 'export') {
	exportResults();
	return;
    }

    // ignore data if it's the jQuery data struct
    if (data && $.isArray(data) && typeof data[0] === 'string') {
	data = null;
    }

    var needAllOption = (page === 'players');
    var hasAllOption = $('#divisionSelect option[value="ALL"]').get().length > 0;
    if (needAllOption && !hasAllOption) {
	$('#divisionSelect').prepend(new Option('All', 'ALL'));
	$('#divisionSelect').val($('#divisionSelect option:first').val());
    }
    else if (!needAllOption && hasAllOption) {
	$('#divisionSelect option[value="ALL"]').remove();
    }
    window.curDivision = getDivision();

    // current selection is underlined
    $('#' + window.curPage).removeClass('current');
    $('#' + page).addClass('current');

    window.curPage = page;
    window.curEventId = window.eventData && window.eventData[page] && window.eventData[page].id;

    if (!window.playerPageId) {
	$('#content').html('');
    }

    // reset sorting for new page
    window.sortColumn = null;
    window.reverseSort = false;

    var divNumPlayers;

    switch(page) {

    case 'players': {
	divNumPlayers = showRegisteredPlayers();
	break;
    }

    case 'scf': {
	showScf(data);
	break;
    }

    case 'overall': {
	showOverall(data);
	break;
    }

	//    default: showResults(page, window.resultData);
    default: showResults(page);

    }

    setSubtitle(divNumPlayers);

    if (page !== 'players') {
	TEAM_EVENTS.forEach(event => {
		$('#' + event + 'TeamHeader').text('');
		$('#' + event + 'TeamContainer').text('');
	    });
    }
}

/**
 * Sets a header so it's clear what results are being shown.
 */
function setSubtitle(divNumPlayers) {

    if (window.playerPageId) {
	$('#subtitle').text(window.playerData[window.playerPageId].name);
    }
    else {
	var division = getDivision(),
	    divText = getDivisionAdjective(division),
	    event = capitalizeEvent(window.curPage);

	var extra = '';
	if (divNumPlayers != null) {
	    var totalPlayers = Object.keys(window.playerData).length;
	    extra = ' (' + divNumPlayers + ' / ' + totalPlayers + ')';
        }
	
	$('#subtitle').text(divText + ' ' + event + extra);
	const note = window.eventData[window.curEvent] && window.eventData[window.curEvent].note;
	$('#note').text(note || '');
    }
}

/**
 * Shows a list of players in each division.
 */
function showRegisteredPlayers() {

    if (!window.playerData) {
	$('#content').append("There are no players registered for this tournament.");
	return;
    }

    var division = getDivision(),
	pool = getPool();

    var players = Object.values(window.playerData).filter(player => player.name.indexOf('Player') !== 0 && divisionMatch(playerData[player.id].division, division));

    if (pool) {
	players = players.filter(player => player.pool === pool);
    }

    if (!players.length) {
	var msg = "There are no players registered in the " + getDivisionAdjective(division) + " division";
	if (pool) {
	    msg += " in the " + pool + " pool";
	}
	msg += ".";
	$('#content').append(msg);
	return;
    }

    $('#content').append(showPlayers(players, { showIndexes: true, showDivisions: false }));

    $('.playerListTable .playerName').click(goToPlayerPage);

    TEAM_EVENTS.forEach(event => {
	    const teamIds = Object.keys(window.teamData[event]);
	    if (teamIds && teamIds.length > 0) {
		$('#' + event + 'TeamHeader').text(capitalizeEvent(event) + ' Teams');
		const teams = Object.values(window.teamData[event]).filter(team => {
			const divs = [ window.playerData[team.player1].division, window.playerData[team.player2].division ];
			if (team.player3 !== '0') {
			    divs.push(window.playerData[team.player3].division);
			}
			const teamDivision = getTeamDivision(divs);
			return window.curDivision === 'ALL' || window.curDivision === teamDivision || DIV_MATCH[window.curDivision][teamDivision];
		    });
		$('#' + event + 'TeamContainer').html(showPlayers(teams, { numCols: 3, showIndexes: true, showDivisions: false }));
	    }
	});

    return players.length;
}

/**
 * Shows the results for a single event.
 *
 * @param {string} event    event name
 */
function showResults(event, data) {

    window.curEvent = event;

    if (data) {
	gotResults(event, data);
    }
    else {
	sendRequest('get-results', { event: event, eventId: window.curEventId, sort: 'round' }, gotResults.bind(null, event));
    }
}

/**
 * Displays overall results.
 *
 * @param {Array} data     (optional) list of results
 */
function showOverall(data) {

    if (data) {
	showOverallResults(data);
    }
    else {
	sendRequest('get-results', { tournamentId: window.tournamentId, sort: 'round' }, showOverallResults);
    }
}

/**
 * Processes results by displaying them.
 *
 * @param {string} event    event name
 * @param {Array}  data     (optional) list of results
 */
function gotResults(event, data) {

    data = filterResultsByDivision(data, getDivision());
    data = filterResultsByPool(data, getPool());
    window.resultData = data;

    if (!data || !data.length) {
	$('#content').append('No results have been recorded yet.');
	return;
    }

    // see if there's a reason to show hundredths
    checkDecimal(data);

    var tableId = !window.playerPageId ? 'resultsTable' : 'resultsTable-' + event,
	html = '<table class="resultsTable" id="' + tableId + '"></table>',
	contentElId = window.playerPageId ? 'player-' + event : 'content';

    $('#' + contentElId).append(html);
    $('#' + tableId).append(getResultsHeader());

    displayResults();

    if (!window.playerPageId) {
	$('#resultsTable th span').click(sortResults);
    }
}

/**
 * Returns a header for a non-overall event. The header is a table row.
 */
function getResultsHeader() {

    var event = window.curEvent,
	division = getDivision(),
	rounds = getRoundsByDivision(event, division),
	isRankScoring = window.eventData[event].rank_scoring === '1',
	numCumulative = getRoundsByDivision(event, division, true);

    var playerHeader = !window.playerPageId ? '<th id="result_player"><span class="pageLink">Player</span></th>' : '',
	divHeader = !window.playerPageId && window.tournamentData.show_division ? '<th id="result_div"><span class="pageLink">Div</span></th>' : '',
	html = '<tr><th id="result_place"><span class="pageLink">Place</span></th>' + playerHeader + divHeader;

    if (!isRankScoring) {
	for (var round = 1; round <= rounds; round++) {
	    if (event === 'scf') {
		html += '<th id="result_mta_round' + round + '"><span class="pageLink">MTA</span></th>';
		html += '<th id="result_trc_round' + round + '"><span class="pageLink">TRC</span></th>';
	    }
	    html += '<th id="result_round' + round + '"><span class="pageLink">' + getRoundName(event, round) + '</span></th>';
	    if (round === numCumulative) {
		html += '<th id="result_total"><span class="pageLink">Total</span></th>';
	    }
	}
    }
    html += '</tr>';

    return html;
}

/**
 * Returns a list of table rows representing the current result data.
 *
 * @param {string} column    column to sort by
 */
function displayResults(column='place') {

    var event = window.curEvent,
	isRankScoring = window.eventData[event].rank_scoring === '1',
	resultInfo = getSortedResults(window.resultData, event);

    if (!resultInfo) {
	return;
    }

    if (!window.playerPageId) {
	// current sort header is underlined
	$('#resultsTable span.current').removeClass('current');
	$('#result_' + column + ' span').addClass('current');
    }

    // create a result row for each player/team
    var playerIds = resultInfo.playerIds,
	scoreData = resultInfo.scoreData,
	playerData = isTeamEvent(event, getDivision()) ? window.teamData[event] : window.playerData;

    if (!scoreData) {
	return;
    }

    // internal compare function that handles players or teams, with place as secondary sort key
    function compareByDivisionThenPlace(a, b) {

	if (!isTeamEvent(event)) {
	    var result = compareByDivision(playerData[a], playerData[b]);
	    return result !== 0 ? result : scoreData[a].rank - scoreData[b].rank;
	}

        // Sort two teams according to their strongest divisional player. A team with three players will always sort 
        // ahead of a team with two players.
	var teamA = window.teamData[curEvent][a];
	var teamB = window.teamData[curEvent][b];

	var divOrdersA = [teamA.player1, teamA.player2, teamA.player3].map(p => window.playerData[p] ? DIV_ORDER.indexOf(window.playerData[p].division) : -1).sort();
	var divOrdersB = [teamB.player1, teamB.player2, teamB.player3].map(p => window.playerData[p] ? DIV_ORDER.indexOf(window.playerData[p].division) : -1).sort();

	for (var i = 0; i < 3; i++) {
	    if (divOrdersA[i] !== divOrdersB[i]) {
		return divOrdersA[i] - divOrdersB[i];
	    }
	}
	
	return scoreData[a].rank - scoreData[b].rank;
    }

    if (column === 'place') {
	playerIds.sort((a, b) => scoreData[a].rank - scoreData[b].rank);
    }
    else if (column === 'player') {
	playerIds.sort((a, b) => compareNames(getName(a), getName(b)));
    }
    else if (column === 'div') {
	playerIds.sort(compareByDivisionThenPlace);
    }
    else if (column.indexOf('round') === 0) {
	let round = column.substr(-1, 1);
	playerIds.sort((a, b) => compareScores(scoreData[a][round], scoreData[b][round]));
    }
    else if (column === 'total') {
	playerIds.sort((a, b) => compareScores(scoreData[a].totalSort, scoreData[b].totalSort));
    }
    else if (IS_SCF_EVENT[column.substr(0, 3)]) {
	let scfEvent = column.substr(0, 3),
	    round = column.substr(-1, 1);

	let scfEventResultInfo = getSortedResults(scfData[scfEvent], scfEvent),
	    scfEventScoreData = scfEventResultInfo.scoreData;

	playerIds = scfEventResultInfo.playerIds,
	playerIds.sort((a, b) => compareScores(scfEventScoreData[a][round], scfEventScoreData[b][round]));
    }

    if (column === window.sortColumn) {
	window.reverseSort = !window.reverseSort;
    }
    if (window.reverseSort) {
	playerIds.reverse();
    }
    window.sortColumn = column;

    var html = '',
	division = getDivision(),
	rounds = getRoundsByDivision(event, division),
	numCumulative = getRoundsByDivision(event, division, true),
	tableId = !window.playerPageId ? 'resultsTable' : 'resultsTable-' + event,
	table = $('#' + tableId).get(0);

    playerIds.forEach(function(playerId, index) {

	    // if we're showing a player, skip everyone else
	    if (window.playerPageId) {
		if (isTeamEvent(event)) {
		    var teamMembers = getTeamMembers(window.teamData[event][playerId]);
		    if (teamMembers.indexOf(window.playerPageId) === -1) {
			return;
		    }
		}
		else if (playerId !== window.playerPageId) {
		    return;
		}
	    }

	    var rowHtml = '',
		name = getName(playerId),
		info = scoreData[playerId],
		row = table.rows[index + 1] || table.insertRow();

	    var div = '';

	    rowHtml += '<tr><td>' + info.rank + '</td>';
	    rowHtml += !window.playerPageId ? '<td>' + name + '</td>' : '';
	    if (window.tournamentData.show_division) {
		if (isTeamEvent(event)) {
		    teamMembers = getTeamMembers(window.teamData[event][playerId]);
		    var teamDivs = teamMembers.map(p => window.playerData[p].division);
		    div = teamDivs.join('/');
		}
		else {
		    div = window.playerData[playerId].division;
		}
		rowHtml += !window.playerPageId ? '<td>' + div + '</td>' : '';
	    }

	    if (!isRankScoring) {
		for (var round = 1; round <= rounds; round++) {
		    if (event === 'scf') {
			SCF_EVENTS.forEach(function(scfEvent) {
				var result = window.scfData[scfEvent].find(res => res.player_id == playerId && res.round == round),
				    score = result ? formatScore(result.score, scfEvent) : '-';

				rowHtml += '<td>' + score + '</td>';
			    });
		    }
		    rowHtml += '<td>' + formatScore(info[round]) + '</td>';
		    if (round === numCumulative) {
			var cumTotal = 0;
			for (var i = 1; i <= numCumulative; i++) {
			    cumTotal += Math.max(info[i] || 0, 0);
			}
			//rowHtml += '<td>' + formatScore(info.total) + '</td>';
			rowHtml += '<td>' + formatScore(cumTotal) + '</td>';
		    }
		}
	    }
	    rowHtml += '</tr>';
	    row.innerHTML = rowHtml;
	});
}

/**
 * Calculates overall points for each event and shows them for each overall player.
 *
 * @param {Array} data     list of results
 */
function showOverallResults(data) {

    if (!data) {
	$('#content').html("No results found.");
	return;
    }

    // a score of SCR (-2) does not count for overall points (unless they should be considered to have tied)
    if (window.tournamentData.scoring_scratches === 'revert') {
        data = data.filter(result => result.score != -2);
    }

    // transform results so each result is individual
    data = flattenResults(data);
    data = filterResultsByDivision(data, getDivision(), false);

    if (window.eventData.overall && window.eventData.overall.rank_scoring == '1') {
	showOverallPlaces(data);
	return;
    }

    // if we have SCF, calculate those results from MTA and TRC and add them to our data
    if (window.eventData['scf']) {
	window.scfData = {};
	SCF_EVENTS.forEach(function(scfEvent) {
		var scfEventId = window.eventData[scfEvent].id;
		// pull out MTA or TRC data
		window.scfData[scfEvent] = data.filter(result => result.event_id === scfEventId);
		// and remove it from our main result list
		data = data.filter(result => result.event_id !== scfEventId);
	    });
	// add generated SCF results to our main list
	mergeArray(data, getScfData());
    }

    // figure out which players qualify for the overall by having played a minimum number of events
    var playerEvents = {};
    data.forEach(function(result) {
	    var hash = playerEvents[result.player_id] = playerEvents[result.player_id] || {};
	    hash[result.event_id] = true;
	});

    var overallPlayerIds = Object.keys(playerEvents).filter(playerId => Object.keys(playerEvents[playerId]).length >= window.tournamentData.min_events),
	overallPlayerIdHash = toLookupHash(overallPlayerIds),
	overallPointsByEvent = window.overallPointsByEvent = {},
	overallPointsByPlayer = window.overallPointsByPlayer = {},
	events = normalizeEvents(Object.keys(window.eventData));

    data = data.filter(result => !!overallPlayerIdHash[result.player_id]);

    // calculate overall points for each event
    events.forEach(function(event) {

	    overallPointsByEvent[event] = {};
	    window.curEvent = event;

	    // filter results to include just overall players for this event
	    var eventResults = data.filter(result => result.event_id === window.eventData[event].id),
		resultInfo = getSortedResults(eventResults, event);

	    if (resultInfo && resultInfo.playerIds && resultInfo.playerIds.length) {

		// we need to know about non-participants if they split points
		if (window.tournamentData.scoring_dns === 'tie' || window.tournamentData.scoring === 'place') {
		    var nonParticipants = overallPlayerIds.filter(id => !resultInfo.scoreData[id]),
			numParticipants = resultInfo.playerIds.length;

		    nonParticipants.forEach(function(id) {
			    resultInfo.playerIds.push(id);
			    resultInfo.scoreData[id] = { rank: numParticipants + 1, dns: true };
			});
		}
		overallPointsByEvent[event] = getOverallPoints(resultInfo, event, overallPlayerIds.length);

		for (var playerId in overallPointsByEvent[event]) {
		    overallPointsByPlayer[playerId] = overallPointsByPlayer[playerId] || 0;
		    overallPointsByPlayer[playerId] += overallPointsByEvent[event][playerId];
		}
	    }
	});

    createOverallHeader(events);

    // ship it!
    displayOverallResults();

    // add sort handlers
    $('#overallResultsTable th span').click(sortResults);
}

function createOverallHeader(events) {

    // create the results table and its header row
    var playerHeader = !window.playerPageId ? '<th id="overall_player"><span class="pageLink">Player</span></th>' : '',
	divHeader = !window.playerPageId && window.tournamentData.show_division ? '<th id="overall_div"><span class="pageLink">Div</span></th>' : '',
	html = '<table class="resultsTable" id="overallResultsTable"><tr><th id="overall_place"><span class="pageLink">Place</span></th>' + playerHeader + divHeader;

    events.forEach(function(event) {
	    html += '<th id="overall_' + event + '"><span class="pageLink">' + capitalizeEvent(event) + '</span></th>';
	});
    if (events.length > 0) {
	html += '<th id="overall_total"><span class="pageLink">Total</span></th></tr>';
    }
    html += '</table>';

    $('#content').append(html);
}

function showOverallPlaces(data) {

    var event = window.curEvent = 'overall',
	overallResults = data.filter(result => result.event_id === window.eventData[event].id),
	resultInfo = getSortedResults(overallResults, event);

    createOverallHeader([]);

    var table = $('#overallResultsTable').get(0);

    // create a result row for each overall player
    resultInfo.playerIds.forEach(function(playerId, index) {

	    if (window.playerPageId && window.playerPageId !== playerId) {
		return;
	    }
	    
	    var html = '',
		name = window.playerData[playerId].name,
		row = table.rows[index + 1] || table.insertRow();

	    html += '<td>' + resultInfo.scoreData[playerId].rank + '</td>';
	    if (!window.playerPageId) {
		html += '<td>' + name + '</td>';
	    }
	    if (window.tournamentData.show_division) {
		html += !window.playerPageId ? '<td>' + window.playerData[playerId].division + '</td>' : '';
	    }

	    row.innerHTML = html;
	});
}

/**
 * Returns only the results that should be considered for overall points.
 *
 * @param {Array}  data      a list of results
 * @param {string} event     event name
 */
function getOverallResultsByEvent(data, event) {

    return data.filter(function(result) {
	    // we only want results for this event
	    if (result.event_id !== window.eventData[event].id) {
		return false;
	    }
	    // make sure only overall players are included
	    return !!idHash[result.player_id];
	});
}

/**
 * Displays overall results sorted by the given column.
 *
 * @param {string} column    column to sort on (defaults to 'place')
 */
function displayOverallResults(column='place') {

    // internal compare function that uses place as secondary sort key
    function compareByDivisionThenPlace(a, b) {
	var result = compareByDivision(playerData[a], playerData[b]);
	return result !== 0 ? result : window.overallPointsByPlayer[b] - window.overallPointsByPlayer[a];
    }

    // current sort header is underlined
    if (!window.playerPageId) {
	$('#overallResultsTable span.current').removeClass('current');
	$('#overall_' + column + ' span').addClass('current');
    }

    var playerIds = Object.keys(window.overallPointsByPlayer);

    // store overall ranks
    var overallRank = {},
	curPlace = 1,
        curPoints = -1;

    playerIds.sort((a, b) => window.overallPointsByPlayer[b] - window.overallPointsByPlayer[a]);
    playerIds.forEach(function(playerId, index) {
	    var points = window.overallPointsByPlayer[playerId];
	    if (points !== curPoints) {
		curPlace = index + 1;
	    }
	    overallRank[playerId] = curPlace;
	    curPoints = points;
	});

    // sort players based on column
    if (column === 'place' || column === 'total') {
	playerIds.sort((a, b) => window.overallPointsByPlayer[b] - window.overallPointsByPlayer[a]);
    }
    else if (column === 'player') {
	playerIds.sort((a, b) => compareNames(window.playerData[a].name, window.playerData[b].name));
    }
    else if (column === 'div') {
	playerIds.sort(compareByDivisionThenPlace);
    }
    else {
	playerIds.sort((a, b) => (window.overallPointsByEvent[column][b] || 0) - (window.overallPointsByEvent[column][a] || 0));
    }

    if (window.tournamentData.scoring === 'place' && column !== 'player') {
	playerIds = playerIds.reverse();
    }

    if (column === window.sortColumn) {
        window.reverseSort = !window.reverseSort;
    }
    if (window.reverseSort) {
        playerIds.reverse();
    }
    window.sortColumn = column;

    var events = normalizeEvents(Object.keys(window.eventData)),
	table = $('#overallResultsTable').get(0);

    // create a result row for each overall player
    playerIds.forEach(function(playerId, index) {

	    if (window.playerPageId && window.playerPageId !== playerId) {
		return;
	    }
	    
	    var html = '',
		name = window.playerData[playerId].name,
		row = table.rows[index + 1] || table.insertRow(),
		points = window.overallPointsByEvent[column] ? window.overallPointsByEvent[column][playerId] || 0 : window.overallPointsByPlayer[playerId];

	    html += '<td>' + overallRank[playerId] + '</td>';
	    if (!window.playerPageId) {
		html += '<td>' + name + '</td>';
	    }
	    if (window.tournamentData.show_division) {
		html += !window.playerPageId ? '<td>' + window.playerData[playerId].division + '</td>' : '';
	    }

	    events.forEach(function(event) {
		    html += '<td>' + (window.overallPointsByEvent[event][playerId] || '0') + '</td>';
		});

	    html += '<td>' + window.overallPointsByPlayer[playerId].toFixed(2) + '</td>';
	    row.innerHTML = html;
	});
}

/**
 * This function is super-important.
 *
 * Analyzes a set of results and returns data about it. The primary task is to determine the order in
 * which to rank players based on scores. A score in a later round is better than any score in an
 * earlier round. We also need to handle events that have cumulative rounds. If we have scores for
 * all an event's cumulative rounds, calculate an additional result with the total score. Note that
 * the results are ordered by round.
 *
 * @param {Array}  data      a list of results
 * @param {string} event     event name
 *
 * @return {object} scoring data
 */
function getSortedResults(data, event) {

    if (!data || !data.length) {
	return {};
    }

    // figure out how many rounds we have results for, and get a list of player IDs that have results
    var numRounds = Math.max.apply(Math, data.map(result => result.round)),
	division = getDivision(),
	isRankScoring = window.eventData && window.eventData[event] && window.eventData[event].rank_scoring === '1',
	numRounds = getRoundsByDivision(event, division),
	numCumulative = getRoundsByDivision(event, division, true),
	playerIds = uniquify(data.map(result => result.player_id)),
	scoreData = {};

    // generate score data: number of rounds per player, latest round, and total if event is cumulative
    data.forEach(function(result) {

	    let p = result.player_id,
		round = Number(result.round),
		score = Number(result.score || 0);

	    scoreData[p] = scoreData[p] || {};
	    scoreData[p][round] = score;
	    scoreData[p].numRounds = scoreData[p].numRounds || 0;

	    if (score > -2) {
		scoreData[p].numRounds++;
		scoreData[p].latest = Math.max(scoreData[p].latest || 0, round, numCumulative < numRounds ? numCumulative : -1);
	    }

	    let adjScore = score;
	    const lowerIsBetter = LOWER_IS_BETTER[event] || isRankScoring;
	    if (score < 0) {
		adjScore = lowerIsBetter ? score * -1000 : score * 1000;
	    }

	    if (round <= numCumulative) {
		scoreData[p].total = (scoreData[p].total || 0) + Math.max(score, 0);
		scoreData[p].totalSort = (scoreData[p].totalSort || 0) + adjScore;
	    }
	    else {
		scoreData[p].total = Math.max(score, 0);
		scoreData[p].totalSort = adjScore;
	    }
	});

    // sort by score; a score in a later round beats any score from a previous round
    playerIds.sort(function(a, b) {

	    let latestA = scoreData[a].latest,
		latestB = scoreData[b].latest;

	    // latest round played is primary sort key
	    if (latestA && latestB && latestA !== latestB) {
		return latestB - latestA;
	    }

	    // score is secondary sort key
	    let scoreA = (!latestA || (latestA <= numCumulative)) ? scoreData[a].totalSort :  scoreData[a][latestA],
		scoreB = (!latestB || (latestB <= numCumulative)) ? scoreData[b].totalSort :  scoreData[b][latestB];

	    let cmp = compareScores(scoreA, scoreB);
	    return cmp === 0 ? compareNames(getName(a), getName(b)) : cmp;
	});

    // assign ranks
    var curRound, curScore, curRank;
    playerIds.forEach(function(playerId, index) {
	    
	    let latest = scoreData[playerId].latest,
		//score = latest ? scoreData[playerId][latest] : scoreData[playerId].totalSort,
		score = scoreData[playerId].totalSort,
		numRounds = scoreData[playerId].numRounds;

	    if ((latest && (latest !== curRound)) || score !== curScore) {
		curRank = index + 1;
	    }
	    scoreData[playerId].rank = curRank;
	    curRound = latest;
	    curScore = score;
	});

    return { numRounds: numRounds,
	     playerIds: playerIds,
	     scoreData: scoreData };
}

/**
 * Calculates overall points for the given event.
 *
 * @param {object} resultInfo       helpful result info
 * @param {string} event            event name
 */
function getOverallPoints(resultInfo, event, numOverallPlayers, countdownBase, noPlayNoPoints) {

    var ranks = {},
	points = {},
        overallPoints = {};

    resultInfo.playerIds.forEach(function(playerId) {
	    var rank = resultInfo.scoreData[playerId].rank;
	    ranks[rank] = ranks[rank] || 0;
	    ranks[rank]++;
	});

    var base,
	rankNums = Object.keys(ranks).map(rank => Number(rank)),
	scoringMethod = window.tournamentData.scoring,
	isPlaceScoring = (scoringMethod === 'place'),
	numPlayers = resultInfo.playerIds.length,
	fullTeamBonus = 0;

    if (countdownBase) {
	base = countdownBase;
    } else if (scoringMethod === 'countdown') {
        base = getCountdownBaseByDivision(getDivision());
    }
    else if (scoringMethod === 'countup') {
	base = resultInfo.playerIds.length;
    }

    // if we're awarding full points to the team event winners, up the base
    var fullTeamScoring = isTeamEvent(event) && window.tournamentData['scoring_team'] === 'full';
    if (fullTeamScoring) {
	var fullTeamSize = Object.keys(resultInfo.scoreData).filter(playerId => resultInfo.scoreData[playerId].rank == 1).length;
	fullTeamBonus = 0.5 * (fullTeamSize - 1);
    }
    base += fullTeamBonus;

    rankNums.forEach(function(rank) {
	    let pts = 0,
		num = ranks[rank];
	
	    if (num) {
		for (var i = 0; i < num; i++) {
		    if (isPlaceScoring) {
			pts += (Number(rank) + i) - fullTeamBonus;
		    }
		    else {
			pts += Math.max((base - (Number(rank) + i - 1)), 0);
		    }
		}
		points[rank] = parseFloat((pts / num).toFixed(2));
	    }
	});

    resultInfo.playerIds.forEach(function(playerId) {
	    if (isPlaceScoring && window.tournamentData.scoring_dns === 'none' && resultInfo.scoreData[playerId].dns) {
		overallPoints[playerId] = numOverallPlayers + 1;
	    }
	    else {
		const score = resultInfo.scoreData[playerId];
		overallPoints[playerId] = Math.max(points[score.rank], 0);
		if (noPlayNoPoints && score[score.latest] < 0) {
		    overallPoints[playerId] = score[score.latest];
		}
	    }
	});

    return overallPoints;
}

/**
 * Converts each of the team results into a set of individual results.
 *
 * @param {Array} results     list of results
 */
function flattenResults(results) {

    results = results || [];

    var flattened = [],
	division = getDivision();

    var hasMixed = {};
    TEAM_EVENTS.forEach(event => hasMixed[event] = hasMixedTeam(event, division));

    let testFunc = isWomenDivision() ? isWomenDivision : isJuniorDivision;

    results.forEach(function(result) {
	    var event = window.eventById[result.event_id].name,
		teamEvent = isTeamEvent(event);
	    
	    if (teamEvent) {
		var team = window.teamData[event][result.player_id],
		    mixedTeamScoring = hasMixed[event] && window.tournamentData.mixed_team_scoring;

		// mixed team event - see if points are only awarded in Open
		if (mixedTeamScoring === 'none') {
		    return;
		}
	
		if (team) {
		    var members = getTeamMembers(team);

		    // mixed team event - points awarded only if entire team is within division
		    if (mixedTeamScoring === 'division') {
			if (teamIsMixed(team, testFunc)) {
			    return;
			}
		    }

		    members.forEach(function(playerId) {
			    if (window.playerData[playerId] && divisionMatch(window.playerData[playerId].division, division)) {
				var clone = Object.assign({}, result);
				clone.player_id = playerId;
				flattened.push(clone);
			    }
			});
		}
	    }
	    else {
		flattened.push(result);
	    }
	});

    return flattened;
}

/**
 * Handles a click on a sortable column header in an event or overall results table.
 *
 * @param {Event} e    browser event
 */
function sortResults(e) {

    var id = $(this).closest('th').prop('id'),
	isOverall = id.indexOf('overall') === 0,
	column = id.replace('overall_', '').replace('result_', '');

    if (!column) {
	return;
    }

    if (isOverall) {
	displayOverallResults(column);
    }
    else {
	displayResults(column);
    }
}

/**
 * Special-purpose function to show SCF results since they must be calculated from MTA and TRC.
 */
function showScf() {

    var division = getDivision(),
	isRankScoring = window.eventData.scf.rank_scoring === '1',
	requests,
	callbacks;

    if (isRankScoring) {
	const scfRequest = sendRequest('get-results', { event: 'scf', eventId: window.eventData.scf.id, sort: 'score' });
	requests = [ scfRequest ];
	callbacks = [ handleScfResults.bind(null, 'scf') ];
    }
    else {
	var mtaRequest = sendRequest('get-results', { event: 'mta', eventId: window.eventData.mta.id, sort: 'round' }),
	    trcRequest = sendRequest('get-results', { event: 'trc', eventId: window.eventData.trc.id, sort: 'round' });

	requests = [ mtaRequest, trcRequest ];
	callbacks = [ handleScfResults.bind(null, 'mta'), handleScfResults.bind(null, 'trc') ];
    }

	
    sendRequests(requests, callbacks).then(showScfResults);
}

/**
 * Stores results of an SCF event.
 *
 * @param {string} event     SCF event name (MTA or TRC)
 * @param {Array}  data      a list of results
 */
function handleScfResults(event, data) {

    data = filterResultsByDivision(data, getDivision());
    window.scfData = window.scfData || {};
    window.scfData[event] = data || {};
}

/**
 * Calculates SCF scores and returns them as results data. Relies on having MTA and TRC results available.
 */
function showScfResults() {

    var isRankScoring = window.eventData.scf.rank_scoring === '1';
    var scfData = isRankScoring ? window.scfData.scf : getScfData();

    window.curEvent = 'scf';
    gotResults('scf', scfData);
}

/**
 * Creates SCF result objects by combining MTA and TRC scores.
 */
function getScfData() {

    // get data references
    var mtaData = window.scfData.mta,
	trcData = window.scfData.trc,
	scfData = [];

    // figure how how many rounds' worth of data we have
    var numRounds = Math.max(Math.max.apply(Math, mtaData.map(result => result.round)),
			     Math.max.apply(Math, trcData.map(result => result.round)));

    // get a list of all the players with an SCF result
    var playerIds = mtaData.map(result => result.player_id),
	trcPlayerIds = trcData.map(result => result.player_id);

    mergeArray(playerIds, trcPlayerIds);
    playerIds = uniquify(playerIds).sort((a, b) => Number(a) - Number(b));

    // calculate the SCF result for each player in each round
    for (var round = 1; round <= numRounds; round++) {
	playerIds.forEach(function(playerId) {
		var mtaResult = mtaData.find(result => result.round == round && result.player_id == playerId),
		    trcResult = trcData.find(result => result.round == round && result.player_id == playerId),
		    mtaScore = mtaResult && mtaResult.score > 0 ? Number(mtaResult.score) : 0,
		    trcScore = trcResult && trcResult.score > 0 ? Number(trcResult.score) : 0,
		    scfScore = (mtaScore * 5.5) + trcScore;

		if (mtaResult || trcResult) {
		    // take best of SCR/NC
		    if (scfScore === 0) {
			scfScore = Math.max(mtaResult ? mtaResult.score : -2, trcResult ? trcResult.score : -2);
		    }
		    var scfResult = {
			event_id: window.eventData.scf.id,
			player_id: playerId,
			round: round,
			score: scfScore
		    }
		    scfData.push(scfResult);
		}
	    });
    }

    return scfData;
}

/**
 * Takes the user to the player page for the clicked player.
 */
function goToPlayerPage(e) {

    var id = $(this).closest('[data-id]').data('id');
    window.location = "player.html?id=" + id + (window.qs.test ? '&test' : '');
}

function hasMixedTeam(event, division) {

    if (tournamentData.mixed_team.indexOf(event) === -1) {
	return false;
    }

    division = division || getDivision();
    let isWomen = isWomenDivision(division),
	isJunior = isJuniorDivision(division);

    if (!isWomen && !isJunior) {
	return false;
    }

    let testFunc = isWomen ? isWomenDivision : isJuniorDivision,
	hasMixed = false;

    for (let teamId in window.teamData[event]) {
	if (teamIsMixed(window.teamData[event][teamId], testFunc)) {
	    hasMixed = true;
	    break;
	}
    }

    return hasMixed;
}

function teamIsMixed(team, testFunc) {

    let playerIds = getTeamMembers(team),
	hasDivMember = playerIds.findIndex(id => testFunc(window.playerData[id].division)) !== -1,
	hasOtherMember = playerIds.findIndex(id => !testFunc(window.playerData[id].division)) !== -1;

    return hasDivMember && hasOtherMember;
}

/**
 * Exports the current results as a PDF file.
 */
function exportResults() {

    var tableId = 'resultsTable';
    if (window.curPage === 'overall') {
	tableId = 'overallResultsTable';
    }
    else if (window.curPage === 'players') {
	tableId = 'playerListTable';
    }

    if ($('#' + tableId + ' tr').length === 0) {
	showNotification("No results to export");
	return;
    }

    var doc = new jsPDF(),
	elem = $('#' + tableId).get(0),
	res = doc.autoTableHtmlToJson(elem);

    var title = $('.title').text() + ': ' + $('#subtitle').text(),
	fileName = title.replace("'s", '').replace(/[^\w]+/g, '-') + '.pdf';

    doc.text(title, 14, 16);
    doc.autoTable(res.columns, res.data, { startY: 20, theme: 'grid' });
    doc.setProperties({ title: title });
    doc.save(fileName);
}



/***************************************/
/*     player.html                     */
/***************************************/

/**
 * Displays a results page for a single player. Since we want to show what place they got in each event,
 * we need all the results.
 */
function showPlayerPage() {

    setSubtitle();

    var td = window.tournamentData;
    document.title = td.start.substr(0, td.start.indexOf('-')) + ' ' + td.name + ': ' + window.playerData[window.playerPageId].name;

    sendRequest("get-results", { tournamentId: window.tournamentId, sort: 'round' }, gotPlayerResults);
}

/**
 * Displays player result data. Uses most of the code to display tournament results, which varys
 * in places based on window.playerPageId.
 *
 * @param {Array}  data      a list of results
 */
function gotPlayerResults(data) {

    var player = playerData[window.playerPageId],
	events = normalizeEvents(Object.keys(window.eventData));

    // for filtering results
    window.division = player.division.substr(0, 1);

    var flattenedResults = flattenResults(data),
	playerResults = flattenedResults.filter(result => result.player_id == window.playerPageId),
	playerEventResults = {},
	hasScf = events.indexOf('scf') !== -1;

    if (playerResults) {
	playerResults.forEach(result => {
		if (result.score > -2) {
		    let event = window.eventById[result.event_id].name;
		    if (hasScf && IS_SCF_EVENT[event]) {
			event = 'scf';
		    }
		    playerEventResults[event] = true;
		}
	    });
    }
    else {
	$('#content').html("No results found.");
    }

    events = events.filter(event => !!playerEventResults[event]);
    if (events.length >= window.tournamentData['min_events']) {
	events.unshift('overall');
    }

    events.forEach(function(event) {

	    window.curEvent = event;
	    window.curEventId = window.eventData && window.eventData[event] && window.eventData[event].id;

	    // filter the results to just include the event
	    var eventId = window.curEventId,
		eventData = (event !== 'overall') ? data.filter(result => result.event_id === eventId) : data,
		eventLink = "tournament.html?id=" + window.tournamentId + "&page=" + event;
	       
	    // show a little header (can't use a single table since events have different rounds)
	    var extra = isTeamEvent(event) ? ' (with ' + getPartners(window.playerPageId, event) + ')' : '',
		html = '<div class="eventTitle" id="player-' + event + '"><a href="' + eventLink + '">' + capitalizeEvent(event) + extra + '</a></div>';
	    $('#content').append(html);

  	    showPage(event);
        });
}
