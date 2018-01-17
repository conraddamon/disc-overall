/**
 * Functions shared by the various overall pages.
 */

// flexible division matching (eg, every GM is also a M)
const DIV_MATCH = {};
DIV_MATCH['O'] = { 'OM':true, 'OGM': true, 'OSGM': true, 'OL': true, 'OJ':true };
DIV_MATCH['OM'] = { 'OGM': true, 'OSGM': true, 'OL': true };
DIV_MATCH['OGM'] = { 'OSGM': true, 'OL': true };
DIV_MATCH['OSGM'] = { 'OL': true };
DIV_MATCH['W'] = { 'WM':true,'WGM': true, 'WSGM': true, 'WL': true, 'WJ': true };
DIV_MATCH['WM'] = { 'WGM': true, 'WSGM': true, 'WL': true };
DIV_MATCH['WGM'] = { 'WSGM': true, 'WL': true };
DIV_MATCH['WSGM'] = { 'WL': true };

// number of columns for displaying a large list of players
const PLAYER_COLUMNS = 5;

// order to present events in
const EVENT_ORDER = [ 'golf', 'distance', 'accuracy', 'scf', 'mta', 'trc', 'discathon', 'ddc', 'freestyle' ];

// indicates in which events a lower score is better; a team event score is a place, so lower is better
const LOWER_IS_BETTER = { 'golf': true, 'discathon': true, 'ddc': true, 'freestyle': true };

const TEAM_EVENTS = [ 'ddc', 'freestyle' ];
const IS_TEAM_EVENT = { 'ddc': true, 'freestyle': true };

const IS_TIMED_EVENT = { 'mta': true, 'discathon': true };

const SCF_EVENTS = [ 'mta', 'trc' ];
const IS_SCF_EVENT = { 'mta': true, 'trc': true };

// which events always show numbers with two decimal places
const USE_DECIMAL = { 'scf': true, 'mta': true };

function normalizeEvents(events) {
    
    if (!events) {
	return [];
    }

    events.sort((a, b) => EVENT_ORDER.indexOf(a) - EVENT_ORDER.indexOf(b));
    if (events.indexOf('scf') !== -1) {
	SCF_EVENTS.forEach(scfEvent => events.splice(events.indexOf(scfEvent), 1));
    }

    return events;
}

/**
 * Displays a list of players in columns, first going from top to bottom, then from
 * left to right.
 *
 * @param {object} data           a list of objects to show; each must have a 'name' property
 * @param {object} options        a hash of options:
 *        {int}        numCols        number of columns to use (default is 5)
 *        {boolean}    showIndexes    if true, show indexes starting with 1
 *        {boolean}    showDivisions  if true, partition players by division
 *
 * @return {string} HTML for player list; each division has a title and a table
 */
function showPlayers(data, options) {

    options = options || {};
    var numCols = options.numCols || PLAYER_COLUMNS,
	showIndexes = options.showIndexes !== false,
	showDivisions = options.showDivisions !== false;

    data = data || [];
    data.sort(function(a, b) {
	    // division is primary sort key
	    if (showDivisions && a.division !== b.division) {
		return DIV_ORDER.indexOf(a.division) - DIV_ORDER.indexOf(b.division);
	    }
	    // name is secondary sort key, can be overridden by 'sortKey' property
	    return compareNames(a.sortKey || a.name, b.sortKey || b.name);
	});

    // divvy players up into divisions
    var divList = {};
    if (showDivisions) {
	for (var i = 0; i < data.length; i++) {
	    var p = data[i],
		div = p.division;
	    
	    divList[div] = divList[div] || [];
	    divList[div].push(p);
	}
    }
    else {
	divList.all = data;
    }
    
    var html = '',
	divisions = showDivisions ? DIV_ORDER : ['all'];

    // show the list of players in each division
    divisions.forEach(function(div) {

	    var list = divList[div],
		count = 0;

	    // Do some math to figure out the index for each player. The data is sequential but the
	    // table layout must be done row by row. For example, the first row for a list of 11 players
	    // would contain players 0, 3, 5, 7, and 9.
	    if (list) {
		numCols = Math.min(numCols, list.length);
		var numRows = Math.ceil(list.length / numCols),
		    numFullRows = Math.floor(list.length / numCols),
		    remainder = list.length % numCols, // number in bottom row if it's not full
		    idx;

		if (showDivisions) {
		    html += "<div class='playerListHeader'>" + DIV_NAME[div] + "</div>";
		}
		html += "<table class='playerListTable' id='playerListTable'>";

		// Find the index for each spot. The first column is easy, it's just the row number. After that,
		// we just bump it up by the number of items in the previous column, which is the number of full
		// rows plus one possible extra item for the first columns in a partial bottom row.
		for (var row = 0; row < numRows; row++) {
		    html += "<tr>";
		    for (var col = 0; col < numCols; col++) {
			if (col === 0) {
			    idx = row;
			}
			else {
			    var num = numFullRows;
			    if (remainder >= col) {
				num++;
			    }
			    idx += num;
			}

			var p = list[idx];
			if (p) {
			    // include optional attributes
			    var idxStr = showIndexes ? (idx + 1) + ". " : '',
				idStr = p.elId ? " id='" + p.elId + "'" : '',
				dataIdStr = p.id ? " data-id='" + p.id + "'" : '',
				dataDivStr = showDivisions && p.division ? " data-division='" + p.division + "'" : '';

			    html += "<td" + idStr + dataIdStr + dataDivStr + ">" + idxStr + "<span class='playerName'>" + p.name + "</span></td>";
			    count++;
			}
			else {
			    html == "<td></td>";
			}
			if (count >= list.length) {
			    break;
			}
		    }
		    html += "</tr>";
		}
		html += "</table>";
	    }
	});

    return html;
}

