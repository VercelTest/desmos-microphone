importScripts('/javascript/fft.js');

// === QUALITY SETTINGS ===
const FFT_SIZE = 8192; // Tradeoff clearer frequency vs time resolution: Try find a balance         
const STEP_RATIO = 0.25; // this will give you smoother transitions between samples but will DESTROY your pc if you set this lower than 0.05. Setting this to 1 will turn the smoothing off
const MAX_PEAKS = 3;    // max amount of peaks to keep per sample
const MIN_MAGNITUDE = 0.002; // threshold to ignore quiet harmonics     
const MAX_FREQUENCY = 16000; // old people cant hear higher than 15000Hz btw  
const PROGRESS_INTERVAL = 5; // how often to send progress updates to the green bar

// === WORKER ===
onmessage = function(e) {
    const { channelData, sampleRate } = e.data;
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

        // Magnitudes
        const mags = [];
        for (let k = 0; k < FFT_SIZE / 2; k++) {
            const re = out[2*k];
            const im = out[2*k+1];
            mags.push(Math.sqrt(re*re + im*im));
        }

        // Collect frequencies
        const freqs = [];
        for (let k = 1; k < FFT_SIZE / 2; k++) {
            const freq = k * sampleRate / FFT_SIZE;
            if (freq > MAX_FREQUENCY) break;
            if (mags[k] < MIN_MAGNITUDE) continue;
            freqs.push([freq, mags[k]]);
        }

        // Top peaks
        freqs.sort((a, b) => b[1] - a[1]);
        const topPeaks = freqs.slice(0, MAX_PEAKS);

        // Convert to perceptual logarithmic volume
        const maxMag = topPeaks.length > 0 ? Math.max(...topPeaks.map(f => f[1])) : 1e-12;
        const normalized = topPeaks.map(([f, v]) => {
            const linear = v / maxMag;
            const logVol = Math.log10(1 + 9 * linear); // 0–1
            return [f, logVol];
        });

        intervals.push(normalized);

        // Progress
        if (intervals.length % PROGRESS_INTERVAL === 0) {
            const percent = Math.floor((start / channelData.length) * 100);
            postMessage({ type: 'progress', percent });
        }
    }

    postMessage({ type: 'result', intervals });
};
