const recordBtn = document.getElementById("recordBtn");
const audioFileInput = document.getElementById("audioFile");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("recordProgress");
const timeLeft = document.getElementById("timeLeft");

recordBtn.addEventListener("click", async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  let chunks = [];

  mediaRecorder.ondataavailable = e => chunks.push(e.data);

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/wav' });
    const file = new File([blob], "recording.wav", { type: "audio/wav" });

    // Put the recording into the file input
    const dt = new DataTransfer();
    dt.items.add(file);
    audioFileInput.files = dt.files;

    // Reset and hide progress/timer
    progressBar.value = 0;
    timeLeft.textContent = '5s';
    progressContainer.style.display = 'none';
  };

  mediaRecorder.start();
  recordBtn.disabled = true;

  // Show progress/timer
  progressContainer.style.display = 'block';

  const totalTime = 5; // seconds
  let elapsed = 0;

  const interval = setInterval(() => {
    elapsed += 0.05;
    progressBar.value = elapsed;
    timeLeft.textContent = Math.ceil(totalTime - elapsed) + 's';
    if (elapsed >= totalTime) clearInterval(interval);
  }, 50);

  setTimeout(() => {
    mediaRecorder.stop();
    recordBtn.disabled = false;
  }, totalTime * 1000);
});