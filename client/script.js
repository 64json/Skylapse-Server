/**
 * References
 * -
 * https://developers.google.com/web/fundamentals/media/capturing-images/
 * https://github.com/samdutton/simpl
 * https://github.com/muaz-khan/Ffmpeg.js
 * https://github.com/antimatter15/whammy
 */

const container = document.getElementById('container');
const form = document.getElementById('form');
const select_deviceId = document.getElementById('select_deviceId');
const input_password = document.getElementById('input_password');
const player = document.getElementById('player');
const logger = document.getElementById('logger');

navigator.mediaDevices.enumerateDevices()
  .then(deviceInfos => {
    for (let i = 0; i !== deviceInfos.length; ++i) {
      const deviceInfo = deviceInfos[i];
      const option = document.createElement('option');
      option.value = deviceInfo.deviceId;
      if (deviceInfo.kind === 'videoinput') {
        option.text = deviceInfo.label || 'camera ' + (select_deviceId.length + 1);
        select_deviceId.appendChild(option);
      }
    }
  })
  .catch(console.error);

form.addEventListener('submit', e => {
  e.preventDefault();
  const deviceId = select_deviceId.value;
  const password = input_password.value;

  auth(password, endpoint => {
    container.classList.add('play');
    navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: deviceId }
      }
    })
      .then(mediaStream => {
        player.srcObject = mediaStream;
        const mediaStreamTrack = mediaStream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(mediaStreamTrack);

        setInterval(() => {
          imageCapture.takePhoto()
            .then(picture => postPicture(endpoint, picture))
            .catch(console.error);
        }, .5 * 1000);
      })
      .catch(console.error);
  });
});

function auth(password, callback) {
  const data = { password };
  $.ajax({
    url: '/auth',
    type: 'POST',
    data,
    cache: false,
    success: (data, status, xhr) => {
      console.log(xhr.responseText);
      callback(data.endpoint);
    },
    error: (xhr, status, data) => {
      console.error(xhr.responseText);
    },
  });
}

const postPicture = (endpoint, picture) => {
  const taken_at = Date.now();
  const data = new FormData();
  data.append('picture', picture);
  $.ajax({
    url: `/${endpoint}/${taken_at}`,
    type: 'POST',
    data,
    processData: false,
    contentType: false,
    cache: false,
    success: (data, status, xhr) => {
      console.log(xhr.responseText);
    },
    error: (xhr, status, data) => {
      console.error(xhr.responseText);
    },
  });
};

const originalConsole = window.console;

function intercept(method, args) {
  const message = Array.prototype.slice.apply(args).join(' ');
  const line = document.createElement('span');
  line.classList.add('line');
  line.classList.add(method);
  line.appendChild(document.createTextNode(message));
  logger.appendChild(line);
  if (logger.children.length > 1000) {
    logger.removeChild(logger.children[0]);
  }
  line.scrollIntoView();
  originalConsole[method].apply(originalConsole, args);
}

window.console = {
  log: function () {
    intercept('log', arguments);
  },
  warn: function () {
    intercept('warn', arguments);
  },
  error: function () {
    intercept('error', arguments);
  }
};