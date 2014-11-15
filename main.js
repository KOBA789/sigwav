function analyzeBPM (buf) {
  var Q = 1;
  var BPM_RANGE_A = 60 * Q,
      BPM_RANGE_B = 200 * Q;
  var FRAME_SIZE = 100;
  
  var channel = buf.getChannelData(0);
  var N = Math.floor(channel.length / 2 / FRAME_SIZE); // the number of frame
  var v = new Float32Array(N);
  var D = new Float32Array(N);
  var i = 0, n = 0, ofs = 0;
  for (n = 0; n < N; ++n) {
    for (i = ofs; i < ofs + FRAME_SIZE*2; i+=2) {
      v[n] += channel[i] * channel[i];
    }
    v[n] = Math.sqrt(v[n] / FRAME_SIZE);
    ofs += FRAME_SIZE*2;
  }

  console.log(channel.length, FRAME_SIZE, N, ofs);

  for (n = 3; n < N; ++n) {
    //D[n] = Math.max((v[n-0] + v[n-1] + v[n-2]) - (v[n-1] + v[n-2] + v[n-3]), 0);
    D[n] = Math.max(v[n] - v[n-1], 0);
    //D[n] = v[n];
  }

  var s = buf.sampleRate / FRAME_SIZE;

  var a = new Float32Array(BPM_RANGE_B-BPM_RANGE_A+1),
      b = new Float32Array(BPM_RANGE_B-BPM_RANGE_A+1),
      r = new Float32Array(BPM_RANGE_B-BPM_RANGE_A+1);

  for (var bpm = BPM_RANGE_A; bpm <= BPM_RANGE_B; bpm+=1) {
    var aSum = 0, bSum = 0,
        f = bpm / Q / 60;

    for (n = 0; n < N; ++n) {
      var win = hanWindow(n, N);
      win = 1.0;
      aSum += D[n] * Math.cos(2.0 * Math.PI * f * n / s) * win;
      bSum += D[n] * Math.sin(2.0 * Math.PI * f * n / s) * win;
    }
    var aTmp = aSum / N;
    var bTmp = bSum / N;
    a[bpm-BPM_RANGE_A] = aTmp;
    b[bpm-BPM_RANGE_A] = bTmp;
    r[bpm-BPM_RANGE_A] = Math.sqrt(power(aTmp, bTmp));
  }

  function atos (a, b, c) {
    var s = '';
    for (var i = 0; i < a.length; ++i) {
      s += (i+60).toString() + '\t' + a[i].toString() + '\t' + b[i].toString() + '\t' + c[i].toString() + '\n';
    }
    return s;
  }

  //console.log(atos(a, b, r));

  var peaks = findPeak(r);
  console.log(peaks);
  var peakBpm = (BPM_RANGE_A + peaks[0]) / Q;
  var theta = Math.atan2(b[peaks[0]], a[peaks[0]]);
  //if (theta < 0) { theta += Math.PI * 2; debugger; }
  var peakF = peakBpm / 60;
  var beatOffset = theta / (2.0 * Math.PI * peakF);  

  return {
    bpm: peakBpm,
    offset: beatOffset,
    D: D,
    S: FRAME_SIZE
  };

  function power (a, b) {
    return a*a + b*b;
  }

  function hanWindow (i, size) {
    return 0.5 - 0.5 * Math.cos(2.0 * Math.PI * i / size);
  }

  function findPeak (a) {
    var r = [-1, -1, -1];
    var dy = 0;
    for (var i = 1; i < a.length; ++i) {
      var dyPre = dy;
      dy = a[i] - a[i-1];
      if (dyPre > 0 && dy <= 0) {
        if (r[0] < 0 || a[i-1] > a[r[0]]) {
          r[2] = r[1];
          r[1] = r[0];
          r[0] = i-1;
        } else if (r[1] < 0 || a[i-1] > a[r[1]]) {
          r[2] = r[1];
          r[1] = i-1;
        } else if (r[2] < 0 || a[i-1] > a[r[2]]) {
          r[2] = i-1;
        }
      }
    }
    return r;
  }
}

navigator.getUserMedia = (navigator.getUserMedia ||
                          navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia ||
                          navigator.msGetUserMedia);

window.URL = (window.URL ||
              window.webkitURL ||
              window.mozURL ||
              window.msURL);

window.AudioContext = (window.AudioContext ||
                       window.webkitAudioContext ||
                       window.mozAudioContext ||
                       window.msAudioContext);

function snakeToCamel(s){
  return s.replace(/(\-\w)/g, function (m) { return m[1].toUpperCase(); });
}

