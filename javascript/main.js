document.getElementById("audioForm").addEventListener("submit", function (e) {
  e.preventDefault();
  processAudio();
});

async function processAudio() {
  const file = getAudioFile();
  if (!file) return;

  const cutBuffer = await cutToSeconds(file, 10);
  const sampleRate = cutBuffer.sampleRate;

  let channelData = getMonoChannel(cutBuffer);

  // Normalize to [-1,1]
  let maxVal = 0;
  for (let i = 0; i < channelData.length; i++) {
    const v = Math.abs(channelData[i]);
    if (v > maxVal) maxVal = v;
  }
  if (maxVal === 0) maxVal = 1;
  for (let i = 0; i < channelData.length; i++) {
    channelData[i] /= maxVal;
  }

  // Setup progress bar
  const progressBar = document.getElementById("progressBar");
  progressBar.value = 0;

  // Create worker
  const worker = new Worker("javascript/webworker.js");
  worker.postMessage({
    channelData,
    sampleRate,
    stepMs: 5,
    maxPeaks: 5,
  });

  worker.onmessage = (e) => {
    if (e.data.type === "progress") {
      progressBar.value = e.data.percent;
    } else if (e.data.type === "result") {
      const intervals = e.data.intervals;

      // Generate the Desmos output
      generateDesmosOutput(intervals);

      progressBar.value = 100;
    }
  };
}

function getAudioFile() {
  const fileInput = document.getElementById("audioFile");
  if (!fileInput.files.length) {
    alert("Please select an audio file!");
    return null;
  }
  return fileInput.files[0];
}

async function cutToSeconds(file, maxSeconds) {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const duration = Math.min(audioBuffer.duration, maxSeconds);
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;

  const cutBuffer = audioContext.createBuffer(
    numberOfChannels,
    duration * sampleRate,
    sampleRate
  );

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const oldData = audioBuffer.getChannelData(channel);
    const newData = cutBuffer.getChannelData(channel);
    newData.set(oldData.subarray(0, duration * sampleRate));
  }

  return cutBuffer;
}

function getMonoChannel(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const monoData = new Float32Array(length);

  for (let ch = 0; ch < numberOfChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      monoData[i] += channelData[i] / numberOfChannels;
    }
  }
  return monoData;
}

function generateDesmosOutput(intervals) {
    const outputDiv = document.getElementById('output');

    intervals.forEach((interval, intervalIdx) => {
      let freqtable = [];
      interval.forEach(([freq, volume]) => {
          
      });
    });

    // outputDiv.dataset.raw = rawText;

    // const lines = rawText.split('\n');
    outputDiv.innerHTML = lines.map(line => `<span>${line || '&nbsp;'}</span>`).join('');
}

// Copy button
document.getElementById("copyBtn").addEventListener("click", () => {
    const outputDiv = document.getElementById("output");
    const text = outputDiv.dataset.raw; // ONLY use raw text for copying

    navigator.clipboard.writeText(text)
        .then(() => alert("Output copied to clipboard!"))
        .catch(err => console.error("Failed to copy: ", err));
});
