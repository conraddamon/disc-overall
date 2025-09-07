<?php

require_once('common.php');
require_once('util.php');

$DIV_NAME = array(
    'O' => 'Open',
    'OM' => 'Open Master',
    'OGM' => 'Open Grand Master',
    'OSGM' => 'Open Senior Grand Master',
    'OL' => 'Open Legend',
    'OJ' => 'Open Junior',
    'W' => 'Women',
    'WM' => 'Women Master',
    'WGM' => 'Women Grand Master',
    'WSGM' => 'Women Senior Grand Master',
    'WL' => 'Women Legend',
    'WJ' => 'Women Junior',
    'MX' => 'Mixed'
);

$event_order = array('golf', 'distance', 'accuracy', 'scf', 'mta', 'trc', 'discathon', 'ddc', 'freestyle');

# capitalizes and event; three-letter event names are recognized as acronyms
function capitalizeEvent($event) {

  return strlen($event) == 3 ? strtoupper($event) : ucfirst($event);
}

# returns text that looks like a link
function getLink($str) {

  return "[ <span class='pageLink' id='" . $str . "'>" . capitalizeEvent($str) . "</span> ]\n";
}

# returns a set of links to a tournament's events
function getEventLinks($tournamentId, $data, $omit=array(), $isAdmin=false, $isArchive=false, $test=false) {

  if (!$data) {
    $sql = "SELECT * FROM event WHERE tournament_id=$tournamentId AND active=true";
    $data = db_query($sql);
  }

  $result = array_filter($data, function($e) { return $e['name'] === 'scf'; });
  if (count($result) > 0 && !(isset($omit['scf']) && $omit['scf'])) {
    $omit['mta'] = true;
    $omit['trc'] = true;
  }
  
  if ($isArchive) {
    $omit = array();
  }

  $eventLinks = '';
  if ($data) {
    $events = array_map(function($e) { return $e['name']; }, $data);
    usort($events, function($a, $b) {
	global $event_order;
	return array_search($a, $event_order) - array_search($b, $event_order);
      });
    foreach ($events as $event) {
      if (!(isset($omit[$event]) && $omit[$event])) {
	$eventLinks .= getLink($event);
      }
    }
  }

  if ($isAdmin) {
    $test_param = isset($test) ? '&test' : '';
    $eventLinks .= ' [ <a href="./tournament.html?id=' . $tournamentId . "$test_param\" class='pageLink'>Admin</a> ]";
  }

  return $eventLinks;
}

function getAdminLinks($dir='.') {

  $page = $_SERVER['PHP_SELF'];

  $extra = propagate_params(true);

  $text = '';
  if (strpos($page, 'admin/index') === false) {
    $text .= "[ <a href='$dir/index.html$extra' class='pageLink'>Admin home</a> ]";
  }
  if (strpos($page, 'guide') === false) {
    $text .= "[ <a href='$dir/guide.html$extra' class='pageLink'>Admin guide</a> ]";
  }
  if (strpos($page, 'cheatsheet') === false) {
    $text .= "[ <a href='$dir/cheatsheet.html$extra' class='pageLink'>Cheat sheet</a> ]";
  }
  if (strpos($page, 'tutorial') === false) {
    $text .= "[ <a href='$dir/tutorial/$extra' class='pageLink'>Tutorial</a> ]";
  }
  if (strpos($page, 'tournament') === false) {
    $text .= "[ <a href='$dir/tournament.html$extra' class='pageLink'>New tournament</a> ]";
  }
  return "<div class='pageLinks'>$text</div>";
}

function getSeriesAdminLinks($test, $dir='.') {

  $page = $_SERVER['PHP_SELF'];
  $test_param = isset($test) ? '?test' : '';

  $text = '';
  if (strpos($page, 'admin/index') === false) {
    $text .= "[ <a href='$dir/index.html$test_param' class='pageLink'>Series admin home</a> ]";
  }
  if (strpos($page, 'series.html') === false) {
    $text .= "[ <a href='$dir/series.html$test_param' class='pageLink'>New series</a> ]";
  }
  return "<div class='pageLinks'>$text</div>";
}

# returns the HARV banner
function getHarv() {

  $html = <<< EOF
  <div class="acronym">
    <span class="big">H</span>
    <span class="small">ighly</span>
    <span class="big">A</span>
    <span class="small">ccurate</span>
    <span class="big">R</span>
    <span class="small">esults</span>
    <span class="big">V</span>
    <span class="small">erifier</span>
  </div>
EOF;

  return $html;
}
?>
