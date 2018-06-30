<?php
#-----------------------------------------------------------------------------#
# File: tournament.php
# Author: Conrad Damon
# Date: 02/01/2017
#
# Allows an admin to add or edit a tournament.
#-----------------------------------------------------------------------------#

require_once('db.php');
require_once('log.php');
require_once('util.php');
require_once('auth.php');

$debug = true;
$db_no_writes = $debug;
#var_dump($_POST);

$tournamentId = get_input('tournamentId', 'post');
$editMode = ($tournamentId > 0);
elog(LOG_INFO, "post to tournament.php, edit mode: " . $tournamentId);

$textFields = array('name', 'td_name', 'td_email', 'password', 'location', 'url', 'divisions', 'pools', 'note', 'scoring', 'scoring_team', 'ddc_team', 'freestyle_team', 'countdown_base', 'mixed_team', 'mixed_team_scoring', 'scoring_dns', 'scoring_scratches');
$numericFields = array('min_events');
$booleanFields = array('test', 'junior_scoring_separate');
$dateFields = array('start', 'end');
$allFields = array_merge($textFields, $numericFields, $booleanFields, $dateFields);

if ($tournamentId) {

  // look for changes to tournament info other than events
  $sql = "SELECT * FROM tournament WHERE id=$tournamentId";
  $result = db_query($sql, 'one');
  $update = array();
  foreach ($allFields as $f) {
    $formVal = getValue($f, get_input($f, 'post'));
    //    $curVal = getValue($f, $result[$f]);
    $curVal = $result[$f];
    $isText = in_array($f, $textFields);
    if ($debug) {
      elog(LOG_INFO, $f . ": comparing form val [" . $formVal . "] to cur val [" . $curVal . "]");
    }
    if ($f == 'password' && empty($formVal)) {
      continue;
    }
    if ($formVal !== $curVal) {
      elog(LOG_INFO, "testing $f");
      if (!$formVal) {
	$formVal = $isText ? '' : '0';
      }
      $val = !in_array($f, $numericFields) && !in_array($f, $booleanFields) ? quote($formVal) : $formVal;
      array_push($update, $f . '=' . $val);
      elog(LOG_INFO, "*** $f has changed!");
    }
  }

  // update db with new tournament info
  if (count($update) > 0) {
    $sql = "UPDATE tournament SET " . implode(',', $update) . " WHERE id=$tournamentId";
    db_query($sql);
  }

  // look for changes to event info; an event that is not part of the tournament may never have been
  // added, or it may have been added and deactivated
  $sql = "SELECT * FROM event WHERE tournament_id=$tournamentId";
  $eventResult = db_query($sql);
  $eventData = array();
  $dbEvents = array();
  foreach ($eventResult as $e) {
    $eventData[$e['name']] = $e;
    array_push($dbEvents, $e['name']);
  }
  $formEvents = get_input('events', 'post');
  $allEvents = array_union($dbEvents, $formEvents);

  foreach ($allEvents as $event) {
    $isDbEvent = in_array($event, $dbEvents);
    $isFormEvent = in_array($event, $formEvents);
    $eventId = $eventData[$event]['id'];
    $isActive = $eventData[$event]['active'] == '1' ? true : false;
    //    elog(LOG_INFO, "Event: " . $event . ' active: ' . $isActive);
    if (!$isDbEvent && $isFormEvent) {
      addEvent($event);
    }
    else if ($isActive && !$isFormEvent) {
      $sql = "UPDATE event SET active=FALSE WHERE id=$eventId";
      db_query($sql);
    }
    else if ($isDbEvent && $isFormEvent) {
      $eventUpdate = array();
      if (!$isActive) {
	array_push($eventUpdate, 'active=TRUE');
      }
      foreach (array('rounds', 'cumulative_rounds') as $prop) {
	$formVal = get_input($event . '_' . $prop, 'post');
	$formVal = !empty($formVal) ? $formVal : 0;
	if ($debug) {
	  //	  elog(LOG_INFO, $event . '_' . $prop . " db val: " . $eventData[$event][$prop] . ', form val: ' . $formVal);
	}
	if ($eventData[$event][$prop] != $formVal) {
	  array_push($eventUpdate, $prop . '=' . quote($formVal));
	}
      }
      if (count($eventUpdate) > 0) {
	$sql = "UPDATE event SET " . implode(',', $eventUpdate) . " WHERE id=$eventId";
	db_query($sql);
      }
    }
  }
}
else {
  // add tournament info
  $data = array();
  foreach ($allFields as $f) {
    $val = getValue($f, get_input($f, 'post'));
    //    elog(LOG_INFO, $f . ' = ' . $val);
    $data[$f] = !in_array($f, $numericFields) ? quote($val) : $val;
  }
  $keys = array();
  $values = array();
  foreach ($data as $key => $value) {
    array_push($keys, $key);
    array_push($values, $value);
  }
  $sql = "INSERT INTO tournament(" . implode(',', $keys) . ") VALUES (" . implode(',', $values) . ")";
  $tournamentId = db_query($sql);
  set_auth($tournamentId);
  elog(LOG_INFO, "added tournament with ID: $tournamentId");

  // add event info
  $events = get_input('events', 'post');
  foreach ($events as $event) {
    addEvent($event);
  }
}

header("Location: /admin/tournament.html?id=$tournamentId");
die();

function getValue($f, $val) {

  global $textFields, $dateFields, $numericFields, $booleanFields;

  //elog(LOG_INFO, "getValue $f $val");
  $isText = in_array($f, $textFields);
  if (!$val) {
    $val = $isText ? '' : '0';
  }
  else if (is_array($val)) {
    $val = implode(',', $val);
  }
  else if ($f == 'password') {
    $val = get_password_hash($val);
  }
  else if (in_array($f, $dateFields)) {
    $val = date("Y-m-d", strtotime($val));
  }
  else if (in_array($f, $booleanFields)) {
    $val = !!$val;
  }

  //elog(LOG_INFO, "value is now $val");
  return $val;
}

function addEvent($event) {

  global $tournamentId;

  $values = array(quote($event), $tournamentId);
  $rounds = get_input($event . '_rounds', 'post');
  array_push($values, quote($rounds ? $rounds : 1));
  $cumulative = get_input($event . '_cumulative', 'post');
  array_push($values, $cumulative ? $cumulative : 0);
  $sql = "INSERT INTO event(name,tournament_id,rounds,cumulative_rounds) VALUES (" . implode(',', $values) . ")";
  db_query($sql);
}
?>
