const path = require('path');
const fs = require('fs');
const { millisecond, second, minute, hour, day, week, month, year } = require('./units');

const mkdir = (dir) => {
  if (fs.existsSync(dir)) return;
  mkdir(path.dirname(dir));
  fs.mkdirSync(dir);
};

const rmdir = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    fs.unlinkSync(path.resolve(dir, file));
  }
  fs.rmdirSync(dir);
};

const readable = v => {
  let prevSize = Number.MAX_VALUE;
  return [
    [year, 'year'],
    [month, 'month'],
    [week, 'week'],
    [day, 'day'],
    [hour, 'hour'],
    [minute, 'minute'],
    [second, 'second'],
    [millisecond, 'millisecond'],
  ].map((size, unit) => {
    const value = v % prevSize / size | 0;
    prevSize = size;
    if (value === 0) return null;
    else if (value === 1) return `${value} ${unit}`;
    else return `${value} ${unit}s`;
  }).filter(v => v).join(' ');
};

module.exports = {
  mkdir,
  rmdir,
  readable,
};