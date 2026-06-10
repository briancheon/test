// 날짜 표시
(function () {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const now = new Date();
  const el = document.getElementById("date");
  if (el) {
    el.textContent =
      `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${days[now.getDay()]})`;
  }
})();

// 비명 소리 생성 (오디오 파일 없이 Web Audio로 생성)
function playScream() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // 노이즈 버퍼(쉭- 하는 비명 질감)
    const bufferSize = ctx.sampleRate * 1.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // 날카로운 톤
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 1.0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.6, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 600;

    noise.connect(filter);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    osc.start(now);
    noise.stop(now + 1.2);
    osc.stop(now + 1.2);
  } catch (e) {
    // 오디오 미지원 환경은 조용히 무시
  }
}

// 점프스케어 실행
let scared = false;
function triggerScare() {
  if (scared) return;
  scared = true;

  const overlay = document.getElementById("jumpscare");
  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
  playScream();

  // 화면 진동(지원 기기)
  if (navigator.vibrate) navigator.vibrate([200, 80, 300]);

  // 4초 뒤 닫고 리셋
  setTimeout(() => {
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    scared = false;
  }, 4000);
}

// 모든 기사/버튼 클릭에 연결
document.querySelectorAll("[data-scare]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    triggerScare();
  });
});

// 오버레이 클릭 시 즉시 닫기
document.getElementById("jumpscare").addEventListener("click", () => {
  const overlay = document.getElementById("jumpscare");
  overlay.classList.remove("show");
  overlay.setAttribute("aria-hidden", "true");
  scared = false;
});
