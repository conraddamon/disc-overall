/*
 * Functions to help with the form used to create or edit an overall tournament. A 'person' is
 * an overall player we have heard of. A 'player' is a person who has registered for this tournament.
 */

// required form fields
const REQUIRED = [ 'name', 'td_name', 'td_email', 'password', 'location', 'start', 'end' ];

// radio buttons
const IS_RADIO = {'scoring': true,
		  'scoring_team': true};

/**
 * Launch function. The form is pure HTML and doesn't pass the tournament ID, so we
 * look in the query string.
 */
function initializeTournamentAdmin(tournamentData) {

    // intercept form post so we can do validation
    $('#submitButton').click(submitForm);

    setupNotification();

    // set up handlers for various helpful form stuff
    $('#scf,#mta,#trc').change(scfHandler); 
    $('#countdown_base').change(countdownHandler);
    $('input[name="events[]"]').change(eventHandler);
    $('input[name="mixed_team[]"]').change(mixedTeamHandler);

    // use jQuery's mini-calendar
    $('#start,#end').datepicker({
            dateFormat: "M d, yy"
        });

    // tournament ID means we are in edit mode
    if (tournamentData) {
	window.tournamentId = tournamentData.id;
	sendRequest('load-person', { getAll: tournamentData.test }, handlePersonInfo);
	handleTournamentInfo(tournamentData);

	$('#addPlayer').click(handlePlayerAdd);
	$('#editWarning').show();
	$('#tournamentId').val(tournamentId); // save in hidden form field
	$('#removePlayerDialog').dialog({
		autoOpen: false,
		modal: true,
		width: '35rem',
		position: { my: 'center', at: 'center', of: '#addPlayer' },
	        draggable: false,
		resizable: false
	    });
	$('#removePlayer').click(removePlayer);
    }
}

/**
 * Processes tournament data by filling out the form.
 *
 * @param {object} data     tournament data
 */
function handleTournamentInfo(data) {
    
    var td = window.tournamentData = data;

    $('#submitButton').text('Update Tournament'); // we know we're in edit mode

    // add divisions to Select used when adding player
    var divs = td.divisions.split(',');
    divs.forEach(function(div) {
	    var option = new Option(DIV_NAME[div], div);
	    $('#divisionSelect').append($(option));
	});

    // fill out form fields - the ID of a field is the same as the data key
    for (var field in data) {
	if (field === 'id' || field === 'password') {
	    continue;
	}
	var value = data[field];

	// division checkboxes
	if (field === 'divisions') {
	    var divs = value.split(',');
	    divs.forEach(function(div) {
		    $('input[value="' + div + '"]').prop('checked', true);
		});
	    continue;
	}

	if (field === 'ddc_team' || field === 'freestyle_team') {
	    let ev = field.replace('_team', '');
	    value = value || '2';
	    [ '1', '2', '3' ].forEach(num => $('#' + ev + num).prop('checked', value.indexOf(num) !== -1));
	    continue;
	}

	if (field === 'mixed_team') {
	    [ 'ddc', 'freestyle' ].forEach(event => $('#mixed_team_' + event).prop('checked', value.indexOf(event) !== -1));
	    mixedTeamHandler();
	    continue;
	}

	if (field === 'mixed_team_scoring') {
	    $('#mixed_team_scoring_' + value).prop('checked', true);
	    continue;
	}

	if (field === 'test' || field === 'junior_scoring_separate' || field === 'show_division') {
	    $('#' + field).prop('checked', value == 1);
	    continue;
	}

	// scoring settings are radio buttons
	if (IS_RADIO[field]) {
	    $('input[name=' + field + '][value=' + value + ']').prop('checked', true);
	    continue;
	}

	// convert date from DB format
	if (field === 'start' || field === 'end') {
	    value = fromMysqlDate(value).toDateString();
	    value = value.substr(value.indexOf(' ') + 1).replace(' 0', ' ').replace(' 20', ', 20');
	}

	// text fields are named after DB column
	$('#' + field).val(value);
    }

    // can't have mixed teams of one player
    if (data['ddc_team'] === '1' && data['freestyle_team'] === '1') {
	$('#mixed_team_inputs').hide();
    }

    // now that we have data, update the scoring details
    countdownHandler.call($('#countdown_base'));

    // event info is in a different table
    sendRequest('get-event', { tournamentId: window.tournamentId }, handleEventInfo);
}

/**
 * Processes person data.
 *
 * @param {object} data     person data
 */
