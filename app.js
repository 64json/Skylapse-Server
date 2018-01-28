const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const randomstring = require('randomstring');
const morgan = require('morgan');
const request = require('request');
const crypto = require('crypto');
const concat = require('concat-stream');
const { spawn } = require('child_process');
const { mkdir, rmdir, readable } = require('./utils');
const { millisecond, second, minute, hour, day, week, month, year } = require('./units');

const {
  PASSWORD,
  PAGE_ID,
  ACCESS_TOKEN,
  WEBHOOK_SECRET,
} = process.env;

const output = path.resolve(__dirname, 'output');
const dirPictures = path.resolve(output, 'pictures');
const dirTemp = path.resolve(output, 'temp');
const dirVideos = path.resolve(output, 'videos');
const dirHourlyVideos = path.resolve(dirVideos, 'hourly');
const dirDailyVideos = path.resolve(dirVideos, 'daily');
const dirWeeklyVideos = path.resolve(dirVideos, 'weekly');
const dirMonthlyVideos = path.resolve(dirVideos, 'monthly');
const dirYearlyVideos = path.resolve(dirVideos, 'yearly');

const app = express();
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    mkdir(dirPictures);
    cb(null, dirPictures);
  },
  filename: (req, file, cb) => cb(null, req.params.taken_at + '.jpg'),
});
const upload = multer({ storage });
let randomEndpoint = null;

app.use(morgan('dev'));

app.post('/apply_release', (req, res) => {
  req.pipe(concat(data => {
    const hmac = crypto.createHmac('sha1', WEBHOOK_SECRET);
    const signature_delivered = req.headers['x-hub-signature'];
    const signature_created = 'sha1=' + hmac.update(data).digest('hex');
    if (signature_delivered !== signature_created) return res.status(500).send({});
    res.send({});
    const command = spawn('sh', [path.resolve(__dirname, 'bin', 'pull.sh')]);
    command.stdout.on('data', data => console.info(data.toString()));
    command.stderr.on('data', data => console.error(data.toString()));
    command.on('exit', code => console.info(`child process exited with code ${code}`));
  }));
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/auth', (req, res) => {
  const { password } = req.body;
  if (password !== PASSWORD) {
    res.status(401);
    res.json({ error: 'wrong_password' });
    return;
  }
  randomEndpoint = randomstring.generate(8);
  res.json({ endpoint: randomEndpoint });
});

app.post('/:endpoint/:taken_at', (req, res, next) => {
  const { endpoint } = req.params;
  if (endpoint !== randomEndpoint) {
    res.status(401);
    res.json({ error: 'wrong_endpoint' });
    return;
  }
  next();
}, upload.single('picture'), (req, res, next) => {
  const { taken_at } = req.params;
  res.json({ taken_at });

  mergeHourly(12 * second)
    .then(mergeDaily)
    .then(mergeWeekly)
    .then(mergeMonthly)
    .then(mergeYearly)
    .catch(console.error);
});

const postVideo = (path, description, callback) => {
  const formData = {
    access_token: ACCESS_TOKEN,
    source: fs.createReadStream(path),
    description,
  };
  request.post({
    url: `https://graph-video.facebook.com/v2.11/${PAGE_ID}/videos`,
    formData,
  }, (err, httpResponse, body) => callback(err, body));
};

const merger = (tag, period, src, dest, speed = 1) => interval => new Promise((resolve, reject) => {
  const limit = period / interval;
  const files = fs.readdirSync(src).sort();
  if (files.length >= limit) {
    const tmp = path.resolve(dirTemp, randomstring.generate(8));
    mkdir(dest);
    mkdir(tmp);
    const [name, ext] = files[files.length - 1].split('.');
    const outputFile = name + '.mp4';
    files.forEach((file, i) => {
      const oldPath = path.resolve(src, file);
      const newFile = `${i}.${ext}`;
      const newPath = path.resolve(tmp, newFile);
      fs.renameSync(oldPath, newPath);
    });
    let args = '';
    const outputPath = path.resolve(dest, outputFile);
    if (ext === 'mp4') {
      const inputPath = path.resolve(tmp, 'list.txt');
      const list = files.map((_, i) => `file './${i}.mp4'`);
      fs.writeFileSync(inputPath, list.join('\n'));
      args = `-f concat -safe 0 -i ${inputPath} -preset ultrafast -filter:v setpts=PTS/${speed} -c:a copy -nostdin -an ${outputPath}`;
    } else if (ext === 'jpg') {
      const inputPath = './%d.jpg';
      args = `-f image2 -r ${30 * speed} -i ${inputPath} -c:v libx264 -pix_fmt yuv420p ${outputPath}`;
    }
    const ffmpeg = spawn('ffmpeg', args.split(' '), { cwd: tmp });
    ffmpeg.stdout.on('data', data => console.log(data.toString()));
    ffmpeg.stderr.on('data', data => console.error(data.toString()));
    ffmpeg.on('close', (code, signal) => {
      if (code) {
        reject({ code, signal });
        return;
      }
      rmdir(tmp);

      const description = [
        `Time-lapse over ${readable(period)}.`,
        `Created at ${new Date(parseInt(name))}.`,
        '',
        `#skylapse_hays_${tag}`,
      ].join('\n');
      postVideo(outputPath, description, (err, response) => {
        if (err) {
          reject(err);
          return;
        }
        console.log(response);
        resolve(period);
      });
    });
  }
});

const mergeHourly = merger('hourly', hour, dirPictures, dirHourlyVideos); // 10 sec
const mergeDaily = merger('daily', day, dirHourlyVideos, dirDailyVideos, 2); // 2 min
const mergeWeekly = merger('weekly', week, dirDailyVideos, dirWeeklyVideos, 2); // 7 min
const mergeMonthly = merger('monthly', month, dirWeeklyVideos, dirMonthlyVideos, 2); // 14 min
const mergeYearly = merger('yearly', year, dirMonthlyVideos, dirYearlyVideos, 2); // 91 min

module.exports = app;