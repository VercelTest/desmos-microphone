// detect devmode
let devmode = false;

document.querySelectorAll('input[name="choice"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    devmode = (e.target.value == "value1");
  });
});

async function processAudio() {
  const progressBar = document.getElementById("outputProgress");
  progressBar.value = 0;

  const file = getAudioFile();
  if (!file) return;

  document.getElementById("outputContainer").style.display = "block"

  let cutBuffer
  if (devmode) {
    cutBuffer = await cutToSeconds(file, 25, 22050);
  } else {
    cutBuffer = await cutToSeconds(file, 5, 22050);
  }

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

  let MAX_PEAKS = (devmode)? 150 : 10

  // Create worker
  const worker = new Worker("javascript/converter.js");
  worker.postMessage({
    channelData,
    sampleRate,
    MAX_PEAKS,
  });

  worker.onmessage = (e) => {
    if (e.data.type === "progress") {
      progressBar.value = e.data.percent;
    } else if (e.data.type === "result") {
      const intervals = e.data.intervals;
      let [vol, freq, totalFrames] = generateFunctionOutput(intervals);
      console.log(totalFrames);
      setHTMLOutput(vol, freq, totalFrames)
      progressBar.value = 100;

    } else if (e.data.type === "ticker") {
      console.log(Math.ceil(e.data.tickerRate))
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

async function cutToSeconds(file, maxSeconds, sampleRate) {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const duration = Math.min(audioBuffer.duration, maxSeconds);
  const numberOfChannels = audioBuffer.numberOfChannels;
  const targetSampleRate = sampleRate;

  const cutBuffer = audioContext.createBuffer(
    numberOfChannels,
    duration * targetSampleRate,
    targetSampleRate        
  );

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const oldData = audioBuffer.getChannelData(channel);
    const newData = cutBuffer.getChannelData(channel);
    
    const ratio = audioBuffer.sampleRate / targetSampleRate;
    
    for (let i = 0; i < newData.length; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, oldData.length - 1);
      const fraction = srcIndex - srcIndexFloor;
      
      newData[i] = oldData[srcIndexFloor] * (1 - fraction) + oldData[srcIndexCeil] * fraction;
    }
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

function setHTMLOutput(voloutput, freqoutput, totalFrames) {
  const outputDiv = document.getElementById('output');
  let rawText = "";
  if (devmode) {
    const outputJSON = {"version":11,"graph":{"viewport":{"xmin":-10,"ymin":-10,"xmax":10,"ymax":10}},"expressions":{"list":[{"type":"folder","id":"134","title":"Logic","collapsed":true},{"type":"expression","id":"4","folderId":"134","color":"#c74440","latex":"\\operatorname{tone}\\left(F\\left(t\\right),\\ G\\left(t\\right)\\right)"},{"type":"expression","id":"3","folderId":"134","color":"#388c46","latex":"t=0","hidden":true,"slider":{"hardMin":true,"loopMode":"LOOP_FORWARD","min":"0","max":"295","step":"1"}},{"type":"text","id":"131","text":"Reset button (press the arrow)"},{"type":"expression","id":"14","color":"#c74440","latex":"R_{eset}=t\\to0"},{"type":"folder","id":"146","title":"Audio Data (DO NOT OPEN THIS WILL CRASH YOUR BROWSER)","hidden":true,"collapsed":true},{"type":"expression","id":"147","folderId":"146","color":"#2d70b3","latex":freqoutput,"hidden":true},{"type":"expression","id":"148","folderId":"146","color":"#388c46","latex":voloutput,"hidden":true}],"ticker":{"handlerLatex": "t\\to t+1\\left\\{t<" + (totalFrames +1) + "\\right\\}","minStepLatex":"17","open":true}}}

    rawText = `calculator = Calc || Desmos.instance || Object.values(Desmos)[0];\ncalculator.setState(${JSON.stringify(outputJSON)});`
     document.getElementById("outputInstructions").innerHTML = "Instructions:<br />Open a new graph in Desmos<br />Open Inspect by Right clicking and selecting 'Inspect Element' or pressing Cmd/Ctrl + Shift + C<br />Paste the line below into console and close the Inspect";
  } else {
    rawText = voloutput + "\n" + freqoutput;

    document.getElementById("outputInstructions").innerHTML = 'Instructions:<br />Go to this link: <a href="https://www.desmos.com/calculator/fbtugwsq9q" target="_blank">Desmos Audio Player</a><br />Wait for the generator to load and then input the function into desmos. This will only play 5 seconds of your audio and is very limited quality due to the massive function size of the audio.';
  }

  outputDiv.dataset.raw = rawText;
  const lines = rawText.split('\n');
  outputDiv.innerHTML = lines.map(line => `<span>${line || '&nbsp;'}</span>`).join('');
}

function generateFunctionOutput(intervals) {
    const peaks = intervals[0].length;
    let freqoutput = [];
    let voloutput = [];

    for (let i = 0; i < peaks; i++) {
      let frequencies = [];
      let volumes = [];
      intervals.forEach((interval, intervalIdx) => {
        frequencies.push(Math.round(interval[i][0]));
        volumes.push(Math.round(interval[i][1]*1000)/1000);
      });
      freqoutput.push("[" + frequencies.toString() + "][i]");
      voloutput.push("[" + volumes.toString() + "][i]");
    }
    freqoutput = "F(i) = [" + freqoutput.toString() + "]"
    voloutput = "G(i) = [" + voloutput.toString() + "]"

    return [voloutput, freqoutput, intervals.length];
}

// Copy button
document.getElementById("copyBtn").addEventListener("click", () => {
    const outputDiv = document.getElementById("output");
    const text = outputDiv.dataset.raw;

    navigator.clipboard.writeText(text)
        .then(() => alert("Output copied to clipboard!"))
        .catch(err => console.error("Failed to copy: ", err));
});

// Submit audio button
document.getElementById("audioForm").addEventListener("submit", function (e) {
  e.preventDefault();
  processAudio();
});

// remove progress bar when new file loaded
document.getElementById("audioFile").addEventListener('change', function () {
  document.getElementById("outputProgress").value = 0;
});