function handlePersonInfo(data) {

    // save in global scope
    saveNames(data);

    // use person names for autocomplete (except those who have registered)
    window.personAutocompleteList = getNameList(data);
    addNameAutocomplete(window.personAutocompleteList, null, rejectAutocomplete, function(e, ui) {
	    // set divisions based on sex when a name has been selected
	    //	    updateDivisionSelect(ui.item.value);
	});

    // get list of people who have registered for this tournament
    sendRequest('load-player', { tournamentId: window.tournamentId, getName: true }, handlePlayerInfo);
}

/**
 * Processes event data by filling in the checkboxes and rounds info in the form
 *
 * @param {object} data    event data
 */
function handleEventInfo(data) {

    if (!data) {
	return;
    }

    data.forEach(function(event) {
	    var ev = event.name;
	    $('#eventTable input[value="' + ev + '"]').prop('checked', true);
	    $('#' + ev + '_rounds').val(event.rounds);
	    $('#' + ev + '_cumulative_rounds').val(event.cumulative_rounds === 0 ? '' : event.cumulative_rounds);
	});

    // show only relevant SCF-related events
    scfHandler();
}

/**
 * Autocomplete helper function that rejects a player who is registered. Such a player
 * will have a division.
 *
 * @param {string} name    person name
 *
 * @return {boolean} true if player has been registered
 */
function alreadyRegistered(name) {

    var id = window.personId[name],
	p = id && window.personData[id];

    return !!(p && p.division);
}

function rejectAutocomplete(name) {

    if (alreadyRegistered(name)) {
	return true;
    }

    let personId = window.personId[name],
	person = window.personData[personId],
	sex = person && person.sex,
	division = getDivision(),
	divSex = division.startsWith('W') ? 'female' : 'male';

    return sex !== divSex;
}

/**
 * Remembers who has entered the tournament.
 *
 * @param {Object} data    player data from db
 */
function handlePlayerInfo(data) {

    data = data || [];

    // update person data with player ID
    for (var i = 0; i < data.length; i++) {
	var player = data[i],
	    person = window.personData[player['person_id']];

	if (person) {
	    // a person who has registered has a division
	    person.division = player.division;
	    person.playerId = player.id;
	}
    }

    // autocomplete is now ready, show the input
    $('#playerContainer').show();

    // use person names for autocomplete (except those who have registered)
    window.playerAutocompleteList = getNameList(data);
    addNameAutocomplete(window.playerAutocompleteList, null, null, null, 'playerToRemove', null);
}

/**
 * Show or hide divisions based on the sex of the given person.
 *
 * @param {string} person    person name
 */
function updateDivisionSelect(person) {

    $('#divisionSelect').focus();

    var id = window.personId[person],
	isFemale = id && window.personData[id] && window.personData[id].sex === 'female',
	openDivs = $('#divisionSelect option[value^=O]'),
	womenDivs = $('#divisionSelect option[value^=W]');
    
    openDivs.show();
    womenDivs.show();
    if (isFemale) {
	openDivs.hide();
    }
    else if (id) {
	womenDivs.hide();
    }

    // auto-select the first applicable division (usually Open or Women)
    //    var ch = isFemale ? 'W' : 'O';
    //    $('#divisionSelect option[value="' + ch + '"]').prop('selected', true);
}

/** 
 * The user has entered a name and selected a division. If the name is not known to us, we need
 * to add it to the 'person' table.
 *
 * @param {Event} e    browser event
 */
function handlePlayerAdd(e) {

    e.preventDefault(); // don't post the form!

    var player = $('#player').val(),
	division = $('#divisionSelect').val(),
	callback = playerAdded.bind(null, player, division);

    if (!alreadyRegistered(player)) {
	addPlayer(player, division, callback);
    }
    else {
	showNotification(player + " has already been registered.");
    }
}

/**
 * After a player has been registered, update our global data and reset the form.
 *
 * @param {string} player    person name
 * @param {string} division  division
 */
function playerAdded(player, division, playerId) {

    player = capitalizeName(player);
    var id = window.personId[player],
	person = window.personData[id];

    if (person) {
	person.division = division;
	person.playerId = playerId;
	removeItem(window.personAutocompleteList, player);
	window.playerAutocompleteList.push(player);
    }

    $('#player').val('');
    $('#player').focus();

    showNotification(player + ' has been registered in the ' + DIV_NAME[division] + ' division');
}

/**
 * A tournament with SCF does not need to offer MTA and TRC. Conversely, one with MTA or TRC does
 * not separately offer SCF.
 *
 * @param {Event} e    browser event
 */