function loadBuffer (url) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function (err) {
      reject(err);
    };
    xhr.send();
  });
}

function getDroppedFile (dropZone) {
  return new Promise(function (resolve, reject) {
    function handleFileSelect(evt) {
      evt.stopPropagation();
      evt.preventDefault();

      if (evt.dataTransfer.files.length <= 0) {
        return;
      }

      dropZone.removeEventListener('dragover', handleDragOver, false);
      dropZone.removeEventListener('dragover', handleFileSelect, false);

      var file = evt.dataTransfer.files[0];
      var reader = new FileReader();
      reader.onload = function(e) {
        resolve(reader.result);
      };
      reader.onerror = function(e) {
        reject(reader.error);
      };
      reader.readAsArrayBuffer(file);
    }

    function handleDragOver(evt) {
      evt.stopPropagation();
      evt.preventDefault();
      evt.dataTransfer.dropEffect = 'copy';
    }

    dropZone.addEventListener('dragover', handleDragOver, false);
    dropZone.addEventListener('drop', handleFileSelect, false);    
  });
}

function decodeBuffer (actx, buf) {
  return new Promise(function (resolve, reject) {
    actx.decodeAudioData(buf, resolve, reject);
  });
}

function HSVtoRGB(h, s, v) {
  var r, g, b, i, f, p, q, t;
  i = Math.floor(h * 6);
  f = h * 6 - i;
  p = v * (1 - s);
  q = v * (1 - f * s);
  t = v * (1 - (1 - f) * s);
  switch (i % 6) {
  case 0: r = v, g = t, b = p; break;
  case 1: r = q, g = v, b = p; break;
  case 2: r = p, g = v, b = t; break;
  case 3: r = p, g = q, b = v; break;
  case 4: r = t, g = p, b = v; break;
  case 5: r = v, g = p, b = q; break;
  }

  return 'rgb(' + Math.floor(r * 255) + ',' + Math.floor(g * 255) + ',' + Math.floor(b * 255) + ')';
}

var $ = [
  'wave',
  'spectrum'
].map(function (id) {
  return { key: snakeToCamel(id), value: document.getElementById(id) };
}).reduce(function (o, kv) { o[kv.key] = kv.value; return o; }, {});

var WIDTH = 1024,
    HEIGHT = 256;

WIDTH = 1920; HEIGHT = 1080;

$.spectrum.width = WIDTH;
$.spectrum.height = HEIGHT;

$.wave.width = WIDTH;
$.wave.height = HEIGHT;
$.wave.style.display = 'none';

var spec = $.spectrum.getContext('2d'),
    wave = $.wave.getContext('2d');

var actx = new AudioContext();
var music = actx.createBufferSource();
//var lpf = actx.createBiquadFilter();
//lpf.type = 'lowpass';
//lpf.Q.value = 12;
//var hpf = actx.createBiquadFilter();
//hpf.type = 'highpass';
//hpf.Q.value = 12;
/*
$.spectrum.addEventListener('mousemove', function (e) {
  if (e.offsetX < 1920/2) {
    lpf.frequency.value = (e.offsetX/1920) * 44100;
    hpf.frequency.value = 0;
  } else {
    lpf.frequency.value = 44100;
    hpf.frequency.value = (e.offsetX/1920-0.5)*2 * 12000;
  }
});
*/
$.spectrum.addEventListener('click', function () {
  if ($.spectrum.requestFullScreen) {
    $.spectrum.requestFullScreen();
  } else if ($.spectrum.mozRequestFullScreen) {
    $.spectrum.mozRequestFullScreen();
  } else if ($.spectrum.webkitRequestFullScreen) {
    $.spectrum.webkitRequestFullScreen();
  }
});
var analyser = actx.createAnalyser();
analyser.fftSize = 2048;

music.connect(actx.destination);
music.connect(analyser);

/*
music.connect(lpf);
lpf.connect(hpf);
hpf.connect(actx.destination);
hpf.connect(analyser);
*/

