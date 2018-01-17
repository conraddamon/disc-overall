/**
 * Functions to help with display of a player page.
 */

/**
 * Launch function. Player ID comes from HTML page.
 *
 * @param {string} playerId    player ID
 */
function initializePlayer(playerId) {

    window.playerId = playerId;
    window.isPlayerPage = true;

    // errgggkk
    sendRequest("get-player", { playerId: playerId, getName: true }).then(function(player) {
	    player = JSON.parse(player);
	    $('#subtitle').text(player.name);
	    sendRequest("get-tournament", { tournamentId: player.tournament_id }).then(function(tournament) {
			tournament = JSON.parse(tournament);
			sendRequest("get-event", { tournamentId: tournament.id }, showPlayerPage.bind(null, player, tournament));
		    });
	});
}

function showPlayerPage(player, tournament, eventData) {

    saveEvents(eventData);
    var events = Object.keys(window.eventData).sort((a, b) => EVENT_ORDER.indexOf(a) - EVENT_ORDER.indexOf(b)),
	hasScf = events.indexOf('scf') !== -1;

    //    events.unshift('overall');
    events.forEach(function(event) {

	    if (hasScf && (event === 'mta' || event === 'trc')) {
		return;
	    }

	    var division = player.division.substr(0, 1) + '*',
		eventId = window.eventData[event].id;

	    sendRequest('get-results', { event: event, eventId: eventId, division: division, sort: 'round' }, gotPlayerResults.bind(null, event));
	});

}

function gotPlayerResults(event, data) {

    window.curEvent = event;

    var html = '';

    html += '<div class="playerEventHeader">' + capitalizeEvent(event) + '</div>';
    html += handleResults(data, event);
    html += displayResults();

    $('#content').append(html);
}


