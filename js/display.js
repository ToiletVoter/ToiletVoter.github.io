// Configuratie
const MOVEMENT_SPEED = 0.3;
const UPDATE_INTERVAL = 30;
const CHECK_NEW_INTERVAL = 1000;

let newParticipantTimestamps = [];

/* hulpfuncties */

// teller: behoud label (NL/EN), vervang alleen het eindgetal
function setParticipantCount(count) {
  const el = document.getElementById('participant-count');
  if (!el) return;
  const txt = el.textContent || '';
  if (/\d+$/.test(txt)) {
    el.textContent = txt.replace(/\d+$/, String(count));
  } else if (/:$/.test(txt.trim())) {
    el.textContent = `${txt.trim()} ${count}`;
  } else {
    el.textContent = `${txt.trim().replace(/\s+$/, '')}: ${count}`;
  }
}

// veilige random positie
function getRandomPosition(containerWidth, containerHeight, elementWidth, elementHeight) {
  const maxX = Math.max(0, containerWidth - elementWidth);
  const maxY = Math.max(0, containerHeight - elementHeight);
  return {
    x: Math.floor(Math.random() * (maxX + 1)),
    y: Math.floor(Math.random() * (maxY + 1)),
    dx: (Math.random() - 0.5) * MOVEMENT_SPEED,
    dy: (Math.random() - 0.5) * MOVEMENT_SPEED
  };
}

// beweging
function moveBubble(bubble, containerWidth, containerHeight) {
  let x = parseFloat(bubble.dataset.x);
  let y = parseFloat(bubble.dataset.y);
  let dx = parseFloat(bubble.dataset.dx);
  let dy = parseFloat(bubble.dataset.dy);

  const width = bubble.offsetWidth;
  const height = bubble.offsetHeight;

  x += dx;
  y += dy;

  if (x <= 0 || x + width >= containerWidth) {
    dx = -dx;
    x = x <= 0 ? 0 : Math.max(0, containerWidth - width);
  }
  if (y <= 0 || y + height >= containerHeight) {
    dy = -dy;
    y = y <= 0 ? 0 : Math.max(0, containerHeight - height);
  }

  bubble.dataset.x = x;
  bubble.dataset.y = y;
  bubble.dataset.dx = dx;
  bubble.dataset.dy = dy;

  bubble.style.left = `${x}px`;
  bubble.style.top = `${y}px`;
}

// bubbel maken
function createParticipantBubble(participant, container) {
  const bubble = document.createElement('div');
  bubble.className = 'participant-bubble';
  if (newParticipantTimestamps.includes(String(participant.timestamp))) {
    bubble.classList.add('new');
  }

  const pos = getRandomPosition(container.offsetWidth, container.offsetHeight, 150, 150);
  bubble.dataset.x = pos.x;
  bubble.dataset.y = pos.y;
  bubble.dataset.dx = pos.dx;
  bubble.dataset.dy = pos.dy;
  bubble.style.left = `${pos.x}px`;
  bubble.style.top = `${pos.y}px`;

  const expertiseText = Array.isArray(participant.expertise)
    ? participant.expertise.join(', ')
    : (participant.expertise || '');

  bubble.innerHTML = `
    <div class="photo-circle">
      <img src="${participant.photo_url}" alt="${participant.name || ''}">
    </div>
    <div class="participant-info">
      <h3>${participant.name || ''}</h3>
      <p>${participant.company || ''}</p>
      <div class="expertise-tag">${expertiseText}</div>
    </div>
  `;
  bubble.dataset.timestamp = String(participant.timestamp);
  return bubble;
}

/* hoofdlogica */

async function updateDisplay() {
  const displayContainer = document.getElementById('display-container');
  if (!displayContainer || !window.supabaseClient) return;

  let participants = [];
  try {
    const { data, error } = await window.supabaseClient
      .from('participants')
      .select('*')
      .order('timestamp', { ascending: true });
    if (error) throw error;
    participants = data || [];
  } catch (err) {
    console.error('Fout bij ophalen deelnemers:', err);
  }

  // bestaande bubbels indexeren
  const existing = {};
  displayContainer.querySelectorAll('.participant-bubble').forEach(b => {
    existing[b.dataset.timestamp] = b;
  });

  // verwijderen wat niet meer bestaat
  Object.keys(existing).forEach(ts => {
    if (!participants.find(p => String(p.timestamp) === String(ts))) {
      existing[ts].remove();
      delete existing[ts];
    }
  });

  // toevoegen wat nieuw is
  participants.forEach(p => {
    const ts = String(p.timestamp);
    if (!existing[ts]) {
      if (!newParticipantTimestamps.includes(ts)) newParticipantTimestamps.push(ts);
      const b = createParticipantBubble(p, displayContainer);
      displayContainer.appendChild(b);
      setTimeout(() => {
        const i = newParticipantTimestamps.indexOf(ts);
        if (i !== -1) newParticipantTimestamps.splice(i, 1);
      }, 2000);
    }
  });

  // teller
  setParticipantCount(participants.length);
}

document.addEventListener('DOMContentLoaded', function () {
  const displayContainer = document.getElementById('display-container');
  if (!displayContainer) return;

  updateDisplay();
  setInterval(updateDisplay, CHECK_NEW_INTERVAL);

  setInterval(() => {
    const w = displayContainer.offsetWidth;
    const h = displayContainer.offsetHeight;
    document.querySelectorAll('.participant-bubble').forEach(b => moveBubble(b, w, h));
  }, UPDATE_INTERVAL);

  // corrigeer posities na resize
  window.addEventListener('resize', () => {
    const w = displayContainer.offsetWidth;
    const h = displayContainer.offsetHeight;
    document.querySelectorAll('.participant-bubble').forEach(b => {
      let x = parseFloat(b.dataset.x);
      let y = parseFloat(b.dataset.y);
      const bw = b.offsetWidth, bh = b.offsetHeight;
      if (x + bw > w) x = Math.max(0, w - bw);
      if (y + bh > h) y = Math.max(0, h - bh);
      b.dataset.x = x; b.dataset.y = y;
      b.style.left = `${x}px`;
      b.style.top = `${y}px`;
    });
  });
});
