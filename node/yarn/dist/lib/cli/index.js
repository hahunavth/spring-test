'use strict';

var _index;

function _load_index() {
  return _index = require('../reporters/index.js');
}

var _misc;

function _load_misc() {
  return _misc = require('../util/misc.js');
}

var _index2;

function _load_index2() {
  return _index2 = require('../registries/index.js');
}

var _index3;

function _load_index3() {
  return _index3 = _interopRequireWildcard(require('./commands/index.js'));
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../constants.js'));
}

var _network;

function _load_network() {
  return _network = _interopRequireWildcard(require('../util/network.js'));
}

var _errors;

function _load_errors() {
  return _errors = require('../errors.js');
}

var _aliases;

function _load_aliases() {
  return _aliases = _interopRequireDefault(require('./aliases.js'));
}

var _config;

function _load_config() {
  return _config = _interopRequireDefault(require('../config.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

const camelCase = require('camelcase');

const chalk = require('chalk');
const commander = require('commander');
const fs = require('fs');
const invariant = require('invariant');
const lockfile = require('proper-lockfile');
const loudRejection = require('loud-rejection');
const net = require('net');
const onDeath = require('death');
const path = require('path');
const pkg = require('../../package.json');

loudRejection();

//
const startArgs = process.argv.slice(0, 2);
let args = process.argv.slice(2);

// ignore all arguments after a --
let endArgs = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--') {
    endArgs = args.slice(i + 1);
    args = args.slice(0, i);
  }
}

// set global options
commander.version(pkg.version);
commander.usage('[command] [flags]');
commander.option('--offline');
commander.option('--prefer-offline');
commander.option('--strict-semver');
commander.option('--json', '');
commander.option('--global-folder <path>', '');
commander.option('--modules-folder <path>', 'rather than installing modules into the node_modules folder relative to the cwd, output them here');
commander.option('--cache-folder <path>', 'specify a custom folder to store the yarn cache');
commander.option('--mutex <type>[:specifier]', 'use a mutex to ensure only one yarn instance is executing');
commander.option('--no-emoji', 'disable emoji in output');

// get command name
let commandName = args.shift() || '';
let command;

//
const hyphenate = string => string.replace(/[A-Z]/g, match => '-' + match.charAt(0).toLowerCase());
const getDocsLink = name => `https://yarnpkg.com/en/docs/cli/${ name || '' }`;
const getDocsInfo = name => 'Visit ' + chalk.bold(getDocsLink(name)) + ' for documentation about this command.';

//
if (commandName === 'help' || commandName === '--help' || commandName === '-h') {
  commandName = 'help';
  if (args.length) {
    const helpCommand = hyphenate(args[0]);
    if ((_index3 || _load_index3())[helpCommand]) {
      commander.on('--help', () => console.log('  ' + getDocsInfo(helpCommand) + '\n'));
    }
  } else {
    commander.on('--help', () => {
      console.log('  Commands:\n');
      for (const name of Object.keys(_index3 || _load_index3()).sort((_misc || _load_misc()).sortAlpha)) {
        if ((_index3 || _load_index3())[name].useless) {
          continue;
        }

        console.log(`    - ${ hyphenate(name) }`);
      }
      console.log('\n  Run `' + chalk.bold('yarn help COMMAND') + '` for more information on specific commands.');
      console.log('  Visit ' + chalk.bold(getDocsLink()) + ' to learn more about Yarn.\n');
    });
  }
}

// if no args or command name looks like a flag then default to `install`
if (!commandName || commandName[0] === '-') {
  if (commandName) {
    args.unshift(commandName);
  }
  commandName = 'install';
}

// aliases: i -> install
if (commandName && typeof (_aliases || _load_aliases()).default[commandName] === 'string') {
  const alias = (_aliases || _load_aliases()).default[commandName];
  command = {
    run(config, reporter) {
      throw new (_errors || _load_errors()).MessageError(`Did you mean \`yarn ${ alias }\`?`);
    }
  };
}

//
if (commandName === 'help' && args.length) {
  commandName = camelCase(args.shift());
  args.push('--help');
}

//
invariant(commandName, 'Missing command name');
command = command || (_index3 || _load_index3())[camelCase(commandName)];

//
if (command && typeof command.setFlags === 'function') {
  command.setFlags(commander);
}

if (commandName === 'help' || args.indexOf('--help') >= 0 || args.indexOf('-h') >= 0) {
  const examples = command && command.examples || [];
  if (examples.length) {
    commander.on('--help', () => {
      console.log('  Examples:\n');
      for (const example of examples) {
        console.log(`    $ yarn ${ example }`);
      }
      console.log();
    });
  }

  commander.parse(startArgs.concat(args));
  commander.help();
  process.exit(1);
}

//
if (!command) {
  args.unshift(commandName);
  command = (_index3 || _load_index3()).run;
}
invariant(command, 'missing command');

// parse flags
commander.parse(startArgs.concat(args));
commander.args = commander.args.concat(endArgs);

//
let Reporter = (_index || _load_index()).ConsoleReporter;
if (commander.json) {
  Reporter = (_index || _load_index()).JSONReporter;
}
const reporter = new Reporter({
  emoji: commander.emoji && process.stdout.isTTY && process.platform === 'darwin'
});
reporter.initPeakMemoryCounter();

//
const config = new (_config || _load_config()).default(reporter);

// print header
let outputWrapper = true;
if (typeof command.hasWrapper === 'function') {
  outputWrapper = command.hasWrapper(commander, commander.args);
}
if (outputWrapper) {
  reporter.header(commandName, pkg);
}

if (command.noArguments && commander.args.length) {
  reporter.error(reporter.lang('noArguments'));
  reporter.info(getDocsInfo(commandName));
  process.exit(1);
}

//
if (commander.yes) {
  reporter.warn(reporter.lang('yesWarning'));
}

//
if (!commander.offline && (_network || _load_network()).isOffline()) {
  reporter.warn(reporter.lang('networkWarning'));
}

//
if (command.requireLockfile && !fs.existsSync(path.join(config.cwd, (_constants || _load_constants()).LOCKFILE_FILENAME))) {
  reporter.error(reporter.lang('noRequiredLockfile'));
  process.exit(1);
}

//
const run = () => {
  invariant(command, 'missing command');
  return command.run(config, reporter, commander, commander.args).then(() => {
    reporter.close();
    if (outputWrapper) {
      reporter.footer(false);
    }
  });
};

//
const runEventuallyWithFile = (mutexFilename, isFirstTime) => {
  return new Promise(ok => {
    const lockFilename = mutexFilename || path.join(config.cwd, (_constants || _load_constants()).SINGLE_INSTANCE_FILENAME);
    lockfile.lock(lockFilename, { realpath: false }, (err, release) => {
      if (err) {
        if (isFirstTime) {
          reporter.warn(reporter.lang('waitingInstance'));
        }
        setTimeout(() => {
          ok(runEventuallyWithFile());
        }, 200); // do not starve the CPU
      } else {
        onDeath(() => {
          process.exit(1);
        });
        ok(run().then(release));
      }
    });
  });
};

//
const runEventuallyWithNetwork = mutexPort => {
  return new Promise(ok => {
    const connectionOptions = {
      port: +mutexPort || (_constants || _load_constants()).SINGLE_INSTANCE_PORT
    };

    const clients = [];
    const server = net.createServer(client => {
      clients.push(client);
    });

    server.on('error', () => {
      // another yarnn instance exists, let's connect to it to know when it dies.
      reporter.warn(reporter.lang('waitingInstance'));
      const socket = net.createConnection(connectionOptions);

      socket.on('data', () => {
        // the server has informed us he's going to die soon???.
        socket.unref(); // let it die
        process.nextTick(() => {
          ok(runEventuallyWithNetwork());
        });
      }).on('error', () => {
        // No server to listen to ? :O let's retry to become the next server then.
        process.nextTick(() => {
          ok(runEventuallyWithNetwork());
        });
      });
    });

    const onServerEnd = () => {
      clients.forEach(client => {
        client.write('closing. kthanx, bye.');
      });
      server.close();
      return Promise.resolve();
    };

    // open the server and continue only if succeed.
    server.listen(connectionOptions, () => {
      // ensure the server gets closed properly on SIGNALS.
      onDeath(onServerEnd);

      ok(run().then(onServerEnd));
    });
  });
};

function onUnexpectedError(err) {
  function indent(str) {
    return '\n  ' + str.trim().split('\n').join('\n  ');
  }

  const log = [];
  log.push(`Arguments: ${ indent(process.argv.join(' ')) }`);
  log.push(`PATH: ${ indent(process.env.PATH || 'undefined') }`);
  log.push(`Yarn version: ${ indent(pkg.version) }`);
  log.push(`Node version: ${ indent(process.versions.node) }`);
  log.push(`Platform: ${ indent(process.platform + ' ' + process.arch) }`);

  // add manifests
  for (const registryName of (_index2 || _load_index2()).registryNames) {
    const possibleLoc = path.join(config.cwd, (_index2 || _load_index2()).registries[registryName].filename);
    const manifest = fs.existsSync(possibleLoc) ? fs.readFileSync(possibleLoc, 'utf8') : 'No manifest';
    log.push(`${ registryName } manifest: ${ indent(manifest) }`);
  }

  // lockfile
  const lockLoc = path.join(config.cwd, (_constants || _load_constants()).LOCKFILE_FILENAME);
  const lockfile = fs.existsSync(lockLoc) ? fs.readFileSync(lockLoc, 'utf8') : 'No lockfile';
  log.push(`Lockfile: ${ indent(lockfile) }`);

  log.push(`Trace: ${ indent(err.stack) }`);

  const errorLoc = path.join(config.cwd, 'yarn-error.log');
  fs.writeFileSync(errorLoc, log.join('\n\n') + '\n');

  reporter.error(reporter.lang('unexpectedError', errorLoc));
}

//
config.init({
  modulesFolder: commander.modulesFolder,
  globalFolder: commander.globalFolder,
  cacheFolder: commander.cacheFolder,
  preferOffline: commander.preferOffline,
  captureHar: commander.har,
  ignorePlatform: commander.ignorePlatform,
  ignoreEngines: commander.ignoreEngines,
  offline: commander.preferOffline || commander.offline,
  looseSemver: !commander.strictSemver
}).then(() => {
  const exit = () => {
    process.exit(0);
  };

  const mutex = commander.mutex;
  if (mutex && typeof mutex === 'string') {
    const parts = mutex.split(':');
    const mutexType = parts.shift();
    const mutexSpecifier = parts.join(':');

    if (mutexType === 'file') {
      return runEventuallyWithFile(mutexSpecifier, true).then(exit);
    } else if (mutexType === 'network') {
      return runEventuallyWithNetwork(mutexSpecifier).then(exit);
    } else {
      throw new (_errors || _load_errors()).MessageError(`Unknown single instance type ${ mutexType }`);
    }
  } else {
    return run().then(exit);
  }
}).catch(err => {
  if (err instanceof (_errors || _load_errors()).MessageError) {
    reporter.error(err.message);
  } else {
    onUnexpectedError(err);
  }

  const actualCommandForHelp = (_index3 || _load_index3())[commandName] ? commandName : (_aliases || _load_aliases()).default[commandName];
  if (actualCommandForHelp) {
    reporter.info(getDocsInfo(actualCommandForHelp));
  }

  process.exit(1);
});