/**
 * Convert an event code to its display version.
 *
 * @param {string} event    an overall event
 * 
 * @return {string} displayable event name
 */
function capitalizeEvent(event) {

    return event.length === 3 ? event.toUpperCase() : capitalize(event);
}

/**
 * Creates a team name from a list of players. They're put in alphabetical order by last name and connected with a slash.
 * If there are more than two players, last names are used.
 *
 * @param {string} player    player name(s)
 *
 * @return {string} team name
 */
function getTeamName(players) {

    players.sort(compareNames);
    if (players.length > 2) {
	players = players.filter(p => !!p).map(function(name) {
		var idx = getNameSplitIndex(name);
		return last = idx !== -1 ? name.substr(idx + 1) : name
	    });
    }

    return players.join(' / ');
}

/**
 * Returns either a player or a team name, depending on the event.
 *
 * @param {string} id     player or team ID
 * @param {string} event  event name
 */
function getName(id, event) {

    event = event || window.curEvent;
    var playerData = IS_TEAM_EVENT[event] ? window.teamData[event] : window.playerData,
	player = playerData[id];

    return player ? player.name : '';
}

/**
 * Positions the notification element just under the tournament location.
 */
function setupNotification() {

    var base = $('.location');
    if (!base || !base.length) {
	base = $('div.title');
    }

    if (base && base.length) {
	$('.notification').css('top', $(base).position().top + $(base).height());
	$('.notification').css('left', 0);
    }
}

/**
 * Displays and fades a message about something that just happened.
 *
 * @param {string} text     message
 * @param {string} elId     (optional) DOM ID of element that contains message
 */
function showNotification(text, elId='notification') {

    var el = $('#' + elId);

    $(el).show();
    $(el).text(text);
    $(el).fadeOut(3000);
}

/**
 * Stores event info in the global scope
 *
 * @param {object} data    event data
 */
function saveEvents(data) {

    // store event data in global scope                                                                                
    window.eventData = {};
    window.eventById = {};
    data.forEach(function(event) {
            window.eventData[event.name] = window.eventById[event.id] = event;
        });
}

/**
 * Compares two event scores. The possible values for a score, from worst to best, are:
 *
 *     -2 (SCR), -1 (DNF or NC), 0, any positive number
 *
 * Note: window.curEvent must be set for this to work correctly
 *
 * @param {Number} scoreA     a score
 * @param {Number} scoreB     a score
 *
 * @return 1 if the first score is better, -1 if the second score is better, or 0 if they are equivalent
 */
function compareScores(scoreA, scoreB, event) {

    // absence of a score is always worse
    if (scoreA == null || scoreB == null) {
	return scoreA == scoreB ? 0 : scoreA == null ? 1 : -1;
    }

    // check for SCR/DNF/NC; we can't just use math because lower might be better

    // -2 is SCR (scratch)
    if (scoreA === -2 || scoreB === -2) {
	return scoreA === scoreB ? 0 : scoreA === -2 ? 1 : -1;
    }

    // -1 is DNF (did not finish) or NC (no catch)
    if (scoreA === -1 || scoreB === -1) {
	return scoreA === scoreB ? 0 : scoreA === -1 ? 1 : -1;
    }

    return LOWER_IS_BETTER[window.curEvent] ? scoreA - scoreB : scoreB - scoreA;
}

