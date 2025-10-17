// Configuratie
const MOVEMENT_SPEED = 0.3;        // Lagere waarde = langzamere beweging
const UPDATE_INTERVAL = 30;        // Milliseconden tussen positie-updates
const CHECK_NEW_INTERVAL = 1000;   // Milliseconden tussen controles voor nieuwe deelnemers

let newParticipantTimestamps = [];

/* =========================
   hulpfuncties
   ========================= */

// Alleen het getal in de teller vervangen, label (NL/EN) behouden
function setParticipantCount(count) {
  const el = document.getElementById('participant-count');
  if (!el) return;

  const current = el.textContent || '';

  // Als er al een getal aan het eind staat, vervang dat
  if (/\d+$/.test(current)) {
    el.textContent = current.replace(/\d+$/, String(count));
    return;
  }

  // Anders: probeer "label: X" te forceren zonder het label te raden
  // - als er al een dubbele punt is, zet er een spatie en het getal achter
  if (/:$/.test(current.trim())) {
    el.textContent = `${current.trim()} ${count}`;
  } else {
    // fallback: voeg ": {count}" toe
    el.textContent = `${current.trim().replace(/\s+$/, '')}: ${count}`;
  }
}

// Willekeurige startpositie en richting
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

// Bubbel bewegen en stuiteren binnen container
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

// Nieuwe deelnemersbubbel maken
function createParticipantBubble(participant, container) {
  const bubble = document.createElement('div');
  bubble.className = 'participant-bubble';
  if (newParticipantTimestamps.includes(String(participant.timestamp))) {
    bubble.classList.add('new');
  }

  const position = getRandomPosition(
    container.offsetWidth,
    container.offsetHeight,
    150,
    150
  );

  bubble.dataset.x = position.x;
  bubble.dataset.y = position.y;
  bubble.dataset.dx = position.dx;
  bubble.dataset.dy = position.dy;

  bubble.style.left = `${position.x}px`;
  bubble.style.top = `${position.y}px`;

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

/* =========================
   hoofdlogica
   ========================= */

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

  // bestaande bubbels indexeren op timestamp
  const existingBubbles = {};
  displayContainer.querySelectorAll('.participant-bubble').forEach(bubble => {
    existingBubbles[bubble.dataset.timestamp] = bubble;
  });

  // verwijder bubbels die niet meer bestaan
  Object.keys(existingBubbles).forEach(ts => {
    if (!participants.find(p => String(p.timestamp) === String(ts))) {
      existingBubbles[ts].remove();
      delete existingBubbles[ts];
    }
  });

  // voeg nieuwe bubbels toe
  participants.forEach(participant => {
    const ts = String(participant.timestamp);
    if (!existingBubbles[ts]) {
      // markeer als nieuw voor pop-animatie
      if (!newParticipantTimestamps.includes(ts)) {
        newParticipantTimestamps.push(ts);
      }
      const bubble = createParticipantBubble(participant, displayContainer);
      displayContainer.appendChild(bubble);

      // na animatie verwijderen uit "nieuw"-lijst
      setTimeout(() => {
        const idx = newParticipantTimestamps.indexOf(ts);
        if (idx !== -1) newParticipantTimestamps.splice(idx, 1);
      }, 2000); // gelijk aan CSS-animatieduur
    }
  });

  // teller updaten zonder label te overschrijven
  setParticipantCount(participants.length);
}

// document ready
document.addEventListener('DOMContentLoaded', function () {
  const displayContainer = document.getElementById('display-container');
  if (!displayContainer) return;

  // initieel display
  updateDisplay();

  // periodiek nieuwe deelnemers controleren
  setInterval(updateDisplay, CHECK_NEW_INTERVAL);

  // bubbels laten bewegen
  setInterval(() => {
    const bubbles = document.querySelectorAll('.participant-bubble');
    const w = displayContainer.offsetWidth;
    const h = displayContainer.offsetHeight;
    bubbles.forEach(bubble => moveBubble(bubble, w, h));
  }, UPDATE_INTERVAL);

  // optioneel: bij resize direct grenzen corrigeren
  window.addEventListener('resize', () => {
    const w = displayContainer.offsetWidth;
    const h = displayContainer.offsetHeight;
    document.querySelectorAll('.participant-bubble').forEach(bubble => {
      let x = parseFloat(bubble.dataset.x);
      let y = parseFloat(bubble.dataset.y);
      const width = bubble.offsetWidth;
      const height = bubble.offsetHeight;
      if (x + width > w) x = Math.max(0, w - width);
      if (y + height > h) y = Math.max(0, h - height);
      bubble.dataset.x = x;
      bubble.dataset.y = y;
      bubble.style.left = `${x}px`;
      bubble.style.top = `${y}px`;
    });
  });
});