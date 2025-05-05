const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const stickCanvas = document.getElementById('stickCanvas');
const sctx = stickCanvas.getContext('2d');
const stats = document.getElementById('stats');
const feedbackEl = document.getElementById('feedback');
const exerciseSelect = document.getElementById('exercise');
const minInput = document.getElementById('minAngle');
const maxInput = document.getElementById('maxAngle');
const weightInput = document.getElementById('weight');
const targetInput = document.getElementById('targetReps');

let exercise = "squat",
    minAngle = 70,
    maxAngle = 160;
let stage = null,
    reps = 0,
    sets = 0,
    repTimes = [],
    lastTime = Date.now(),
    totalCalories = 0;

const MET = {
  squat: 5.0,
  pushup: 7.0,
  shoulder: 4.5,
  boxing: 8.0
};

function speak(text) {
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function angle(a, b, c) {
  const rad = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x));
  let deg = rad * 180 / Math.PI;
  return deg > 180 ? 360 - deg : deg;
}

function updateStats(extra = '') {
  stats.innerText = `Exercise: ${exercise}\nReps: ${reps} Sets: ${sets}\nCalories: ${totalCalories.toFixed(2)} kcal${extra ? "\n" + extra : ""}`;
}

function drawStick(ctx, lm, w, h, fatigue) {
  const kp = {
    left_shoulder: 11,
    right_shoulder: 12,
    left_elbow: 13,
    right_elbow: 14,
    left_wrist: 15,
    right_wrist: 16,
    left_hip: 23,
    right_hip: 24,
    left_knee: 25,
    right_knee: 26,
    left_ankle: 27,
    right_ankle: 28
  };
  const pt = name => ({ x: lm[kp[name]].x * w, y: lm[kp[name]].y * h });
  const limbs = [
    ['left_shoulder', 'right_shoulder'],
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'left_hip'],
    ['right_shoulder', 'right_hip'],
    ['left_hip', 'right_hip'],
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_ankle'],
    ['right_hip', 'right_knee'],
    ['right_knee', 'right_ankle']
  ];

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;

  limbs.forEach(([a, b]) => {
    const p1 = pt(a), p2 = pt(b);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });

  const ls = pt('left_shoulder'),
        rs = pt('right_shoulder');
  const hx = (ls.x + rs.x) / 2,
        hy = ls.y - 20;

  ctx.beginPath();
  ctx.arc(hx, hy, 10, 0, 2 * Math.PI);
  ctx.stroke();

  if (fatigue) {
    for (let i = 0; i < 2; i++) {
      const dx = (Math.random() - 0.5) * 10;
      const dy = 5 + Math.random() * 5;
      ctx.beginPath();
      ctx.ellipse(hx + dx, hy + dy, 2, 4, 0, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,100,100,0.8)';
      ctx.fill();
    }
  }
}

const pose = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(results => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
  feedbackEl.innerText = '';

  if (!results.poseLandmarks) return;

  drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
  drawLandmarks(ctx, results.poseLandmarks, { color: '#FF0000', lineWidth: 1 });

  const lm = results.poseLandmarks;
  const coords = {
    shoulder: lm[11],
    elbow: lm[13],
    wrist: lm[15],
    hip: lm[23],
    knee: lm[25],
    ankle: lm[27]
  };

  let ang = 0;
  if (exercise === 'squat') ang = angle(coords.hip, coords.knee, coords.ankle);
  else if (exercise === 'pushup') ang = angle(coords.shoulder, coords.elbow, coords.wrist);
  else if (exercise === 'shoulder') ang = angle(coords.elbow, coords.shoulder, coords.hip);

  const now = Date.now();
  let fatigue = false;

  if (exercise !== 'boxing') {
    if (exercise === 'squat') {
      const torso = angle(coords.shoulder, coords.hip, coords.knee);
      if (stage === 'down' && ang > minAngle) feedbackEl.innerText = 'Go lower';
      else if (stage === 'up' && ang < maxAngle) feedbackEl.innerText = 'Stand fully';
      else if (stage === 'down' && torso < 155) feedbackEl.innerText = 'Keep chest up';
    } else if (exercise === 'pushup') {
      const back = angle(coords.shoulder, coords.hip, coords.ankle);
      if (stage === 'down' && ang > minAngle) feedbackEl.innerText = 'Lower more';
      else if (stage === 'down' && back < 165) feedbackEl.innerText = 'Keep body straight';
      else if (stage === 'up' && ang < maxAngle) feedbackEl.innerText = 'Press up';
    }

    if (ang < minAngle && stage !== 'down') {
      stage = 'down';
      updateStats('Down phase');
    }

    if (ang > maxAngle && stage === 'down') {
      stage = 'up';
      const dur = (now - lastTime) / 1000;
      repTimes.push(dur);
      reps++;
      lastTime = now;

      totalCalories += (MET[exercise] * parseFloat(weightInput.value) * dur) / 3600;

      speak(`Rep ${reps}`);
      updateStats();

      if (reps % parseInt(targetInput.value) === 0) {
        sets++;
        speak(`Set ${sets} complete`);
        updateStats();
      }

      if (repTimes.length >= 5) {
        const avg = repTimes.slice(0, -1).reduce((a, b) => a + b) / (repTimes.length - 1);
        if (dur > avg * 1.3) {
          fatigue = true;
          feedbackEl.innerText = 'Fatigue detected';
          speak('Fatigue detected');
        }
      }
    }
  }

  drawStick(sctx, lm, stickCanvas.width, stickCanvas.height, fatigue);

  if (exercise === 'boxing') {
    if (!window.prev) window.prev = { pt: coords.wrist, t: now };
    const dt = (now - window.prev.t) / 1000;
    const dx = (coords.wrist.x - window.prev.pt.x) * canvas.width;
    const dy = (coords.wrist.y - window.prev.pt.y) * canvas.height;
    const speed = Math.hypot(dx, dy) / dt;
    const eff = speed > 1200 ? 'High' : speed > 800 ? 'Moderate' : 'Low';
    ctx.fillStyle = '#ff0';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Punch Speed: ${speed.toFixed(0)}`, 10, 40);
    ctx.fillText(`Eff: ${eff}`, 10, 70);
    window.prev = { pt: coords.wrist, t: now };
  }
});

const camera = new Camera(video, {
  onFrame: async () => await pose.send({ image: video }),
  width: 640,
  height: 480
});
camera.start();

video.addEventListener('loadedmetadata', () => {
  updateStats();
  speak('Welcome');
});

exerciseSelect.onchange = () => {
  exercise = exerciseSelect.value;
  reps = sets = totalCalories = 0;
  repTimes = [];
  lastTime = Date.now();
  updateStats(`Switched to ${exercise}`);
  speak(`Switched to ${exercise}`);
};

minInput.oninput = () => minAngle = parseInt(minInput.value);
maxInput.oninput = () => maxAngle = parseInt(maxInput.value);