/**
 * Compares two results objects by score. Name is the secondary key.
 *
 * @param {object} a     result details
 * @param {object} b     result details
 *
 * @return 0 if equal, 1 if a is bigger, -1 if b is bigger
 */
function compareResults(a, b) {

    var cmp = compareScores(Number(a.score), Number(b.score));
    return cmp === 0 ? compareNames(getName(a.player_id), getName(b.player_id)) : cmp;
}

/**
 * Adds options to a division <select>.
 *
 * @param {string}   divisions    comma-separated list of division codes
 * @param {string}   selectId     DOM ID of division <select>
 */
function populateDivisionSelect(divisions, selectId='divisionSelect') {

    divisions = divisions || '';
    var divs = divisions.split(/\s*,\s*/);
    divs.sort((a, b) => DIV_ORDER.indexOf(a) - DIV_ORDER.indexOf(b));
    divs.forEach(function(div) {
            var option = new Option(DIV_NAME[div], div);
            $('#' + selectId).append($(option));
        });
}

/**
 * Let's us say "Women's Golf" instead of "Women Golf".
 *
 * @param {string} division   division code
 */
function getDivisionAdjective(division) {

    var divAdj = DIV_NAME[division];
    if (isWomenDivision(division)) {
	divAdj = divAdj.replace("Women", "Women's");
    }

    return divAdj;
}

/**
 * Adds options to a pool <select>.
 *
 * @param {string}   pools        comma-separated list of pool names
 * @param {boolean}  showAll      if true, add "All" as first (default) pool choice
 * @param {string}   selectId     DOM ID of division <select>
 */
function populatePoolSelect(poolStr, showAll=false, selectId='poolSelect') {

    poolStr = poolStr || '';
    var pools = poolStr.split(/\s*,\s*/);
    if (showAll) {
	var option = new Option('---', 'all');
	$('#' + selectId).append($(option));
    }
    pools.forEach(function(pool) {
            var option = new Option(pool, pool);
            $('#' + selectId).append($(option));
        });
}

/**
 * Adds options to a round <select>.
 *
 * @param {string} event        event name
 * @param {string} division     division code
 * @param {string} selectId     DOM ID of round <select>
 */
function populateRoundSelect(event, division, selectId='roundSelect') {

    $('#' + selectId + ' option').remove(); // clear options

    var eventInfo = window.eventData[event],
	rounds = getRoundsByDivision(event, division);

    for (var round = 1; round <= rounds; round++) {
	var option = new Option(getRoundName(event, round), round);
	$('#' + selectId).append($(option));
    }
}

/**
 * Returns the number of rounds for a division by parsing its round data. Most of the time it will just
 * be a number, but a tournament can have different numbers of rounds for different divisions by using the
 * following format: A number by itself applies to all divisions. To make an exception, add a new code with
 * the division followed by a colon and the number of rounds. For example, a tournament where there are 3
 * rounds (2 cumulative) of SCF for open players and 2 rounds of SCF (none cumulative) for women would use
 * "3,W:2" for the number of rounds and "2,W:0" for the number of cumulative rounds.
 *
 * @param {string}  event            event name
 * @param {string}  division         division code
 * @param {boolean} getCumulative    if true, return number of cumulative rounds
 *
 * @return {int} number of rounds
 */
function getRoundsByDivision(event, division, getCumulative=false) {

    var eventInfo = window.eventData[event],
	roundInfo = getCumulative ? eventInfo.cumulative_rounds : eventInfo.rounds;

    return getValueByDivision(roundInfo, division);
}

/**
 * Returns the countdown base for the given division. It can vary by division using the encoding method
 * described above.
 *
 * @param {string} division         division code
 *
 * @return {int} countdown base
 */
function getCountdownBaseByDivision(division) {

    return getValueByDivision(window.tournamentData['countdown_base'], division);
}

/**
 * Parses an encoded string with numerical values that can vary by division using the encoding method
 * described above.
 *
 * @param {string} codeStr          encoded string of values
 * @param {string} division         division code
 *
 * @return {int} value for the given division
 */
function getValueByDivision(codeStr, division) {

    var codes = codeStr.split(/\s*,\s*/),
	divMap = toLookupHash(DIV_ORDER);

    codes.forEach(function(code) {
            var value = parseInt(code), div;
            if (!isNaN(value)) {
                DIV_ORDER.forEach(div => divMap[div] = value);
            }
            else if (code.indexOf(':') !== -1) {
                [ div, value ] = code.split(':');
                divMap[div] = value;
                for (var d in DIV_MATCH[div]) {
                    divMap[d] = value;
                }
            }
        });

    return Number(divMap[division]);
}

