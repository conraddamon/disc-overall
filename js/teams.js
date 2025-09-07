/**
 * Functions to help the TD create teams for the team events (DDC and freestyle).
 */

/**
 * Launch function. Arguments provided by HTML page.
 *
 * @param {string} tournamentId          tournament ID
 * @param {string} ddcEventId            ID of DDC event
 * @param {string} freestyleEventId      ID of freestyle event
 * @param {string} freestyleTeamSize     '2', '3', or '2,3'
 */
function initializeTeams(tournamentId, ddcEventId, freestyleEventId, freestyleTeamSize) {

    document.title = $('div.title').text() + ': Assign Teams';

    if (!ddcEventId && !freestyleEventId) {
	$('#content').text("There are no team events for this tournament.");
	return;
    }

    // save important stuff in global scope
    window.tournamentId = tournamentId;
    window.eventId = {};
    window.eventId.ddc = ddcEventId;
    window.eventId.freestyle = freestyleEventId;
    window.freestyleTeamSize = freestyleTeamSize || '';

    setupNotification();
    $('.pageLink').click(pageLinkClicked);

    // handle change in division
    $('#divisionSelect, #showAll').change(function(e) {
            showPage(window.curEvent, true);
        });

    // send the set of requests for data that we need to get going; the requests are not dependent on each
    // other, so are sent in parallel
    var getTournament = sendRequest('get-tournament', { tournamentId: tournamentId }),
        getPlayers = sendRequest('load-player', { tournamentId: window.tournamentId, getName: true });

    var requests = [ getTournament, getPlayers ],
        callbacks = [ handleTournamentInfo, handleNameInfo ];

    // once we have data, we can show a page
    sendRequests(requests, callbacks).then(showPage.bind(null, $('.pageLink:first').prop('id')));
}

/**
 * Sets up the division select now that we know what divisions are offered.
 *
 * @param {object} data    tournament data
 */
function handleTournamentInfo(data) {

    window.tournamentData = data;
    // if we have Open and Women, just use those
    let divisions = data.divisions.split(',').filter(div => div === 'O' || div === 'W');
    if (divisions.length < 2) {
	divisions = data.divisions.split(',');
    }
    populateDivisionSelect(divisions.join(','));
}

/**
 * Handles selection of team event by showing its players and teams.
 *
 * @param {string}  event      event name
 * @param {boolean} force      if true, go ahead and re-display current page
 */
function showPage(event, force) {

    if (event === 'refresh') {
	refreshPlayers();
	return;
    }

    if (window.loaded && event === window.curEvent && !force) {
	return;
    }
    window.loaded = true;

    // remember current event
    window.curEvent = event;
    window.curEventId = window.eventId[event];

    setSubtitle();

    // show helpful text if three-player teams are allowed
    if (event === 'freestyle' && window.freestyleTeamSize.indexOf('3') !== -1) {
	$('#threePlayerTeamText').show();
    }
    else {
	$('#threePlayerTeamText').hide();
    }

    // show the "show all" checkbox if mixed teams are allowed
    if (window.tournamentData.mixed_team.indexOf(event) !== -1) {
	$('#showAllContainer').show();
    }
    else {
	$('#showAllContainer').hide();
    }

    // get list of teams for this event
    var callback = showPlayersAndTeams.bind(null, event, Object.values(window.playerData));
    sendRequest('get-teams', { eventId: window.curEventId }, callback);
}

/**
 * Sets a header so it's clear what teams are being assigned.
 */
function setSubtitle() {

    var division = getDivision(),
        divText = getDivisionAdjective(division),
	event = capitalizeEvent(window.curEvent);

    $('#subtitle').text('Assign teams for ' + divText + ' ' + event);
}

/**
 * Displays the unteamed players and the current teams. The page only handles one event at
 * a time, so collisions are not a concern. The data is fetched each time.
 *
 * @param {string} event      event name
 * @param {object} players    tournament players 
 * @param {object} teams      teams in this event (from db)
 */
