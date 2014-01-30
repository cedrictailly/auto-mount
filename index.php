<?php

$options = array(
  'ping-timeout' => 600
);

// --- Main ----------------------------------------------------------------- //

while ( true )
{
  $message = ' Updating '.date('(l G:i:s:u d/m/Y) ');
  $line    = str_pad('', strlen($message), '-');

  echo "\n".$line."\n".$message."\n".$line."\n";

  $path   = substr(__FILE__, 0, -4).'.xml';
  $drives = @simplexml_load_file($path);

  if ( !$drives ) {
    echo " *** ".$path." doesn't exists.\n";
    exit(1);
  }

  foreach ( $drives->host as $host )
  {
    $hostname = (string)$host->attributes()->name;

    echo "\n - ".$hostname;

    // Vérification si disponible

    $add = true;

    if ( mb_strtolower($hostname) == mb_strtolower(php_uname('n')) )
    {
      $ip = '127.0.0.1';

      $add = false;
    }
    else if ( filter_var($hostname, FILTER_VALIDATE_IP) )
    {
      $ip = $hostname;
    }
    else
    {
      $ip = gethostbyname($hostname);

      if ( $ip == $hostname )
        $add = false;
    }

    if ( $add )
    {
      exec('ping -w '.$options['ping-timeout'].' -n 1 '.$ip, $output, $code);

      if ( $code != 0 )
        $add = false;
    }

    // Affichage de l'état de l'host

    if ( $ip == '127.0.0.1' )
      $state = 'local';
    else if ( $add )
      $state = 'online';
    else
      $state = 'offline';

    echo ' > '.$state."\n\n";

    // Mise à jour des partages

    foreach ( $host->drive as $drive )
    {
      $attributes = $drive->attributes();
      $letter     = strtoupper($attributes->letter);
      $force      = strtolower($attributes->force) == 'true' || intval($attributes->force);

      if ( $ip == '127.0.0.1' )
      {
        if ( $force )
          $cmd = 'if not exist '.$letter.': subst '.$letter.': "'.ucfirst(trim(preg_replace('/^(\w)\$(.*)$/', '$1:$2', $attributes->distant), '\\')).'\\"';
        else
          $cmd = 'if exist '.$letter.': subst '.$letter.': /d';
      }
      else
      {
        if ( $add )
          $cmd = 'if not exist '.$letter.': net use '.$letter.': "\\\\'.$ip.'\\'.$attributes->distant.'" /persistent:yes';
        else
          $cmd = 'if exist '.$letter.': net use '.$letter.': /delete';
      }

      echo '   '.$cmd;
      exec($cmd.'>nul 2>&1', $output, $code);

      if ( $code != 0 )
        echo ' *** Error';

      echo "\n";
    }
  }

  echo "\n => Finished\n";

  sleep(60);
}

// -------------------------------------------------------------------------- //
