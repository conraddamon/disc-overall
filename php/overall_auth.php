<?php
#-----------------------------------------------------------------------------#
# Auth preamble for HARV 3000. Include this file if password authentication is
# required. 
#-----------------------------------------------------------------------------#
require_once('auth.php');
require_once('overall.php');

$pw = get_input('password', 'post');
$authenticated = false;

// see if user just filled in the login form with the password
if ($pw) {
  $db_pw = $tournamentData['password'];
  if (verify_password($pw, $db_pw)) {
    set_auth($tournamentId);
    $authenticated = true;
  }
  else {
    $loginTarget = getTournamentTitle($tournamentData);
    $loginError = "Invalid password. Please try again.";
    include 'login.html';
    die();
  }
}

// if user did not just login, check auth token in cookie to make sure they're authenticated
if ($tournamentId && !($authenticated || check_auth_token($tournamentId))) {
  $loginTarget = getTournamentTitle($tournamentData ? $tournamentData : $tournamentId);
  include 'login.html';
  die();
}
?>
