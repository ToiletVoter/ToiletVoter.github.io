// Configuratie
const MOVEMENT_SPEED = 0.3;  // Lagere waarde = langzamere beweging
const UPDATE_INTERVAL = 30;  // Milliseconden tussen positie-updates
const CHECK_NEW_INTERVAL = 1000;  // Milliseconden tussen controles voor nieuwe deelnemers

let newParticipantTimestamps = [];

// Helper functie om willekeurige posities te genereren
function getRandomPosition(containerWidth, containerHeight, elementWidth, elementHeight) {
    const maxX = containerWidth - elementWidth;
    const maxY = containerHeight - elementHeight;
    return {
        x: Math.floor(Math.random() * maxX),
        y: Math.floor(Math.random() * maxY),
        dx: (Math.random() - 0.5) * MOVEMENT_SPEED,
        dy: (Math.random() - 0.5) * MOVEMENT_SPEED
    };
}

// Bewegingslogica voor een bubbel
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
        x = x <= 0 ? 0 : containerWidth - width;
    }
    if (y <= 0 || y + height >= containerHeight) {
        dy = -dy;
        y = y <= 0 ? 0 : containerHeight - height;
    }

    bubble.dataset.x = x;
    bubble.dataset.y = y;
    bubble.dataset.dx = dx;
    bubble.dataset.dy = dy;

    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
}

// Maak een nieuwe deelnemersbubbel
function createParticipantBubble(participant, container) {
    const bubble = document.createElement('div');
    bubble.className = 'participant-bubble';
    if (newParticipantTimestamps.includes(participant.timestamp)) {
        bubble.classList.add('new');
    }

    const position = getRandomPosition(
        container.offsetWidth,
        container.offsetHeight,
        150, 150
    );

    bubble.dataset.x = position.x;
    bubble.dataset.y = position.y;
    bubble.dataset.dx = position.dx;
    bubble.dataset.dy = position.dy;

    bubble.style.left = `${position.x}px`;
    bubble.style.top = `${position.y}px`;

    bubble.innerHTML = `
        <div class="photo-circle">
            <img src="${participant.photo_url}" alt="${participant.name}">
        </div>
        <div class="participant-info">
            <h3>${participant.name}</h3>
            <p>${participant.company || ''}</p>
            <div class="expertise-tag">${Array.isArray(participant.expertise) ? participant.expertise.join(', ') : participant.expertise}</div>
        </div>
    `;

    bubble.dataset.timestamp = participant.timestamp;
    return bubble;
}

// Update het display met huidige deelnemers (haalt uit Supabase)
async function updateDisplay() {
    const displayContainer = document.getElementById('display-container');
    // Haal deelnemers op uit Supabase
    let { data: participants, error } = await supabase
        .from('participants')
        .select('*')
        .order('timestamp', { ascending: true });
    if (error) {
        console.error("Fout bij ophalen deelnemers:", error);
        participants = [];
    }

    // Verwijder bestaande bubbels
    displayContainer.innerHTML = '';

    // Voeg nieuwe deelnemers toe
    participants.forEach(participant => {
        const bubble = createParticipantBubble(participant, displayContainer);
        displayContainer.appendChild(bubble);
    });

    // Update aantal deelnemers
    document.getElementById('participant-count').textContent = `Aantal ingecheckt: ${participants.length}`;
}

// Exporteer naar CSV (uit Supabase)
async function exportToCSV() {
    try {
        let { data: participants, error } = await supabase
            .from('participants')
            .select('*')
            .order('timestamp', { ascending: true });
        if (error) throw error;

        if (participants.length === 0) {
            alert("Er zijn nog geen deelnemers om te exporteren.");
            return;
        }

        const csvRows = [
            ['Naam', 'Bedrijf', 'Expertise', 'Inchecktijd'].join(',')
        ];

        participants.forEach(p => {
            const expertiseStr = Array.isArray(p.expertise) ? p.expertise.join('; ') : p.expertise;
            const row = [
                p.name || '',
                p.company || '',
                expertiseStr || '',
                new Date(p.timestamp).toLocaleString()
            ].map(item => `"${String(item).replace(/"/g, '""')}"`).join(',');
            csvRows.push(row);
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.href = url;
        link.setAttribute('download', `event_deelnemers_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Fout bij exporteren:", error);
        alert("Er is een fout opgetreden bij het exporteren van de gegevens: " + error.message);
    }
}

// Initialiseer het display wanneer het document is geladen
document.addEventListener('DOMContentLoaded', function() {
    const displayContainer = document.getElementById('display-container');

    // Exportknop configureren
    document.getElementById('export-button').addEventListener('click', exportToCSV);

    // Initieel display bijwerken
    updateDisplay();

    // Periodiek controleren op nieuwe deelnemers
    setInterval(updateDisplay, CHECK_NEW_INTERVAL);

    // Bewegingslogica voor alle bubbels activeren
    setInterval(() => {
        const bubbles = document.querySelectorAll('.participant-bubble');
        bubbles.forEach(bubble => {
            moveBubble(bubble, displayContainer.offsetWidth, displayContainer.offsetHeight);
        });
    }, UPDATE_INTERVAL);

    // Reset functionaliteit (alleen lokaal display leegmaken)
    const resetButton = document.getElementById('reset-button');
    const resetModal = document.getElementById('reset-modal');
    const confirmReset = document.getElementById('confirm-reset');
    const cancelReset = document.getElementById('cancel-reset');

    resetButton.addEventListener('click', function() {
        resetModal.style.display = 'flex';
    });

    cancelReset.addEventListener('click', function() {
        resetModal.style.display = 'none';
    });

    confirmReset.addEventListener('click', function() {
        // Alleen het display leegmaken, niet uit Supabase wissen
        displayContainer.innerHTML = '';
        document.getElementById('participant-count').textContent = 'Aantal ingecheckt: 0';
        resetModal.style.display = 'none';
        alert('Deelnemers zijn uit het beeld verwijderd (niet uit Supabase).');
    });
});