function scfHandler(e) {

    if ($('#scf').is(':checked')) {
	$('#mta_row,#trc_row').hide();
	$('#mta,#trc').prop('checked', false);
    }
    else {
	$('#mta_row,#trc_row').show();
    }

    // check for event being passed - only hide SCF if user checked a box
    if (e && ($('#mta').is(':checked') || $('#trc').is(':checked'))) {
	$('#scf_row').hide();
	$('#scf').prop('checked', false);
    }
    else {
	$('#scf_row').show();
    }
}

/**
 * Once the TD adds an event, default its number of rounds to 1.
 *
 * @param {Event} e    browser event
 */
function eventHandler(e) {

    var myId = $(this).prop('id'),
	checked = $(this).is(':checked'),
	val = $(this).val(),
	roundsInput = $('#' + myId + '_rounds'),
	empty = $(roundsInput).val() == '';
    
    if (checked) {
	if (empty) {
	    $(roundsInput).val('1');
	}
	$('#' + val + '_rounds').focus();
    }
    else if (!checked) {
	$(roundsInput).val('');
    }
}

/**
 * Show mixed team scoring options if at least one team event allows mixed teams.
 *
 * @param {Event} e    browser event
 */
function mixedTeamHandler(e) {

    let checked = $('input[name="mixed_team[]"]:checked');
    if (checked && checked.length > 0) {
	$('#mixed_team_scoring_section').show();
    }
    else {
	$('#mixed_team_scoring_section').hide();
    }
}

/**
 * Updates the numbers in the descriptive text for scoring if it's the "countdown" type.
 *
 * @param {Event} e    browser event
 */
function countdownHandler(e) {

    if ($('input[name=scoring]:checked').val() !== 'countdown') {
	return;
    }

    var base = parseInt($(this).val());
    $('.base1').text(base);
    $('.base2').text(base - 1);
    $('.base3').text(base - 2);
}

/**
 * Posts the form to the server after doing some validation.
 *
 * @param {Event} e    browser event
 */
function submitForm(e) {

    e.preventDefault(); // don't let browser post the form

    var errors = [];

    // first check for required fieldds
    REQUIRED.forEach(function(field) {
	    if (field === 'password' && window.tournamentId) {
		return;
	    }
	    var input = $('#' + field);
	    if (!$(input).val()) {
		var inputId = $(input).prop('id'),
		    label = $('label[for="' + inputId + '"]').text();

		errors.push("Missing required field: " + label.substr(1, label.length - 2));
	    }
	});

    var numEvents = $("input[name='events[]']:checked").length;
    if (numEvents === 0) {
	errors.push("The tournament has no events. At least it will go fast.");
    }
    else if (numEvents === 1) {
	errors.push("An overall with one event? What are you, some kind of joker?");
    }

    var numDivisions = $("input[name='divisions[]']:checked").length;
    if (numDivisions === 0) {
	errors.push("The tournament has no divisions, so no one is eligible to play in it.");
    }
	
    if (errors.length) {
	alert(errors.join("\n"));
    }
    else {
	// ship it!
	normalizeScf();
	$('#tournamentForm').submit();
	showNotification('Tournament ' + (window.tournamentId ? 'updated' : 'added'));
    }
}

/**
 * If SCF is chosen as an event, then we want to include MTA and TRC behind the scenes as well.
 */
function normalizeScf() {

    var events = Array.from($("input[name='events[]']:checked")).map(x => x.value);
    if (events.indexOf('scf') !== -1) {
	var rounds = $('#scf_rounds').val(),
	    cumulative = $('#scf_cumulative_rounds').val();

	[ 'mta', 'trc' ].forEach(function(event) {
		$("input[value='" + event + "']").prop('checked', true);
		$('#' + event + '_rounds').val(rounds);
		$('#' + event + '_cumulative_rounds').val(cumulative);
	    });
    }
}

function showRemovePlayerDialog(e) {

    $('#removePlayerDialog').dialog('open');
}

function removePlayer(e) {

    var name = $('#playerToRemove').val(),
	personId = window.parent.personId[name],
	person = personId && window.parent.personData[personId],
	playerId = person && person.playerId;

    if (playerId) {
	sendRequest("remove-player", { playerId: playerId }, playerRemoved.bind(null, name));
	sendRequest("remove-team-player", { playerId: playerId });
    }
}

function playerRemoved(name) {

    removeItem(window.playerAutocompleteList, name);
    window.personAutocompleteList.push(name);

    $('#removePlayerDialog').dialog('close');
    showNotification(name + " has been unregistered");
}

function enableEdit() {

    $('#tournamentContainer').show();
}