/**
 * Remember player names.
 *
 * @param {object} data    player data
 */
function handleNameInfo(data) {

    saveNames(data || [], 'player');
}

/**
 * Returns the currently selected division.
 *
 * @param {string} selectId     DOM ID of division select
 *
 * @return {string} division code
 */
function getDivision(selectId='divisionSelect') {
    return window.division || $('#' + selectId).val();
}

function isOpenDivision(division) {

    division = division || getDivision();
    return division.substr(0, 1) === 'O';
}

function isWomenDivision(division) {

    division = division || getDivision();
    return division.substr(0, 1) === 'W';
}

function isJuniorDivision(division) {

    division = division || getDivision();
    return division.substr(-1, 1) === 'J';
}

/**
 * Returns true if the player division matches the given division. An age-restricted division includes
 * the more restricted divisions. For example, every grandmaster is also a master. Open and Women include
 * juniors.
 *
 * @param {string} playerDivision     division to test for a match
 * @param {string} division           division to test against
 */
function divisionMatch(playerDivision, division) {

    //    return playerDivision === division || (DIV_MATCH[division] && DIV_MATCH[division][playerDivision]);
    return playerDivision === division || ((division === 'O' || division === 'W') && DIV_MATCH[division][playerDivision]);
}

/**
 * Returns true if the player matches the given division.
 *
 * @param {object} player    player ID
 * @param {string} division  division
 */
function playerDivisionMatch(playerId, division) {

    return window.playerData[playerId] && divisionMatch(window.playerData[playerId].division, division);
}

/**
 * Returns true if at least one of the players on the given team matches the given division.
 *
 * @param {object} team      team
 * @param {string} division  division
 */
function teamDivisionMatch(team, division) {

    if (!team) {
	return false;
    }

    var playerIds = getTeamMembers(team);
    if (playerIds.find(id => divisionMatch(window.playerData[id] && window.playerData[id].division, division))) {
	return true;
    }

    return false;
}

/**
 * Returns the currently selected pool, or null if no pool is selected.
 *
 * @param {string} selectId     DOM ID of pool select
 *
 * @return {string} pool name or null
 */
function getPool(selectId='poolSelect') {

    var pool = $('#' + selectId).val();

    return pool === 'all' ? null : pool;
}

/**
 * Returns the ID for the currently selected event.
 *
 * @return {string} event ID
 */
function getEventId(event) {

    var eventInfo = window.eventData[event || window.curEvent];
    return eventInfo ? eventInfo.id : '';
}

/**
 * Converts a score from database to display version.
 *
 * @param {string} score    a score
 * @param {string} event    event name
 */
function formatScore(score, event) {

    event = event || window.curEvent;
    
    if (score == null || (event === 'scf' && !score)) {
	return '-';
    }

    event = event || window.curEvent;
    if (event === 'discathon' && $.isNumeric(score) && score > 0) {
	var min = Math.floor(score / 60),
	    sec = score % 60;

	sec = sec < 10 ? '0' + sec : sec;

	return [ min, sec ].join(":");
    }
    else if (score == -2) {
	return 'SCR';
    }
    else if (score == -1) {
	return [ 'scf', 'mta', 'trc' ].indexOf(event) !== -1 ? 'NC' : 'DNF';
    }
    else if (score == 0) {
	return '0';
    }
    else if (USE_DECIMAL[event]) {
	return String(Number(score).toFixed(2));
    }

    return String(Number(score));
}

/**
 * Converts a score from display to database version.
 *
 * @param {string} score    a score
 * @param {string} event    event name
 */
function unformatScore(score, event) {

    event = event || window.curEvent;
    if (event === 'discathon' && !($.isNumeric(score))) {
	[min, sec] = score.split(':');
	return (60 * Number(min)) + Number(sec);
    }

    return Number(score);
}

function checkDecimal(results) {

    var event = window.curEvent,
	eventId = getEventId();

    if ((event === 'distance' || event === 'trc')) {
	USE_DECIMAL[event] = !!results.find(res => res.event_id === eventId && res.score % 1 !== 0);
    }
}

/**
 * Remember team info. Give each team a team name.
 *
 * @param {object} data    team data
 */
