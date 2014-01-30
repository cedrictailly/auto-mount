
var fs     = require('fs'),
    path   = require('path'),
    xml2js = require('xml2js'),
    dns    = require('dns'),
    cp     = require('child_process');

var localhost = require("os").hostname().toLowerCase(),
    states    = {};

// --- Process -------------------------------------------------------------- //

function process()
{
  var title  = ' ' + new Date().toString() + ' ',
      hr     = '',
      logged = false;

  while ( hr.length < title.length )
    hr += '-';

  // --- //

  cp.exec('ipconfig', function puts(error, stdout, stderr)
  {
    var localips = stdout.match(/\b\d+\.\d+\.\d+\.\d+\b/g);

    xml2js.parseString(fs.readFileSync(path.join(__dirname, 'auto-mount.xml')), function(err, result)
    {
      var remaining = result.hosts.host.length;

      function finishedHost()
      {
        if ( --remaining > 0 )
          return;

        if ( logged )
          console.log('\n => Finished');

        setTimeout(process, 10000);
      }

      // --- //

      result.hosts.host.forEach(function(host)
      {
        var hostname = host['$'].name,
            state    = null;

        function finished(state, ip)
        {
          var cmds = {};

          // Commands

          for ( var i = 0, im = host.drive.length ; i < im ; i++ )
          {
            var drive  = host.drive[i],
                letter = drive['$'].letter.toUpperCase();

            switch ( state )
            {
            case 'local':

              if ( drive['$'].subst )
              {
                var distant = drive['$'].distant.replace(/^(\w)\$/, '$1:').replace(/\\$/, '') + '\\';

                distant = distant.substr(0, 1).toUpperCase() + distant.substr(1);

                cmds[letter] = 'subst ' + letter + ': "' + distant + '"';
              }

              break;

            case 'online':

              cmds[letter] = 'net use ' + letter + ': "\\\\' + ip + '\\' + drive['$'].distant + '" /persistent:yes';

              break;
            }

            if ( !cmds[letter] )
              cmds[letter] = null;
          };

          // State

          var description = JSON.stringify(cmds);

          if ( states[hostname] == description ) {
            finishedHost();
            return;
          }

          states[hostname] = description;

          // Header

          if ( !logged )
          {
            console.log("\n" + hr + "\n" + title + "\n" + hr);

            logged = true;
          }

          // Execute commands

          console.log("\n - " + hostname + ' > ' + state + "\n");

          var remaining_cmds = host.drive.length;

          Object.keys(cmds).forEach(function(letter)
          {
            var cmd = cmds[letter] || 'net use ' + letter + ': /delete & subst ' + letter + ': /d';

            console.log('   ' + letter + ': > ' + cmd);

            cp.exec(cmd, function(error, stdout, stderr)
            {
              if ( !cmds[letter] && fs.existsSync(letter + ':') )
                states[hostname] = null;

              if ( --remaining_cmds == 0 )
                finishedHost();
            });
          });
        }

        // --- //

        if ( hostname.toLowerCase() == localhost || localips.indexOf(hostname) != -1 ) {
          finished('local');
          return;
        }

        cp.exec('ping -4 -n 1 ' + hostname, function puts(error, stdout, stderr)
        {
          var matches = stdout.match(/\b\d+\.\d+\.\d+\.\d+\b/);

          if ( error )
            finished('offline');
          else if ( !matches )
            finished('offline');
          else if ( localips.indexOf(matches[0]) != -1 )
            finished('local');
          else
            finished('online', matches[0]);
        });
      });
    });
  });
}

// --- Main ----------------------------------------------------------------- //

process();

// -------------------------------------------------------------------------- //