function showPlayersAndTeams(event, players, teams) {

    players = players || [];
    teams = teams || [];
    window.teamData = {};
    window.teamData[event] = window.teamData[event] || {};

    var division = getDivision();
    if (!$('#showAll').is(':checked')) {
	players = players.filter(player => playerDivisionMatch(player.id, division));
	teams = teams.filter(team => teamDivisionMatch(team, division));
    }

    // create a hash of teamed players
    var playerTeamed = {};
    teams.forEach(function(team) {
	    var teamPlayers = getTeamMembers(team).map(function(id) {
		    playerTeamed[id] = true;
		    return playerData[id] && playerData[id].name;
		});

	    // fill out team with team name, division; teams are sorted by whichever member is first alphabetically
	    window.teamData[event][team.id] = team;
	    team.name = getTeamName(teamPlayers);
	    team.division = playerData[team.player1] && playerData[team.player1].division;
	    createTeamElId(team);
	});

    // get a list of the unteamed players
    var unteamedPlayerList = players.filter(function(player) {
	    return !playerTeamed[player.id];
	});

    // add dummy player for partnerless players
    const dummy = {
	division: getDivision(),
	id: DUMMY_PLAYER_ID,
	name: DUMMY_PLAYER_NAME,
	tournament_id: window.tournamentId,
    };
    unteamedPlayerList.push(dummy);

    // header for team section
    var eventName = capitalizeEvent(event);
    $('#teamHeader').text(eventName + " Teams");

    // show the players and teams
    $('#playerContainer').html(showPlayers(unteamedPlayerList, { showIndexes: false, showDivisions: false }));
    showTeams(event);
    $('#teamContainer').disableSelection();
    $('#teamContainer').dblclick(removeTeam);

    // set up drag and drop; an unteamed player is both draggable and a drop target
    var threesAllowed = (event === 'freestyle' && window.freestyleTeamSize.indexOf('3') !== -1);
    $('#playerContainer span').draggable({
	        containment: threesAllowed ? '#playersAndTeamsContainer' : '#playerContainer',
		cursor: 'move',
		revert: 'invalid',
		snap: true,
		snapTolerance: 10,
		scroll: true // doesn't seem to be working :(
	    });

    $('#playerContainer span').droppable({
	    drop: handlePlayerDrop.bind(null, event)
	});

    if (threesAllowed) {
	$('#teamContainer span').droppable({
		drop: handlePlayerDrop.bind(null, event)
		    });
    }
}

function showTeams(event) {

    $('#teamContainer').html(showPlayers(Object.values(window.teamData[event]), { numCols: 3, showIndexes: true, showDivisions: false }));
    highlightIncompleteTeams(event);
}

/**
 * Give the team TD a DOM ID based on the team ID.
 */
function createTeamElId(team) {
    team.elId = [ 'team', team.id ].join('-');
}

/**
 *  If freestyle is 3-player teams, highlight 2-player teams so user knows they're incomplete.
 */
function highlightIncompleteTeams(event) {

    if (event === 'freestyle' && window.freestyleTeamSize == 3) {
	for (var teamId in window.teamData.freestyle) {
	    var team = window.teamData.freestyle[teamId];
	    if (team.player3 == 0) {
		$('#team-' + teamId).css('color', '#CC3300');
	    }
	}
    }
}

/**
 * An unteamed player has been dropped onto another unteamed player. Team them up.
 *
 * @param {string} event    event name
 * @param {Event}  e        browser event
 * @param {object} ui       event data from jQuery DnD
 */
