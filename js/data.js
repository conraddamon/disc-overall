function initializeData() {

    var store = window.store = new JSData.DS();

    var adapter = new DSHttpAdapter({ basePath: '/js-data', suffix: '.php' });
    store.registerAdapter('http', adapter, { default: true });

    var Person = store.defineResource({
	    name: 'person',
	    relations: {
		hasMany: {
		    player: {
			localField: 'players',
			foreignKey: 'person_id'
		    },
		    record: {
			localField: 'records',
			foreignKey: 'person_id'
		    }
		}
	    }
	});

    var Tournament = store.defineResource({
	    name: 'tournament',
	    relations: {
		hasMany: {
		    event: {
			localField: 'events',
			foreignKey: 'tournament_id'
		    }
		},
		hasMany: {
		    player: {
			localField: 'players',
			foreignKey: 'tournament_id'
		    }
		}
	    }
	});

    var Player = store.defineResource({
	    name: 'player',
	    relations: {
		belongsTo: {
		    person: {
			localField: 'person',
			localKey: 'person_id'
		    },
		    tournament: {
			localField: 'tournament',
			localKey: 'tournament_id'
		    }
		},
		hasMany: {
		    result: {
			localField: 'results',
			foreignKey: 'player_id'
		    }
		}
	    }
	});

    var Event = store.defineResource({
	    name: 'event',
	    relations: {
		belongsTo: {
		    tournament: {
			localField: 'tournament',
			localKey: 'tournament_id'
		    }
		},
		hasMany: {
		    result: {
			localField: 'results',
			foreignKey: 'event_id'
		    },
		    team: {
			localField: 'teams',
			foreignKey: 'event_id'
		    }
		}
	    }
	});

    var Result = store.defineResource({
	    name: 'result',
	    relations: {
		belongsTo: {
		    event: {
			localField: 'event',
			localKey: 'event_id'
		    },
		    player: {
			localField: 'player',
			localKey: 'player_id'
		    }
		}
	    }
	});

    var Team = store.defineResource({
	    name: 'team',
	    relations: {
		belongsTo: {
		    event: {
			localField: 'event',
			localKey: 'event_id'
		    }
		},
		hasMany: {
		    player: {
			localField: 'players',
			foreignKey: 'player_id'
		    }
		}
	    }
	});

    var Record = store.defineResource({
	    name: 'record',
	    relations: {
		belongsTo: {
		    person: {
			localField: 'person',
			localKey: 'person_id'
		    }
		}
	    }
	});

    Person.create({ name: 'Kilgore Trout', sex: 'male' }).then(function(person) {
	    console.log("Created " + person.name);
	});
}
