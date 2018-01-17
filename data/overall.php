<?php
#-----------------------------------------------------------------------------#
# File: overall.php
# Author: Conrad Damon
# Date: 02/02/2017
#
# This file provides an interface to a database storing data related to 
# managing overall tournaments.
#-----------------------------------------------------------------------------#

require_once('db1.php');
require_once('log.php');
require_once('util.php');

$op = get_input('op', 'get');
elog(LOG_INFO, "overall.php, op=$op");

# gets data for a tournament
if ($op == 'get-tournament') {
  $tournamentId = get_input('tournamentId', 'get');
  $sql = "SELECT * FROM tournament WHERE id=$tournamentId";
  $result = db_query($sql, 'one');
}

# gets the names of all known overall players
elseif ($op == 'load-person') {
  $getAll = get_input('getAll', 'get');
  $where = $getAll ? '1' : 'active=1';
  $sql = "SELECT * FROM person WHERE $where";
  $result = db_query($sql);
}

# adds a name to the list of overall players
elseif ($op == 'add-person') {
  $name = db_quote(get_input('name', 'get'));
  $sex = get_input('sex', 'get');
  $sql = "INSERT INTO person(name,sex) VALUES('$name','$sex')";
  $result = db_query($sql);
}

# adds a player to a tournament
elseif ($op == 'add-player') {
  $tournamentId = get_input('tournamentId', 'get');
  $personId = get_input('personId', 'get');
  $division = get_input('division', 'get');
  $sql = "INSERT INTO player(person_id,tournament_id,division) VALUES($personId,$tournamentId,'$division')";
  $result = db_query($sql);
}

# removes a player from a tournament
elseif ($op == 'remove-player') {
  $playerId = get_input('playerId', 'get');
  $sql = "DELETE FROM player WHERE id=$playerId";
  $result = db_query($sql);
}

# gets all the players in the tournament
elseif ($op == 'load-player') {
  $tournamentId = get_input('tournamentId', 'get');
  $getName = get_input('getName', 'get');
  $sql = "SELECT * FROM player WHERE tournament_id=$tournamentId";
  if ($getName) {
    $sql = "SELECT person.name,player.* FROM player INNER JOIN person ON player.person_id=person.id WHERE player.tournament_id=$tournamentId";
  }
  $result = db_query($sql);
}

# gets event info for a tournament
elseif ($op == 'get-event') {
  $tournamentId = get_input('tournamentId', 'get');
  $sql = "SELECT * FROM event WHERE tournament_id=$tournamentId AND active=true";
  $result = db_query($sql);
}

# gets a tournament player
elseif ($op == 'get-player') {
  $playerId = get_input('playerId', 'get');
  $getName = get_input('getName', 'get');
  $sql = "SELECT * FROM player WHERE id=$playerId";
  if ($getName) {
    $sql = "SELECT person.name,player.* FROM player INNER JOIN person ON player.person_id=person.id WHERE player.id=$playerId";
  }
  $result = db_query($sql, 'one');
}

elseif ($op == 'set-pool') {
  $playerId = get_input('playerId', 'get');
  $pool = get_input('pool', 'get');
  $sql = "UPDATE player SET pool='$pool' WHERE id=$playerId";
  $result = db_query($sql);
}

# gets the teams for an event
elseif ($op == 'get-teams') {
  $eventId = get_input('eventId', 'get');
  $sql = "SELECT * FROM team WHERE event_id=$eventId";
  $result = db_query($sql);
}

# adds a team to an event
elseif ($op == 'add-team') {
  $eventId = get_input('eventId', 'get');
  $player1 = get_input('player1', 'get');
  $player2 = get_input('player2', 'get');
  $player3 = get_input('player3', 'get');
  $sql = "INSERT INTO team(event_id, player1, player2, player3) VALUES($eventId, $player1, $player2, $player3)";
  $result = db_query($sql);
}

# adds a player to a team
elseif ($op == 'update-team') {
  $teamId = get_input('teamId', 'get');
  $player = get_input('player', 'get');
  $sql = "UPDATE team SET player3=$player WHERE id=$teamId";
  $result = db_query($sql);
}

# removes a team
elseif ($op == 'remove-team') {
  $teamId = get_input('teamId', 'get');
  $sql = "DELETE FROM team WHERE id=$teamId";
  $result = db_query($sql);
  elog(LOG_INFO, "DELETE: $result");
}

