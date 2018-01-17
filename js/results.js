/*
 * Functions to help with the entry of results. The results for the event and round will be displayed.
 */

/**
 * Launch function. Tournament ID comes from HTML page.
 *
 * @param {string} tournamentId    tournament ID
 */
function initializeResults(tournamentId) {

    document.title = $('div.title').text() + ': Enter Results';

    // global storage
    window.tournamentId = tournamentId;
    window.result = [];
    window.resultMap = {};

    window.curEvent = $('.pageLink:first').prop('id');

    setupNotification();

    // handle event link click
    $('.pageLink').click(pageLinkClicked);

    // handle Enter key
    $('#score').on('keyup', keyHandler);

    // handle change in division, pool, or round number
    $('#divisionSelect,#poolSelect,#roundSelect').change(function(e) {
	    setSubtitle();
	    showResults();
	});

    // adjust rounds if division changes
    $('#divisionSelect').change(function(e) {
	    populateRoundSelect(window.curEvent, getDivision());
	});


    // send the set of requests for data that we need to get going; the requests are not dependent on each
    // other, so are sent in parallel
    var getTournament = sendRequest('get-tournament', { tournamentId: tournamentId }),
	getEvents = sendRequest('get-event', { tournamentId: window.tournamentId }),
	getPlayers = sendRequest('load-player', { tournamentId: window.tournamentId, getName: true }),
	getRecords = sendRequest('get-records');

    var requests = [ getTournament, getEvents, getPlayers, getRecords ],
	callbacks = [ handleTournamentInfo, handleEventInfo, handleNameInfo, handleRecordData ];

    // once we have data, we can show a page
    sendRequests(requests, callbacks).then(showPage.bind(null, window.curEvent));
}

/**
 * Returns the currently selected round number.
 *
 * @return {string} round number
 */
function getRound() {
    return $('#roundSelect').val();
}

/**
 * Sets a header so it's clear what results are being entered/displayed.
 */
function setSubtitle() {

    var division = getDivision(),
	divText = getDivisionAdjective(division),
	round = getRound(),
	event = capitalizeEvent(window.curEvent);

    $('#subtitle').text('Results for ' + getRoundName(window.curEvent, round) + " of " + divText + " " + event);
}

/**
 * Sets up the division select to show Open and/or Women only.
 *
 * @param {object} data    tournament data
 */
function handleTournamentInfo(data) {

    window.tournamentData = data;
    var divs = [ 'O', 'W' ];
    if (data.junior_scoring_separate == 1) {
	divs.push('OJ');
	divs.push('WJ');
    }
    populateDivisionSelect(data.divisions.split(',').filter(div => divs.includes(div)).join(','));
    if (data.pools) {
	$('.poolSelect').show();
	populatePoolSelect(data.pools, true);
    }
}

/**
 * Saves event data and gets teams for the team events that the tournament includes.
 *
 * @param {object} data    tournament event data
 */
function handleEventInfo(data) {

    if (!data) {
	return;
    }

    saveEvents(data);

    // go get the teams for the team events; requests sent in parallel
    var teamEvents = Object.keys(IS_TEAM_EVENT),
	requests = teamEvents.map(function(event) {
		return sendRequest('get-teams', { eventId: getEventId(event) });
	    });

    sendRequests(requests, [ handleTeamInfo, handleTeamInfo ]);
}

/**
 * Sets up autocomplete in one of two ways, for either individual or team events. Assumes that player
 * and team name data has been loaded.
 */
function setupAutocomplete() {

    var event = window.curEvent,
	isTeamEvent = IS_TEAM_EVENT[event],
	nameList = getNameList(isTeamEvent ? window.teamData[event] : window.playerData),
	rejectFunc = rejectAutocomplete.bind(null, isTeamEvent);

    addNameAutocomplete(nameList, isTeamEvent ? matchTeam : null, rejectFunc, null, isTeamEvent ? 'team' : 'player');
}

/**
 * Match function for teams. It checks only the last names.
 *
 * @param {string} str    letters typed in by user
 * @param {string} team   team name to check against
 *
 * @return {boolean} true if the string match the given team
 */
function matchTeam(str, team) {

    var str = str.toLowerCase(),
	players = team.split(' / '),
	last = players.map(function(name) {
		var idx = getNameSplitIndex(name);
		return idx !== -1 ? name.substr(idx + 1) : name;
	    }),
	matches = last.filter(function(name) {
		return name.toLowerCase().indexOf(str) === 0;
	    });

    return matches.length > 0;
}

/**
 * Returns true if the given player should be included in autocomplete matches.
 *
 * @param {boolean} isTeamEvent    if true, current event is team event
 * @param {string"  player         player or team name
 */
