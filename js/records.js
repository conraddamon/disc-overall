function parseRecordHtml(recordHtml) {

    window.newRecord = {};

    let getPerson = sendRequest('load-person', { getAll: true }),
	getRecords = sendRequest('get-records');

    let requests = [ getPerson, getRecords ],
	callbacks = [ saveNames, handleRecordData ];

    sendRequests(requests, callbacks).then(parseHtml.bind(null, recordHtml));
}

function parseHtml(recordHtml) {

    recordHtml = recordHtml || {};
    for (let event in recordHtml) {
	$('#work').html(recordHtml[event]);
	$('#work tr').each(function() {
		parseRow(event, this);
	    });
    }

    updatePersons();
}

function parseRow(event, row) {

    if (row.id !== 'record_tr_active') {
	return;
    }

    let cells = row.cells,
	division = getRecordDivision(cells[0], cells[1]),
	score = parseFloat(cells[2].innerText.replace(',', '.')), // use dots as decimal points (commas don't work with parseFloat)
	name = cells[3].innerText.replace(/\s+\(.*$/, ''),
	personId = window.personId[name];

    if (!division) {
	return;
    }

    let currentRecord = window.recordData[event] && window.recordData[event][division];
    if (currentRecord && score <= currentRecord.score) {
	return;
    }

    window.newRecord[event] = window.newRecord[event] || {};
    window.newRecord[event][division] = { name: name, score: score };
}

function updatePersons() {

    var requests = [], added = {};
    for (let event in window.newRecord) {
	for (let division in window.newRecord[event]) {
	    let record = window.newRecord[event][division],
		name = record.name,
		personId = window.personId[name],
		sex = isWomenDivision(division) ? 'female' : 'male';
	    
	    if (!personId && !added[name]) {
		requests.push(sendRequest('add-person', { name: name, sex: sex }, personAdded.bind(null, name, sex, event, division)));
	    }
	    else if (personId) {
		window.newRecord[event][division].personId = personId;
	    }
	}
    }

    sendRequests(requests).then(updateRecords);
}

function personAdded(name, sex, event, division, id) {

    if (id) {
	window.personData[id] = { name: name, sex: sex };
	window.personId[person.name] = id;
	window.newRecord[event][division].personId = id;
    }
}

function updateRecords() {

    for (let event in window.newRecord) {
	for (let division in window.newRecord[event]) {
	    let record = window.newRecord[event][division],
		currentRecord = window.recordData[event] && window.recordData[event][division],
		args = { event: event, division: division, personId: record.personId, score: record.score },
		callback = recordAdded.bind(null, event, division, record);

	    sendRequest(currentRecord ? 'set-record' : 'add-record', args, callback);
	}
    }
}

function recordAdded(event, division, record) {

    let person = window.personData[record.personId].name;

    $('#recordTable').append('<tr><td>' + capitalizeEvent(event) + '</td><td>' + DIV_NAME[division] + '</td><td>' +  person + '</td><td>' + record.score + '</td></tr>');
}

function getRecordDivision(sexCell, ageCell) { // what is this, biology class?

    let img = $(sexCell).children('img'),
	src = $(img).prop('src'),
	div = src && src.indexOf('female') !== -1 ? 'W' : 'O';

    let ageDiv = ageCell.innerText;
    if (ageDiv === 'Open') {
	return div;
    }
    else {
	let dir = ageDiv.substr(0, 1),
	    age = Number(ageDiv.substr(1));

	if (dir === 'u') {
	    if (age >= 19) {
		return div + 'J';
	    }
	}
	else if (dir === 'o') {
	    if (age >= 70) {
		return div + 'L';
	    }
	    else if (age >= 60) {
		return div + 'SGM';
	    }
	    else if (age >= 50) {
		return div + 'GM';
	    }
	    else if (age >= 40) {
		return div + 'M';
	    }
	}
    }

    return '';
}


