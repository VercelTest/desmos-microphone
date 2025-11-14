const recordBtn = document.getElementById("recordBtn");
const audioFileInput = document.getElementById("audioFile");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("recordProgress");
const timeLeft = document.getElementById("timeLeft");

const RECORD_DURATION = 10;

recordBtn.addEventListener("click", async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  let chunks = [];

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/wav' });
    const file = new File([blob], "recording.wav", { type: "audio/wav" });

    const dt = new DataTransfer();
    dt.items.add(file);
    audioFileInput.files = dt.files;

    stream.getTracks().forEach(track => track.stop());

    progressBar.value = 0;
    timeLeft.textContent = RECORD_DURATION + 's';
    progressContainer.style.display = 'none';
  };

  mediaRecorder.start(100);
  recordBtn.disabled = true;

  progressContainer.style.display = 'block';
  progressBar.max = RECORD_DURATION;
  progressBar.value = 0;
  timeLeft.textContent = RECORD_DURATION + 's';

  const startTime = Date.now();

  const interval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    progressBar.value = elapsed;
    const remaining = Math.max(0, RECORD_DURATION - elapsed);
    timeLeft.textContent = Math.ceil(remaining) + 's';
    
    if (elapsed >= RECORD_DURATION) {
      clearInterval(interval);
    }
  }, 50);

  setTimeout(() => {
    clearInterval(interval);
    mediaRecorder.stop();
    recordBtn.disabled = false;
  }, RECORD_DURATION * 1000);
});