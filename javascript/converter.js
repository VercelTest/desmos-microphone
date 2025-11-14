importScripts('/javascript/fft.js');

// THANK YOU QINGY1337

// === QUALITY SETTINGS
const FFT_SIZE = 2048;           // Increased for better frequency resolution
const STEP_SIZE = 375;          // smoother sound- but desmos will sund slowe
const MIN_MAGNITUDE = 0.006;     // Threshold
const MAX_FREQUENCY = 16000;     // Highest frequency in Hz to consider
const MIN_FREQUENCY = 30;        // Lowest frequency to consider
const SILENCE_THRESHOLD = 0.003; // Threshold for silent frames


const MIN_DISTANCE_HZ = 20;      // Minimum Hz between peaks to be considered another peak
const PROGRESS_INTERVAL = 10;    // Progress update indicator
const GAIN_SCALING_POWER = 0.7;  // Compress dynamics (0.5-1.0 range, lower = more compression)

// === WORKER ===
onmessage = function(e) {
  const { channelData, sampleRate, MAX_PEAKS } = e.data;
  const fft = new FFTJS(FFT_SIZE);
  const intervals = [];
  let globalMaxGain = 0.0;
  
  // First pass: collect all peaks and find global max
  const allFramePeaks = [];
  
  for (let start = 0; start + FFT_SIZE <= channelData.length; start += STEP_SIZE) {
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
      mags[k] = Math.sqrt(re*re + im*im);
    }

    // Check if frame is silent
    const maxMag = Math.max(...mags);
    if (maxMag < SILENCE_THRESHOLD) {
      allFramePeaks.push([]);
      continue;
    }

    const minHeight = maxMag * MIN_MAGNITUDE;
    const minDistanceBins = Math.max(1, Math.floor(MIN_DISTANCE_HZ * FFT_SIZE / sampleRate));

    // Peak detection with minimum distance enforcement
    const peaks = findPeaksWithMinDistance(mags, sampleRate, FFT_SIZE, minHeight, minDistanceBins);
    
    // Sort by magnitude and take top MAX_PEAKS
    peaks.sort((a, b) => b[1] - a[1]);
    const topPeaks = peaks.slice(0, MAX_PEAKS);
    
    allFramePeaks.push(topPeaks);
    
    // Track global max for normalization
    if (topPeaks.length > 0) {
      const frameMax = topPeaks[0][1];
      if (frameMax > globalMaxGain) {
        globalMaxGain = frameMax;
      }
    }

    if (allFramePeaks.length % PROGRESS_INTERVAL === 0) {
      const percent = Math.floor((start / channelData.length) * 50);
      postMessage({ type: 'progress', percent });
    }
  }

  // Second pass: normalize globally and format output
  for (let frameIdx = 0; frameIdx < allFramePeaks.length; frameIdx++) {
    const peaks = allFramePeaks[frameIdx];
    
    if (peaks.length === 0) {
      intervals.push(Array.from({ length: MAX_PEAKS }, () => [0, 0]));
    } else {

      const normalized = peaks.map(([freq, mag]) => {
        let normalizedGain = mag / globalMaxGain;

        normalizedGain = Math.pow(normalizedGain, GAIN_SCALING_POWER);
        return [freq, normalizedGain];
      });
      
      while (normalized.length < MAX_PEAKS) {
        normalized.push([0, 0]);
      }
      
      intervals.push(normalized);
    }

    if (frameIdx % PROGRESS_INTERVAL === 0) {
      const percent = 50 + Math.floor((frameIdx / allFramePeaks.length) * 50); // Second 50%
      postMessage({ type: 'progress', percent });
    }
  }

  postMessage({ type: 'progress', percent: 100 });
  postMessage({ type: 'result', intervals });
  postMessage({ type: 'ticker', tickerRate: (STEP_SIZE / sampleRate) * 1000 });
};

// Peak detection with minimum distance
function findPeaksWithMinDistance(mags, sampleRate, fftSize, minHeight, minDistanceBins) {
  const peaks = [];
  
  for (let k = 2; k < fftSize / 2 - 2; k++) {
    const freq = k * sampleRate / fftSize;
    
    // Filter frequency range
    if (freq < MIN_FREQUENCY || freq > MAX_FREQUENCY) continue;
    
    // Must be louder than threshold
    if (mags[k] < minHeight) continue;
    
    // Must be a local maximum (including +/- 2 neighbors like before)
    if (mags[k] <= mags[k-1] || mags[k] <= mags[k+1]) continue;
    if (mags[k] <= mags[k-2] || mags[k] <= mags[k+2]) continue;
    
    // Parabolic interpolation for sub-bin accuracy
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
        finalFreq = interpolatedBin * sampleRate / fftSize;
        finalMag = beta - 0.25 * (alpha - gamma) * delta;
      }
    }
    
    peaks.push([finalFreq, finalMag, k]); // Include bin index for distance check
  }
  
  // Enforce minimum distance between peaks
  if (minDistanceBins > 1) {
    peaks.sort((a, b) => b[1] - a[1]); // Sort by magnitude (strongest first)
    const filtered = [];
    const used = new Set();
    
    for (const [freq, mag, bin] of peaks) {
      // Check if too close to any already-selected peak
      let tooClose = false;
      for (const usedBin of used) {
        if (Math.abs(bin - usedBin) < minDistanceBins) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        filtered.push([freq, mag]);
        used.add(bin);
      }
    }
    
    return filtered;
  }
  
  return peaks.map(([freq, mag]) => [freq, mag]);
}