const DIV_MAP = { 'O': [ 'open', 'men', 'male' ],
		  'W': [ 'women', 'female', 'wopen' ],
		  'M': [ 'master' ],
		  'G': [ 'grand' ],
		  'S': [ 'senior', 'sr' ],
		  'L': [ 'legend' ],
		  'J': [ 'junior', 'jr' ] };

const DIV_MAP_ORDER = [ 'O', 'W', 'S', 'L', 'J', 'G', 'M' ];

const DIV_WORDS = [];
Object.values(DIV_MAP).forEach(function(a) { mergeArray(DIV_WORDS, a); });
const DIV_WORDS_REGEX = new RegExp(DIV_WORDS.join('|'), 'g');

function initializeImport(tournamentId) {

    window.tournamentId = tournamentId;

    // intercept form post so we can do stuff ourselves
    $('#importButton').click(handleImport);
    $('#addButton').click(addPlayers);
    $('#retryButton').click(handleRetry);

    sendRequest('load-person', null, handlePersonInfo);
}

/**
 * Processes person data.
 *
 * @param {object} data     person data                                                      
 */
function handlePersonInfo(data) {

    // save in global scope
    saveNames(data);

    // get list of people who have registered for this tournament
    sendRequest('load-player', { tournamentId: window.tournamentId }, handleNameInfo);
}

function handleImport(e) {

    e.preventDefault(); // don't let browser post the form

    var result = parseCSV();

    $('#csvContainer').hide();
    $('#importButton').hide();
    $('#addButton').show();
    $('#retryButton').show();
    $('#goodHeader').text('Players (' + result.good.length + ')');
    $('#badHeader').text('Could not parse (' + result.bad.length + ')');
    
    if (result.good.length) {
	$('#goodContainer').show();
	$('#goodText').val(result.good.join(''));
    }

    if (result.bad.length) {
	$('#badContainer').show();
	$('#badText').val(result.bad.join(''));
    }

    $('#retryButton').show();
}

function handleRetry(e) {

    e.preventDefault(); // don't let browser post the form

    $('#goodContainer').hide();
    $('#badContainer').hide();
    $('#csvContainer').show();
    $('#importButton').show();
    $('#addButton').hide();
    $('#retryButton').hide();
}

function parseCSV() {

    var firstNameCol = $('#colNumFirst').val(),
	lastNameCol = $('#colNumLast').val(),
	fullNameCol = $('#colNumFull').val(),
	divisionCol = $('#colNumDivision').val(),
	text = $('#csvText').val();

    if (text && text.length) {
	text = text.split(/[\r\n]+/);
    }
    else {
	alert("No CSV text found.");
	return;
    }

    var players = [],
	failed = [];

    text.forEach(function(line) {

	    var fields = CSVtoArray(line);

	    if (!fields) {
		failed.push(line);
		return;
	    }

	    var firstName = firstNameCol && fields[firstNameCol - 1],
		lastName = lastNameCol && fields[lastNameCol - 1],
		fullName = fullNameCol && fields[fullNameCol - 1],
		division = divisionCol && fields[divisionCol - 1],
		nameIdx;

	    var name = fullName || (firstName && lastName) ? [ firstName, lastName ].join(' ') : '';
	    if (!name) {
		nameIdx = fields.findIndex(f => f.indexOf(' ') !== -1);
		if (nameIdx !== -1 && nameIdx < 3) {
		    name = fields[nameIdx];
		    fullNameCol = (fullNameCol != '') ? fullNameCol : nameIdx;
		}
	    }

	    var divCode = getDivisionCode(division);
	    if (!divCode) {
		var start = Math.max(firstNameCol, lastNameCol, fullNameCol) + 1;
		for (var i = start; i < fields.length; i++) {
		    divCode = getDivisionCode(fields[i]);
		    if (divCode) {
			divisionCol = (divisionCol != '') ? divisionCol : i;
			break;
		    }
		}
	    }

	    if (name && /\S/.test(name) && divCode) {
		players.push([ name, divCode ].join(':') + "\n");
	    }
	    else {
		failed.push(line + "\n");
	    }
	});

    return { good: players, bad: failed };
}

function getDivisionCode(division) {

    if (!division) {
	return '';
    }

    var divisionCode = '',
	test = division.toUpperCase();

    // see if we got something like a division code, eg 'OGM' or 'GM' or 'WL'
    divisionCode = DIV_NAME[test] && test;
    if (!divisionCode) {
	test = 'O' + test;
    }
    divisionCode = DIV_NAME[test] && test;

    // see if full division names are being used
    if (!divisionCode) {
	test = division.toLowerCase().replace(/\(\d+\)/, '');
	if (!test.replace(DIV_WORDS_REGEX, '').replace(/\s+/g, '')) {
	    divisionCode = '';
	    DIV_MAP_ORDER.forEach(function(divCode)  {
		    DIV_MAP[divCode].forEach(function(word) {
			    if (test.indexOf(word) !== -1) {
				divisionCode += divCode;
			    }
			});
		});
	    divisionCode = divisionCode.replace(/^OW/, 'W'); // because 'wopen' contains 'open'
	}
	if (divisionCode && !DIV_NAME[divisionCode]) {
	    test = 'O' + divisionCode;
	    divisionCode = DIV_NAME[test] && test;
	}
    }

    return divisionCode;
}

function addPlayers(e) {

    e.preventDefault(); // don't let browser post the form

    var text = $('#goodText').val(),
	players = text.split("\n"),
	name, division;

    var info = { count: 0 },
	callback = playerAdded.bind(null, info),
	promises = [];

    players.forEach(function(player) {
	    if (!player) {
		return;
	    }

	    [ name, division ] = player.split(':');
	    if (window.playerId[name]) {
		return;
	    }

	    promises.push(addPlayer(name, division, callback));
	});

    $.when(...promises).then(function() {
	    showNotification(info.count + ' players added');
	    setTimeout(function() {
		    window.location = "tournament.html?id=" + window.tournamentId;
		}, 3000);
	});
}

function playerAdded(info, id) {

    info.count++;
}

// http://stackoverflow.com/questions/8493195/how-can-i-parse-a-csv-string-with-javascript-which-contains-comma-in-data
function CSVtoArray(text) {

    var re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;

    var re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;

    // Return NULL if input string is not well formed CSV string.
    if (!re_valid.test(text)) {
	return null;
    }

    var a = [];                     // Initialize array to receive values.
    text.replace(re_value, // "Walk" the string using replace with callback.
	     function(m0, m1, m2, m3) {
		 // Remove backslash from \' in single quoted values.
		 if      (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
            // Remove backslash from \" in double quoted values.
            else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
		 else if (m3 !== undefined) a.push(m3);
		 return ''; // Return empty string.
	     });

    // Handle special case of empty last value.
    if (/,\s*$/.test(text)) {
	a.push('');
    }

    return a;
};