function handlePlayerDrop(event, e, ui) {

    var source = $(ui.draggable).closest('td'),
        sourceId = source.data('id'),
	sourceIsDummy = sourceId == DUMMY_PLAYER_ID;

    if (!window.playerData[sourceId] && !sourceIsDummy) {
	return;
    }

    var sourceName = window.playerData[sourceId].name,
	target = $(e.target).closest('td'),
	targetElId = $(target).prop('id'),
	targetId = $(target).data('id'),
	targetIsDummy = targetId == DUMMY_PLAYER_ID,
	isTeamTarget = targetElId.indexOf('team') === 0;

    // remove both players from list of unteamed players
    if (!sourceIsDummy) {
	source.html('');
    }
    if (!isTeamTarget && !targetIsDummy) {
	target.html('');
    }

    var teamPlayerIds = [ sourceId ];
    if (isTeamTarget) {
	var team = window.teamData[event][targetId];
	teamPlayerIds.push(team.player1, team.player2);
    }
    else {
	teamPlayerIds.push(targetId);
    }

    var teamPlayerNames = teamPlayerIds.map(id => playerData[id] ? playerData[id].name : '').sort(compareNames),
	team = {
	    eventId: window.curEventId,
	    player1: teamPlayerIds[0],
	    player2: teamPlayerIds[1],
	    player3: teamPlayerIds[2] || '0',
	    name: getTeamName(teamPlayerNames)
        };

    if (isTeamTarget) {
	team.elId = targetElId;
	var callback = teamUpdated.bind(null, team, targetId, sourceName, event);
	sendRequest('update-team', { player: sourceId, teamId: targetId }, callback);
    }
    else {
	sendRequest('add-team', team, teamAdded.bind(null, team, event));
    }
}

/**
 * A team has been added - update the teams list.
 *
 * @param {string} team    team details
 * @param {string} event   event name
 * @param {string} teamId  DB ID of team row
 */
function teamAdded(team, event, teamId) {

    team.id = teamId;
    createTeamElId(team);

    // update our global data
    window.teamData[event][teamId] = team;

    // re-display the team list
    showTeams(event);
    $('#' + team.elId).data('id', teamId);
    var threesAllowed = (window.curEvent === 'freestyle' && window.freestyleTeamSize.indexOf('3') !== -1);
    if (threesAllowed) {
        $('#teamContainer span').droppable({
                drop: handlePlayerDrop.bind(null, event)
                    });
    }

    showNotification('Team of ' + team.name + ' added to ' + capitalizeEvent(window.curEvent));
}

/**
 * A team has had a third player added.
 *
 * @param {string} team    team details
 * @param {string} teamId  DB ID of team row
 * @param {string} player  player that was added
 * @param {string} event   event name
 */
function teamUpdated(team, teamId, player, event) {

    team.id = teamId;
    createTeamElId(team);

    // update our global data
    window.teamData[event][teamId] = team;

    // re-display the team list
    showTeams(event);
    $('#' + team.elId).data('id', teamId);

    showNotification(player + ' is now part of the ' + team.name + ' team for ' + capitalizeEvent(window.curEvent));
}

/**
 * Removes the team entry from the DB.
 *
 * @param {Event} e    browser event
 */
function removeTeam(e) {

    var teamId = $(e.target).closest('td').prop('id');
    if (teamId) {
	teamId = teamId.replace('team-', '');
	sendRequest('remove-team', { eventId: window.curEventId, teamId: teamId }, teamRemoved.bind(null, teamId));
    }
}

/**
 * After a team has been removed, re-display the teams list.
 */
function teamRemoved(teamId) {

    var team = window.teamData[window.curEvent][teamId];
    if (team) {
	showNotification('Team of ' + team.name + ' removed from ' + capitalizeEvent(window.curEvent));
    }
    showPage(window.curEvent, true);
}

/**
 * Reload the player list in order to refresh available players.
 */
function refreshPlayers() {

    sendRequest('load-player', { tournamentId: window.tournamentId, getName: true }, handleRefresh)
}

function handleRefresh(data) {

    handleNameInfo(data);

    // get list of teams for this event
    var callback = showPlayersAndTeams.bind(null, window.curEvent, Object.values(window.playerData));
    sendRequest('get-teams', { eventId: window.curEventId }, callback);
}
