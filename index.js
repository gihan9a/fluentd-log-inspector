/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const hash = require('crypto').createHash;
const rimraf = require('rimraf');
const readLine = require('readline');

const argv = require('minimist')(process.argv.slice(2));

const exclude = require('./exclude');
const config = require('./config');
const server = require('./server');

const runtimeDir = './runtime';
const inspectedDir = path.join(runtimeDir, 'inspected');

const acceptableLineModes = ['first', 'all'];
let totalLogFiles = 0;
let totalParsed = 0;
const finalData = {};

const tempFiles = [];

// command line arguments
const logDir = argv.dir;
const mode = argv.duplicate || 'first';
// Terminate if log directory has not provided.
if (!logDir) {
  console.log('Please provide log files directory as --dir');
  process.exit(0);
}
// Terminate if unidentified mode has provided.
if (acceptableLineModes.indexOf(mode) === -1) {
  console.log('Only accepts', acceptableLineModes, 'as duplicate check modes');
  process.exit(0);
}

// create inspection dir
// Cleanup if already exists for fresh start.
if (fs.existsSync(inspectedDir)) {
  rimraf.sync(inspectedDir, {});
  fs.mkdirSync(inspectedDir);
} else {
  fs.mkdirSync(inspectedDir);
}

/**
 * Start server
 *
 * @author Gihan S <gihanshp@gmail.com>
 */
function startServer() {
  server(inspectedDir, mode);
}

/**
 * Write categorized data to a file
 *
 * @param {string} type Type of the file
 * @param {int} id Id
 * @param {json} data JSON data to write
 *
 * @author Gihan S <gihanshp@gmail.com>
 */
function writeBatchToFile(type, id, data) {
  // sort each batch according to the number of occurrences
  data.sort((a, b) => {
    if (a.t.length === b.t.length) {
      return 0;
    }
    return a.t.length < b.t.length ? 1 : -1;
  });
  const f = path.join(inspectedDir, `${type}-${id}.json`);
  fs.writeFile(f, JSON.stringify(data), () => {});
}

/**
 * Write final inspected files
 *
 * @author Gihan S <gihanshp@gmail.com>
 */
function writeFinalized() {
  const logs = {};
  const logsCoutner = {};
  const maxLines = 500;

  const categorize = (site, data) => {
    // init
    if (logs[site] === undefined) {
      logs[site] = [];
      logsCoutner[site] = 1;
    }
    logs[site].push(data);

    // should rotate?
    if (logs[site].length % maxLines === 0) {
      writeBatchToFile(site, logsCoutner[site], logs[site]);
      // reset
      logs[site] = [];
      logsCoutner[site] += 1;
    }
  };

  console.log('Categorizing entries into sites');
  Object.keys(finalData).forEach((key) => {
    // categorize errors into sites
    const sites = Object.keys(config);
    let found = false;
    for (let i = 0; i < sites.length; i += 1) {
      const site = sites[i];
      if (finalData[key].m.match(config[site])) {
        categorize(site, finalData[key]);
        found = true;
        break;
      }
    }

    if (!found) {
      categorize('other', finalData[key]);
    }
  });

  // if there are more, write it
  Object.keys(logs).forEach((site) => {
    if (logs[site].length > 0) {
      writeBatchToFile(site, logsCoutner[site], logs[site]);
    }
  });

  console.log('inspection completed!');
  startServer();
}

/**
 * Stage 2 inspection
 *
 * @author Gihan S <gihanshp@gmail.com>
 */
function stage2() {
  console.log('Starting stage 2...');
  Object.keys(finalData).forEach((key) => {
    // ignore "Unable to resolve the request" if it has occurred only one time
    if (
      finalData[key].m.match(/Unable to resolve the request/)
      && finalData[key].t.length === 1
    ) {
      delete finalData[key];
    }
  });
}

/**
 * Stage 1 inspection
 *
 * @author Gihan S <gihanshp@gmail.com>
 */
function stage1() {
  console.log('Starting stage 1...');
  for (let k = 0; k < tempFiles.length; k += 1) {
    const rawData = fs.readFileSync(tempFiles[k], 'utf8');
    const data = JSON.parse(rawData);
    Object.keys(data).forEach((key) => {
      if (finalData[key]) {
        finalData[key].t = finalData[key].t.concat(data[key].t);
      } else {
        finalData[key] = data[key];
      }
    });

    // delete file
    fs.unlink(tempFiles[k], () => {});
  }

  // go to stage 2
  stage2();

  // write finalized
  writeFinalized();
}

/**
 * Parse log file
 *
 * @param {string} file
 *
 * @author Gihan S <gihanshp@gmail.com>
 */
function parseFile(file) {
  const data = {};
  const keyPool = [];
  const filePath = path.join(logDir, file);
  const lineReader = readLine.createInterface({
    input: fs.createReadStream(filePath),
  });
  lineReader.on('line', (line) => {
    // split files by \t
    // <timestamp>\t <log-category>\t <log-message>
    const comps = line.split('\t');

    // exclude non error entries
    if (!comps[1].match(/yii.error/)) {
      return;
    }

    // parse log message as json
    const entry = JSON.parse(comps[2]);
    const { message } = entry.content;

    // exclude common errors defined in /exclude.js
    for (let b = 0; b < exclude.length; b += 1) {
      if (message.match(exclude[b])) {
        return;
      }
    }

    let keyMessage = null;
    if (mode === 'first') {
      [keyMessage] = message.split('\n');
    } else {
      keyMessage = message;
    }

    // generate hash for the message
    const key = hash('sha1').update(keyMessage).digest('base64');

    if (keyPool.indexOf(key) > -1) {
      // add timestamp
      data[key].t.push(comps[0]);
    } else {
      data[key] = {
        m: entry.content.message,
        t: [comps[0]],
      };
      keyPool.push(key);
    }
  });

  /**
   * File read is complete
   */
  lineReader.on('close', () => {
    // store this file's result
    const tempFilePath = path.join(inspectedDir, `temp-${file}`);
    fs.writeFileSync(tempFilePath, JSON.stringify(data));
    tempFiles.push(tempFilePath);

    totalParsed += 1;
    console.log(`Scanned ${file}`);

    // start final inspection
    if (totalParsed === totalLogFiles) {
      stage1();
    }
  });
}

// Start main flow here
console.log('Starting inspection...');
fs.readdir(logDir, (error, files) => {
  if (error) {
    console.log(`Error while reading ${logDir}`);
    return;
  }

  for (let i = 0; i < files.length; i += 1) {
    if (files[i].match(/.log$/)) {
      parseFile(files[i]);
      totalLogFiles += 1;
    }
  }
  console.log(`Found ${totalLogFiles} log files.`);
});
