const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
let weight = 70, targetReps = 10;
let exercise = 'squat';
const MET = { squat: 5.0, pushup: 7.0, shoulder: 4.5, boxing: 8.0 };

// State
let reps = 0, sets = 0, totalCalories = 0;
let stage = null, lastTime = performance.now(), repTimes = [];

// UI
const exerciseEl = document.getElementById('exercise');
const weightEl = document.getElementById('weight');
const targetEl = document.getElementById('targetReps');
const statsEl = document.getElementById('stats');
const feedbackEl = document.getElementById('feedback');
exerciseEl.onchange = () => exercise = exerciseEl.value;
weightEl.onchange = () => weight = +weightEl.value;
targetEl.onchange = () => targetReps = +targetEl.value;

function calculateAngle(A, B, C) {
  const AB = { x: A.x - B.x, y: A.y - B.y };
  const CB = { x: C.x - B.x, y: C.y - B.y };
  const dot = AB.x*CB.x + AB.y*CB.y;
  const mag = Math.hypot(AB.x, AB.y) * Math.hypot(CB.x, CB.y);
  const rad = Math.acos(dot / mag);
  return rad * 180 / Math.PI;
}

function estimateCalories(durSec) {
  return MET[exercise] * weight * (durSec/3600);
}

function onResults(results) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.save();
  ctx.drawImage(video, 0, 0);
  if (results.poseLandmarks) {
    const lm = results.poseLandmarks;
    let angle;
    if (exercise === 'squat') {
      angle = calculateAngle(lm[23], lm[25], lm[27]);
    } else if (exercise === 'pushup') {
      angle = calculateAngle(lm[11], lm[13], lm[15]);
    } else {
      angle = calculateAngle(lm[13], lm[11], lm[23]);
    }
    const now = performance.now();
    if (stage === 'down' && angle > 160) {
      const d = (now - lastTime) / 1000;
      lastTime = now;
      reps++;
      repTimes.push(d);
      totalCalories += estimateCalories(d);
      if (reps % targetReps === 0) sets++;
      stage = 'up';
    } else if (angle < 70 && stage !== 'down') {
      stage = 'down';
      lastTime = now;
    }
    statsEl.textContent = `Sets: ${sets} | Reps: ${reps} | Calories: ${totalCalories.toFixed(2)}`;
    feedbackEl.textContent = '';
    window.drawConnectors(ctx, lm, window.POSE_CONNECTIONS);
    window.drawLandmarks(ctx, lm);
  }
  ctx.restore();
}

const pose = new window.Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${f}` });
pose.setOptions({ modelComplexity: 1, smoothLandmarks: true });
pose.onResults(onResults);
const camera = new window.Camera(video, {
  onFrame: async () => await pose.send({image: video}),
  width: 640, height: 480
});
camera.start();