getDroppedFile($.spectrum).then(function (result) {
  return decodeBuffer(actx, result);
}).then(function (buf) {
  music.buffer = buf;

  // analyze bpm
  var beat = analyzeBPM(buf);
  console.log(beat);
  var startTime = actx.currentTime;
  music.start(0);

  var drawSpectrum = (function () {
    var bufferLength = analyser.frequencyBinCount,
        dataArray = new Uint8Array(bufferLength),
        flashCount = 0,
        flashDuration = 1 / (beat.bpm / 60);

    return function () {
      analyser.getByteFrequencyData(dataArray);

      spec.lineCap = 'round';
      spec.lineWidth = 5;

      var sliceWidth = WIDTH * 1.0 / bufferLength;
      var x = 0;

      if ((actx.currentTime - startTime - beat.offset) > flashDuration * flashCount) {
        flashCount ++;
        spec.fillStyle = '#fff';
        spec.fillRect(0, 0, WIDTH, HEIGHT);
      } else {
        spec.fillStyle = 'rgba(0, 0, 0, 0.1)';  
        spec.fillRect(0, 0, WIDTH, HEIGHT);        

        /*
        for(var i = 0; i < bufferLength; i++) {
          var v = dataArray[i] / 128.0;
          var y = (1 - v/2) * HEIGHT;

          if(i !== 0) {
            spec.strokeStyle = HSVtoRGB(v/2, 1, 1);
            spec.lineTo(x, y);
            spec.stroke();
          }
          spec.beginPath();
          spec.moveTo(x, y);

          x -= sliceWidth;
        }
         */
      }

      for(var i = 0; i < bufferLength; i++) {
        var v = dataArray[i] / 128.0;
        var y = (1 - v/2) * HEIGHT;

        if(i !== 0) {
          spec.strokeStyle = HSVtoRGB(v/2, 1, 1);
          spec.beginPath();
          spec.moveTo(x, y);
          spec.lineTo(x, HEIGHT);
          spec.stroke();
        }
        x += sliceWidth;
      }
    };
  })();

  var drawWave = (function () {
    var rate = buf.sampleRate / 2,
        chan = buf.getChannelData(0),
        scale = beat.S;

    var TT = 200;
    
    var flashCount = 0,
        flashDuration = 1 / (beat.bpm / 60);

    var i = 0, k = 0, ofs = 0, avg, y = 0, idx = 0, now = 0, avg2 = 0;
    
    return function () {
      // wave
      now = actx.currentTime-startTime;
      //ofs = ~~(now * rate / scale) * scale - TT * scale;
      ofs = ~~(now * rate / scale);
      if (ofs%2 !== 0) { ofs += 1; }
      
      flashCount = ~~((now - beat.offset - 200*scale/rate) / flashDuration);
      wave.fillStyle = '#fff';
      wave.fillRect(0, 0, WIDTH, HEIGHT);
      for (i = 0; i < WIDTH; i++) {
        y = beat.D[ofs + i] * HEIGHT / 2;;
        wave.beginPath();
        wave.strokeStyle = '#000';
        wave.moveTo(i+.5, -y + HEIGHT / 2);
        wave.lineTo(i+.5, +y + HEIGHT / 2);
        wave.stroke();        

        wave.beginPath();
        wave.moveTo(.5, 0);
        wave.lineTo(.5, HEIGHT);
        wave.stroke();

        if (now - beat.offset + ((i-200)*scale/rate) > flashDuration * flashCount) {
          flashCount ++;
          wave.beginPath();
          wave.strokeStyle = '#f00';
          wave.moveTo(i+.5, 0);
          wave.lineTo(i+.5, HEIGHT);
          wave.stroke();
        }
      }      
      // for (i = 0; i < WIDTH; i++) {
      //   wave.strokeStyle = '#000';
      //   wave.beginPath();
      //   avg = 0;
      //   for (k = 0; k < scale; k+=2) {
      //     idx = ofs + i*scale + k;
      //     if (idx < chan.length) {
      //       avg += chan[idx] * chan[idx];
      //     }
      //   }
      //   avg = Math.sqrt(avg / scale * 2);
      //   y = avg * HEIGHT / 2;
      //   if (i !== 0) {
      //     //y = Math.max(avg - avg2, 0) * 100;
      //   }
      //   avg2 = avg;
      //   wave.moveTo(i+.5, -y + HEIGHT / 2);
      //   wave.lineTo(i+.5, +y + HEIGHT / 2);
      //   wave.stroke();

      //   wave.beginPath();
      //   wave.moveTo(200.5, 0);
      //   wave.lineTo(200.5, HEIGHT);
      //   wave.stroke();

      //   if (now - beat.offset + ((i-200)*scale/rate) > flashDuration * flashCount) {
      //     flashCount ++;
      //     wave.beginPath();
      //     wave.strokeStyle = '#f00';
      //     wave.moveTo(i+.5, 0);
      //     wave.lineTo(i+.5, HEIGHT);
      //     wave.stroke();
      //   }
      // }
    };
  })();

  function draw () {
    requestAnimationFrame(draw);
    
    drawSpectrum();
    //drawWave();
  }
  draw();
}).catch(function (err) {
  console.warn(err);
});

