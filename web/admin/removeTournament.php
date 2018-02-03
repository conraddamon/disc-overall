<?php
#-----------------------------------------------------------------------------#
# File: removeTournament.php
# Author: Conrad Damon
# Date: 03/01/2017
#
# Remove a tournament and its associated data from the DB. Cleanup only. Be very
# careful!
#-----------------------------------------------------------------------------#

require_once('db.php');
require_once('log.php');
require_once('util.php');
require_once('auth.php');
require_once('overall.php');

$tournamentId = get_input('id', 'get');

if (!$tournamentId) {
  echo "Need to provide tournament ID.";
  die();
}

include 'overall_auth.php';

echo <<< EOF
<!doctype html>
<html>
<head>
  <title>Remove tournament</title>
</head>
<body>
EOF;

$title = getTournamentTitle($tournamentId);  
$confirmed = get_input('ok', 'get');
if ($confirmed != 'yes') {
  echo "<div>Remove $title and all its data? <a href='removeTournament.php?id=$tournamentId&ok=yes'>Yes</a></div>";
}
else {
  $sql = "DELETE result FROM `result` INNER JOIN player ON result.player_id=player.id WHERE player.tournament_id=$tournamentId";
  $count = db_query($sql);
  echo "<div>Removed $count results</div>";
  $sql = "DELETE FROM player WHERE tournament_id=$tournamentId";
  $count = db_query($sql);
  echo "<div>Removed $count players</div>";
  $sql = "SELECT * FROM `event` WHERE tournament_id=$tournamentId AND (name='ddc' OR name='freestyle')";
  $result = db_query($sql);
  if ($result) {
    foreach ($result as $r) {
      $eventName = $r['name'];
      $eventId = $r['id'];
      $sql = "DELETE FROM team WHERE event_id=$eventId";
      $count = db_query($sql);
      echo "<div>Removed $count $eventName teams</div>";
    }
  }
  $sql = "DELETE FROM event WHERE tournament_id=$tournamentId";
  $count = db_query($sql);
  echo "<div>Removed $count events</div>";
  $sql = "DELETE FROM tournament WHERE id=$tournamentId";
  db_query($sql);
  echo "<div>Removed $title</div>";
}

echo "</body></html>";
?>