function rejectAutocomplete(isTeamEvent, player) {

    var event = window.curEvent,
	dataMap = isTeamEvent ? window.teamData[event] : window.playerData,
	idMap = isTeamEvent ? window.teamId[event] : window.playerId,
	playerId = idMap[player],
	division = getDivision(),
	round = getRound(),
	eventId = getEventId(),
	showAll = $('#showAll').is(':checked');

    // check division
    if (isTeamEvent) {
	if (!teamDivisionMatch(window.teamData[event][playerId], division) && !showAll) {
	    return true;
	}
    }
    else {
	if (!playerDivisionMatch(playerId, division)) {
	    return true;
	}
    }

    // see if result has already been entered
    return window.result.findIndex(function(res) {
	    return res.player_id === playerId && res.round === round && res.event_id === eventId;
	}) !== -1;
}

/**
 * Displays a small form for entering scores for one round of an event, and shows what has been
 * entered so far.
 *
 * @param {string} event    event name
 */
function showPage(event) {

    if (event === 'refresh') {
	refreshPlayers();
	return;
    }

    // don't re-display current event
    if (window.loaded && event === window.curEvent) {
	return;
    }
    window.loaded = true;

    // underline current choice in links bar
    $('#' + window.curEvent).removeClass('current');
    $('#' + event).addClass('current');
    window.curEvent = event;

    setupAutocomplete();
    populateRoundSelect(window.curEvent, getDivision());
    setSubtitle();

    var hint = (event === 'mta' || event === 'trc') ? 'SCR = scratch, 0 = no catch' : 'SCR = scratch, DNF = did not finish';
    $('.hint').text(hint);

    $('#player').val('');
    $('#team').val('');
    $('#score').val('');

    // show either the player or team name entry box as appropriate
    var isTeamEvent = IS_TEAM_EVENT[event],
	scoreLabel = 'Score:';

    if (isTeamEvent) {
	$('#playerDiv').hide();
	$('#teamDiv').show();
	$('#team').focus();
	scoreLabel = "Place:";
    }
    else {
	$('#playerDiv').show();
	$('#teamDiv').hide();
	$('#player').focus();
    }

    if (IS_TIMED_EVENT[event]) {
	scoreLabel = 'Time:';
    }
    $('#scoreLabel').text(scoreLabel);

    // show the "show all" checkbox if mixed teams are allowed
    if (window.tournamentData.mixed_team.indexOf(event) !== -1) {
	$('#showAllContainer').show();
    }
    else {
	$('#showAllContainer').hide();
    }

    showResults(event);
}

/**
 * Displays the results that have been entered so far for one round of the current event.
 *
 * @param {string} event    event name
 */
function showResults(event) {

    event = event || window.curEvent;

    $('#results').html('');

    var eventId = getEventId(),
	round = getRound();

    sendRequest('get-results', { event: event, eventId: eventId, round: round }, handleResults);

    if (IS_TEAM_EVENT[event]) {
	$('#team').focus();
    }
    else {
	$('#player').focus();
    }
}

/**
 * Processes result data and hands it off for display. Only the current round of results is shown.
 *
 * @param {object} data    event results
 */
function handleResults(data) {

    data = data || [];
    data = filterResultsByPool(data, getPool());
    data = filterResultsByDivision(data, getDivision());
    data.sort(compareResults);

    // see if there's a reason to show hundredths
    checkDecimal(data);
    
    // show this result
    data.forEach(function(result) {
	    addResultRow(result);
	});
}

/**
 * Displays a single result by showing the player and their score.
 *
 * @param {object} result    result details
 * @param {int}    index     (optional) index at which to insert the new row
 */
function addResultRow(result, index) {

    // update global data
    window.result.push(result);
    window.resultMap[result.id] = result;

    // store results for non-current event, but don't display them
    if (result.event_id !== getEventId()) {
	return;
    }

    // player could be a person or a team
    var html = '',
	event = window.curEvent,
	isTeamEvent = IS_TEAM_EVENT[event],
	divClass = isTeamEvent ? 'teamName' : 'playerName';

    // got a score with decimals, switch that event to decimals mode
    if ((event === 'distance' || event === 'trc') && result.score % 1 !== 0) {
	USE_DECIMAL[event] = true;
    }

    var event = window.eventById[result.event_id].name,
	playerId = isTeamEvent ? teamData[event][result.player_id].player1 : result.player_id,
	division = window.playerData[playerId].division,
	currentRecord = window.recordData[event] && window.recordData[event][division];

    var isRecord = currentRecord && Number(result.score) >= Number(currentRecord.score);

    // create the row
    html += '<li data-resultid=' + result.id + '>';
    html += '<div class="dataCell ' + divClass + '"><span class="nameSpan">' + getName(result.player_id) + '</span></div>';
    html += '<div class="dataCell">' + formatScore(result.score) + '</div>';
    if (isRecord) {
	html += '<div class="dataCell record">World record for ' + DIV_NAME[division] + '!</div>';
	// update internal record but don't save to DB
	window.recordData[event][division] = { person_id: window.playerData[result.player_id].person_id, score: result.score };
    }
    html += '</li>';

    // jquery lacks indexed insertion, so we have to do this
    if (index === 0) {
        $('#results').prepend(html);
    }
    else if (index == null || index === -1) {
        $('#results').append(html);
    }
    else {
        $('#results').children().eq(index - 1).after(html);
    }

    $('li[data-resultid="' + result.id + '"] span').dblclick(removeResult);
}

