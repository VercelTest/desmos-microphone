importScripts('/javascript/fft.js');

// === QUALITY SETTINGS ===
const FFT_SIZE = 16384; // Tradeoff clearer frequency vs time resolution: Try find a balance         
const STEP_RATIO = 0.05; // smoothing rate
const MIN_MAGNITUDE = 0.006; // threshold to ignore quiet harmonics     
const MAX_FREQUENCY = 16000; // highest frequency in hz to consider
const PROGRESS_INTERVAL = 5; // how often to send progress updates to the green bar

const MIN_FREQUENCY = 24;
const SILENCE_THRESHOLD = 0.004;

// === WORKER ===
onmessage = function(e) {
  const { channelData, sampleRate, MAX_PEAKS } = e.data;
  const stepSize = Math.floor(FFT_SIZE * STEP_RATIO);
  const fft = new FFTJS(FFT_SIZE);
  const intervals = [];

  for (let start = 0; start + FFT_SIZE <= channelData.length; start += stepSize) {
    const slice = channelData.subarray(start, start + FFT_SIZE);
    const buffer = Array.from(slice);

    // Apply Hanning window
    for (let i = 0; i < FFT_SIZE; i++) {
      buffer[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
    }

    const out = fft.createComplexArray();
    fft.realTransform(out, buffer);

    // Calculate magnitudes
    const mags = [];
    for (let k = 0; k < FFT_SIZE / 2; k++) {
      const re = out[2*k];
      const im = out[2*k+1];
      mags.push(Math.sqrt(re*re + im*im));
    }

    // === CHECK IF FRAME IS SILENT ===
    const maxMag = Math.max(...mags);
    if (maxMag < SILENCE_THRESHOLD) {
      intervals.push(Array.from({ length: MAX_PEAKS }, () => [0, 0]));
      
      if (intervals.length % PROGRESS_INTERVAL === 0) {
        const percent = Math.floor((start / channelData.length) * 100);
        postMessage({ type: 'progress', percent });
      }
      continue;
    }

    // === SIMPLE PEAK PICKING ===
    // Strategy: Find local maxima in valid frequency range
    const peaks = [];
    
    for (let k = 2; k < FFT_SIZE / 2 - 2; k++) {
      const freq = k * sampleRate / FFT_SIZE;
      
      // Filter frequency range
      if (freq < MIN_FREQUENCY || freq > MAX_FREQUENCY) continue;
      
      // Must be louder than threshold
      if (mags[k] < MIN_MAGNITUDE) continue;
      
      // Must be a local maximum (louder than neighbors)
      if (mags[k] <= mags[k-1] || mags[k] <= mags[k+1]) continue;
      if (mags[k] <= mags[k-2] || mags[k] <= mags[k+2]) continue;
      
      // Parabolic interpolation for accuracy
      const alpha = mags[k-1];
      const beta = mags[k];
      const gamma = mags[k+1];
      const denom = alpha - 2*beta + gamma;
      
      let finalFreq = freq;
      let finalMag = beta;
      
      if (Math.abs(denom) > 1e-10) {
        const delta = 0.5 * (alpha - gamma) / denom;
        if (Math.abs(delta) < 0.5) {
          const interpolatedBin = k + delta;
          finalFreq = interpolatedBin * sampleRate / FFT_SIZE;
          finalMag = beta - 0.25 * (alpha - gamma) * delta;
        }
      }
      
      peaks.push([finalFreq, finalMag]);
    }

    // === SORT AND TAKE TOP PEAKS ===
    if (peaks.length === 0) {
      intervals.push(Array.from({ length: MAX_PEAKS }, () => [0, 0]));
    } else {
      // Sort by magnitude (loudest first)
      peaks.sort((a, b) => b[1] - a[1]);
      
      // Take top MAX_PEAKS
      const topPeaks = peaks.slice(0, MAX_PEAKS);
      
      // Normalize volumes logarithmically
      const peakMaxMag = topPeaks[0][1];
      const normalized = topPeaks.map(([f, v]) => {
        const linear = v / peakMaxMag;
        const logVol = Math.log10(1 + 9 * linear);
        return [f, logVol];
      });
      
      // Pad with zeros to fix error
      while (normalized.length < MAX_PEAKS) {
        normalized.push([0, 0]);
      }
      
      intervals.push(normalized);
    }

    if (intervals.length % PROGRESS_INTERVAL === 0) {
      const percent = Math.floor((start / channelData.length) * 100);
      postMessage({ type: 'progress', percent });
    }
  }

  postMessage({ type: 'progress', percent: 100 });
  postMessage({ type: 'result', intervals });
  postMessage({ type: 'ticker', tickerRate: (FFT_SIZE * STEP_RATIO / sampleRate) * 1000 });
};