# gets results for an event or tournament
# results can be constrained by division or round, and/or sorted (usually by round)
elseif ($op == 'get-results') {

  $tournamentId = get_input('tournamentId', 'get');
  $event = get_input('event', 'get');
  $eventId = get_input('eventId', 'get');
  $round = get_input('round', 'get');
  $division = get_input('division', 'get');
  $sort = get_input('sort', 'get');
  $roundSql = $round ? " AND result.round=$round" : "";

  $divisionSql = $division ? " AND player.division='$division'" : "";
  if ($division && strpos($division, '*') !== false) {
    $div = substr($division, 0, 1);
    $divisionSql = " AND player.division LIKE '$div%'";
  }

  $fields = "result.id,result.event_id,result.player_id,result.round,result.score";

  $orderBy = $sort ? " ORDER BY $sort" : "";

  // teams events; divisional team events require join on 'team' and 'player' tables to check division
  if ($event == 'ddc' || $event == 'freestyle') {
    $sql = "SELECT $fields FROM result WHERE result.event_id=$eventId" . $roundSql . $orderBy;
    if ($division) {
      $sql = "SELECT $fields FROM result INNER JOIN team ON result.player_id=team.id INNER JOIN player ON team.player1=player.id WHERE result.event_id=$eventId" . $roundSql . $divisionSql . $orderBy;
    }
  }

  // individual events; divisional events require join on 'player' table to check division
  else if ($eventId) {
    $sql = "SELECT $fields FROM result WHERE event_id=$eventId" . $roundSql . $orderBy;
    if ($division) {
      $sql = "SELECT $fields FROM result INNER JOIN player ON result.player_id=player.id WHERE result.event_id=$eventId" .$divisionSql . $roundSql . $orderBy;
    }
  }

  // all events
  else {
    $sql = "SELECT $fields FROM result INNER JOIN event ON result.event_id=event.id WHERE event.tournament_id=$tournamentId" . $roundSql . $orderBy;
    if ($division) {
      $sql = "SELECT $fields FROM result INNER JOIN event ON result.event_id=event.id INNER JOIN player ON result.player_id=player.id WHERE event.tournament_id=$tournamentId" .$divisionSql . $roundSql . $orderBy;
    }
  }
  $result = db_query($sql);
}

# records a result for an event by a player in a round
elseif ($op == 'add-result') {
  $eventId = get_input('eventId', 'get');
  $playerId = get_input('playerId', 'get');
  $round = get_input('round', 'get');
  $score = get_input('score', 'get');
  $sql = "INSERT INTO result(event_id, player_id, round, score) VALUES($eventId, $playerId, $round, $score)";
  $result = db_query($sql);
}

# removes a result
elseif ($op == 'remove-result') {
  $resultId = get_input('resultId', 'get');
  $sql = "DELETE FROM result WHERE id=$resultId";
  $result = db_query($sql);
}

# removes a player from a team
# deletes the team if it had two players; updates it if it had three
elseif ($op == 'remove-team-player') {
  $playerId = get_input('playerId', 'get');
  $sql = "SELECT * FROM team WHERE player1=$playerId OR player2=$playerId OR player3=$playerId";
  $result = db_query($sql);
  foreach ($result as $r) {
    $teamId = $r['id'];
    // two-player team -> delete
    if ($r['player1'] == '0' || $r['player2'] == '0' || $r['player3'] == '0') {
      $sql = "DELETE FROM team WHERE id=$teamId";
      $result = db_query($sql);
    }
    // three-player team -> update
    else {
      unset($r['id']);
      $player = array_search($playerId, $r);
      $sql = "UPDATE team SET $player=0 WHERE id=$teamId";
      $result = db_query($sql);
    }
  }
}

elseif ($op == 'get-records') {
  $sql = "SELECT * FROM record WHERE 1";
  $result = db_query($sql);
}

elseif ($op == 'add-record') {
  $event = get_input('event', 'get');
  $division = get_input('division', 'get');
  $personId = get_input('personId', 'get');
  $score = get_input('score', 'get');
  $sql = "INSERT INTO record(event,division,person_id,score) VALUES('$event','$division',$personId,$score)";
  $result = db_query($sql);
}

elseif ($op == 'set-record') {
  $event = get_input('event', 'get');
  $division = get_input('division', 'get');
  $personId = get_input('personId', 'get');
  $score = get_input('score', 'get');
  $sql = "UPDATE record SET person_id=$personId,score=$score WHERE event='$event' AND division='$division'";
  $result = db_query($sql);
}

echo json_encode($result);
?>