/**
 * Returns the sort position for the given result, within the currently displayed results.
 *
 * @param {object} result    result details
 *
 * @return sort position (-1 means to append)
 */
function getResultSortIndex(result) {

    var index = -1;
    $('li[data-resultid]').each(function(idx, el) {
	    var resultId = el.dataset.resultid,
		result1 = window.resultMap[resultId];

	    if (compareResults(result, result1) < 0) {
		index = idx;
		return false;
	    }
	});

    return index;
}

function removeResult(e) {

    var resultId = $(this).closest('li').data('resultid');
    if (resultId > 0) {
	sendRequest('remove-result', { resultId: resultId }, handleResultRemoval.bind(null, resultId));
    }
}

function handleResultRemoval(resultId) {

    $('li[data-resultid="' + resultId + '"]').remove();

    var result = window.resultMap[resultId],
	event = window.curEvent,
	playerData = IS_TEAM_EVENT[event] ? window.teamData[event] : window.playerData,
	player = playerData[result.player_id].name;

    // remove this result from our list so it's eligible for autocomplete
    var resIdx = window.result.findIndex(function(res) {
	    return res.player_id === result.player_id && res.round === result.round && res.event_id === result.event_id;
	});
    
    if (resIdx !== -1) {
	window.result.splice(resIdx, 1);
    }

    showNotification('Removed result for ' + player + ' in ' + capitalizeEvent(event));
}

/**
 * Checks for Enter key in the score input. That adds the score to the database and the results below.
 *
 * @param {Event} e    browser event
 */
function keyHandler(e) {

    if (e.keyCode === 13) {
	if (this.id === 'score') {
	    addScore();
	}
        e.preventDefault();
    }
}

/**
 * Adds a score to the database and displays it in the results.
 */
function addScore() {

    var event = window.curEvent,
	isTeamEvent = IS_TEAM_EVENT[event],
	eventId = getEventId(),
	round = getRound(),
	input = $('#' + (isTeamEvent ? 'team' : 'player')),
	scorer = input.val(),
	scorerId = isTeamEvent ? window.teamId[event][scorer] : window.playerId[scorer],
	rawScore = $('#score').val().trim(),
	min, sec;

    // do nothing if user accidentally hit Enter without typing in a score
    if (!rawScore) {
	return;
    }

    // check for numeric score (or SCR or DNF)
    if (!$.isNumeric(rawScore) && event !== 'discathon' && [ 'SCR', 'DNF', 'NC' ].indexOf(rawScore.toUpperCase()) === -1) {
	showNotification('Error: ' + rawScore + ' is not a valid score.');
	return;
    }	

    // player value should always come from autocomplete; make sure they didn't type in something random
    if (!scorerId) {
	showNotification('Error: ' + scorer + (isTeamEvent ? ' is not a known team' : ' is not registered') + ' in this tournament');
	return;
    }

    // check for SCR or DNF
    if (rawScore.toUpperCase() === 'SCR') {
	rawScore = '-2';
    }
    if (rawScore.toUpperCase() === 'DNF' || rawScore.toUpperCase() === 'NC') {
	rawScore = '-1';
    }

    // create result object
    var score = unformatScore(rawScore),
	result = {
	    player_id: scorerId,
	    event_id: eventId,
	    round: round,
	    score: score
        };

    // clear inputs
    input.val('');
    $('#score').val('');
    input.focus();

    // update database
    var callback = showAddedScore.bind(null, result, rawScore, scorer);
    sendRequest('add-result', { eventId: eventId, playerId: scorerId, round: round, score: score }, callback);

    // update player pool if appropriate
    var pool = getPool(),
	playerData = IS_TEAM_EVENT[event] ? window.teamData[event] : window.playerData,
	playerPool = pool && playerData[scorerId].pool;

    if (pool && !isTeamEvent && pool != playerPool) {
	sendRequest('set-pool', { playerId: scorerId, pool: pool }, function() {
		window.playerData[scorerId].pool = pool;
	    });
    }
}

/**
 * After a result has been added to the database, add it to the sorted results on the page.
 *
 * @param {object} result     result details
 * @param {string} rawScore   displayable score
 * @param {string} scorer     player or team name
 * @param {int}    id         ID of added result row
 */
function showAddedScore(result, rawScore, scorer, id) {

    showNotification('Score of ' + rawScore + ' recorded for ' + scorer + ' in ' + capitalizeEvent(window.curEvent));

    result.id = id;
    addResultRow(result, getResultSortIndex(result));
}

/**
 * Reload the player list in order to refresh autocomplete.
 */
function refreshPlayers() {

    sendRequest('load-player', { tournamentId: window.tournamentId, getName: true }, handleRefresh)
}

function handleRefresh(data) {

    handleNameInfo(data);
    setupAutocomplete();
}
