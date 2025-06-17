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

// Nieuwe aanpak: bubbels worden alleen toegevoegd/verwijderd, niet steeds hermaakt
async function updateDisplay() {
    const displayContainer = document.getElementById('display-container');
    let { data: participants, error } = await window.supabaseClient
        .from('participants')
        .select('*')
        .order('timestamp', { ascending: true });

    if (error) {
        console.error("Fout bij ophalen deelnemers:", error);
        participants = [];
    }

    // Huidige bubbels ophalen
    const existingBubbles = {};
    displayContainer.querySelectorAll('.participant-bubble').forEach(bubble => {
        existingBubbles[bubble.dataset.timestamp] = bubble;
    });

    // Verwijder bubbels die niet meer in de deelnemerslijst staan
    Object.keys(existingBubbles).forEach(ts => {
        if (!participants.find(p => String(p.timestamp) === String(ts))) {
            existingBubbles[ts].remove();
        }
    });

    // Voeg nieuwe bubbels toe als ze nog niet bestaan
    participants.forEach(participant => {
        if (!existingBubbles[participant.timestamp]) {
            // Markeer nieuwe deelnemers zodat de pop-animatie wordt getoond
            newParticipantTimestamps.push(participant.timestamp);
            const bubble = createParticipantBubble(participant, displayContainer);
            displayContainer.appendChild(bubble);

            // Verwijder de timestamp na de animatie zodat het niet opnieuw wordt toegepast
            setTimeout(() => {
                const index = newParticipantTimestamps.indexOf(participant.timestamp);
                if (index !== -1) {
                    newParticipantTimestamps.splice(index, 1);
                }
            }, 2000); // duur van de pop animatie
        }
    });

    // Update aantal deelnemers
    document.getElementById('participant-count').textContent = `Aantal ingecheckt: ${participants.length}`;
}

// Exporteer naar CSV (uit Supabase)
async function exportToCSV() {
    try {
        let { data: participants, error } = await window.supabaseClient
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

    confirmReset.addEventListener('click', async function() {
        try {
            // Haal alle deelnemers op om de bestandsnamen van de foto's te weten
            const { data: participants, error: fetchError } = await window.supabaseClient
                .from('participants')
                .select('photo_url');

            if (fetchError) throw fetchError;

            // Bepaal de paden van de foto's binnen de bucket
            const photoPaths = (participants || [])
                .map(p => {
                    if (!p.photo_url) return null;
                    const path = new URL(p.photo_url).pathname.split('/profile-photos/')[1];
                    return path || null;
                })
                .filter(Boolean);

            if (photoPaths.length) {
                const { error: storageError } = await window.supabaseClient
                    .storage
                    .from('profile-photos')
                    .remove(photoPaths);

                if (storageError) throw storageError;
            }

            // Verwijder alle deelnemers uit Supabase
            const { error } = await window.supabaseClient
                .from('participants')
                .delete()
                .neq('id', 0);

            if (error) throw error;

            displayContainer.innerHTML = '';
            document.getElementById('participant-count').textContent = 'Aantal ingecheckt: 0';
            resetModal.style.display = 'none';
            alert('Alle deelnemers en profielfoto\'s zijn verwijderd.');
        } catch (error) {
            alert("Fout bij resetten deelnemers: " + error.message);
        }
    });

});