function handleTeamInfo(data) {

    // store team info in global scope
    window.teamData = window.teamData || {};
    window.teamId = window.teamId || {};

    if (!data || !data.length) {
	return;
    }

    // give each team a name, division, and ID
    for (var i = 0; i < data.length; i++) {
	var team = data[i],
	    teamPlayers = getTeamMembers(team).map(id => window.playerData[id] ? window.playerData[id].name : '[unknown]'),
	    name = getTeamName(teamPlayers),
	    event = window.eventById[team.event_id].name;

	team.name = name;

	window.teamData[event] = window.teamData[event] || {};
	window.teamId[event] = window.teamId[event] || {};
	window.teamData[event][team.id] = team;
	window.teamId[event][name] = team.id;
    }
}

/**
 * Returns the appropriate round name for the event and round, recognizing if it is the semis or finals.
 *
 * @param {string} event     event name
 * @param {int}    round     round number
 */
function getRoundName(event, round) {

    var division = getDivision(),
        rounds = getRoundsByDivision(event, division),
        cumRounds = getRoundsByDivision(event, division, true),
        numLeft = rounds - round;

    return round <= cumRounds ? 'Round ' + round : numLeft === 0 ? 'Final' : numLeft === 1 ? 'Semi' : 'Round ' + round;
}

/**
 * Returns a list of the players (IDs) on the given team.
 *
 * @param {object} team    team
 *
 * @return {Array} list of player IDs
 */
function getTeamMembers(team) {

    return team ? [ team.player1, team.player2, team.player3 ].filter(id => id > 0) : [];
}

function addPlayer(player, division, callback) {

    player = capitalizeName(player);

    var personId = window.personId[player];
    
    if (!personId) {
        // if it's a new person, we have to add them to the person table first, then get the ID from that
        // before we add them to the player table, so chain the requests
        var sex = isWomenDivision(division) ? 'female' : 'male';
        return sendRequest('add-person', { name: player, sex: sex }).then(function(id) {
                // new person added, create player record                                                              
                id = JSON.parse(id); // not strictly necessary since id is scalar
		if (id) {
		    var p = { id: id, name: player, sex: sex };
		    args = { tournamentId: window.tournamentId, personId: id, division: division };
		    
		    window.personData[id] = p;
		    window.personId[player] = id;
		    sendRequest('add-player', args, callback);
		}
            });
    }
    else {
        // known person, just add them to the player table for this tournament
        args = { tournamentId: window.tournamentId, personId: personId, division: division };
        return sendRequest('add-player', args, callback);
    }
}

/**
 * Filters out results that don't match the given division and returns the resulting list.
 *
 * @param {Array}   data            list of results
 * @param {string}  division        division code
 * @param {boolean} expandTeams     if true, include a separate result record for each team member
 *
 * @return {Array} list of results
 */
function filterResultsByDivision(data, division, expandTeams=true) {

    data = data || [];

    return data.filter(function(result) {
	    // team is okay if any of its members match the division
	    var event = window.eventById[result.event_id].name;
            if (expandTeams && IS_TEAM_EVENT[event] && window.teamData) {
                var members = getTeamMembers(window.teamData[event][result.player_id]);
                return !!members.find(playerId => divisionMatch(window.playerData[playerId].division, division));
            }
            else {
		var player = window.playerData[result.player_id],
		    playerDiv = player && player.division;

                return divisionMatch(playerDiv, division);
            }
	});
}

/**
 * Filters out results that don't match the given pool and returns the resulting list.
 *
 * @param {Array}   data            list of results
 * @param {string}  pool            pool name
 * @param {boolean} expandTeams     if true, include a separate result record for each team member
 *
 * @return {Array} list of results
 */
function filterResultsByPool(data, pool, expandTeams=true) {

    data = data || [];

    if (!pool) {
	return data;
    }

    return data.filter(function(result) {
	    // team is okay if any of its members match the pool
	    var event = window.eventById[result.event_id].name;
            if (expandTeams && IS_TEAM_EVENT[event] && window.teamData) {
                var members = getTeamMembers(window.teamData[event][result.player_id]);
                return !!members.find(playerId => window.playerData[playerId].pool === pool);
            }
            else {
		var player = window.playerData[result.player_id];
		return player.pool === pool;
            }
	});
}

function handleRecordData(recordData) {

    window.recordData = {};
    recordData = recordData || [];
    recordData.forEach(function(record) {
	    window.recordData[record.event] = window.recordData[record.event] || {};
	    window.recordData[record.event][record.division] = record;
	});
}

function getPartners(playerId, event) {

    let team = Object.values(window.teamData[event]).find(team => getTeamMembers(team).indexOf(playerId) !== -1),
	members = getTeamMembers(team),
	others = members.filter(id => id != playerId),
	names = others.map(id => playerData[id] ? playerData[id].name : '[unknown]');

    return names.join(' and ');
}
