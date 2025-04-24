// Configuratie
const MOVEMENT_SPEED = 0.3;  // Lagere waarde = langzamere beweging
const UPDATE_INTERVAL = 30;  // Milliseconden tussen positie-updates
const CHECK_NEW_INTERVAL = 1000;  // Milliseconden tussen controles voor nieuwe deelnemers

// Houdt bij welke deelnemers nieuw zijn
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
    // Huidige positie en snelheid ophalen
    let x = parseFloat(bubble.dataset.x);
    let y = parseFloat(bubble.dataset.y);
    let dx = parseFloat(bubble.dataset.dx);
    let dy = parseFloat(bubble.dataset.dy);
    
    // Afmetingen van de bubbel
    const width = bubble.offsetWidth;
    const height = bubble.offsetHeight;
    
    // Nieuwe positie berekenen
    x += dx;
    y += dy;
    
    // Botsingslogica met randen
    if (x <= 0 || x + width >= containerWidth) {
        dx = -dx;
        x = x <= 0 ? 0 : containerWidth - width;
    }
    
    if (y <= 0 || y + height >= containerHeight) {
        dy = -dy;
        y = y <= 0 ? 0 : containerHeight - height;
    }
    
    // Update positie en snelheid in dataset
    bubble.dataset.x = x;
    bubble.dataset.y = y;
    bubble.dataset.dx = dx;
    bubble.dataset.dy = dy;
    
    // Update visuele positie
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
    
    // Initiële positie en snelheid
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
    
    // Bubbel-inhoud
    bubble.innerHTML = `
        <div class="photo-circle">
            <img src="${participant.photo}" alt="${participant.name}">
        </div>
        <div class="participant-info">
            <h3>${participant.name}</h3>
            <p>${participant.company || ''}</p>
            <div class="expertise-tag">${participant.expertise.join(', ')}</div>
        </div>
    `;
    
    return bubble;
}

// Update het display met huidige deelnemers
function updateDisplay() {
    const displayContainer = document.getElementById('display-container');
    const storedParticipants = JSON.parse(localStorage.getItem('eventParticipants') || '[]');
    
    // Bijhouden van huidige deelnemers voor vergelijking
    const currentBubbles = Array.from(displayContainer.querySelectorAll('.participant-bubble'));
    const currentTimestamps = currentBubbles.map(bubble => bubble.dataset.timestamp);
    
    // Controleer op nieuwe deelnemers
    const newParticipants = storedParticipants.filter(p => !currentTimestamps.includes(p.timestamp));
    
    // Toevoegen van nieuwe deelnemers
    if (newParticipants.length > 0) {
        newParticipantTimestamps = newParticipants.map(p => p.timestamp);
        
        newParticipants.forEach(participant => {
            const bubble = createParticipantBubble(participant, displayContainer);
            bubble.dataset.timestamp = participant.timestamp;
            displayContainer.appendChild(bubble);
        });
        
        // Reset de 'nieuwe' status na 3 seconden
        setTimeout(() => {
            newParticipantTimestamps = [];
            document.querySelectorAll('.participant-bubble.new').forEach(bubble => {
                bubble.classList.remove('new');
            });
        }, 3000);
    }
    
    // Update aantal deelnemers
    document.getElementById('participant-count').textContent = `Aantal ingecheckt: ${storedParticipants.length}`;
}

// Exporteer naar CSV
function exportToCSV() {
    try {
        const participants = JSON.parse(localStorage.getItem('eventParticipants') || '[]');
        
        if (participants.length === 0) {
            alert("Er zijn nog geen deelnemers om te exporteren.");
            return;
        }
        
        // CSV header
        const csvRows = [
            ['Naam', 'Bedrijf', 'Expertise', 'Inchecktijd'].join(',')
        ];
        
        // Data toevoegen
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
        
        // CSV string aanmaken
        const csvString = csvRows.join('\n');
        
        // Download aanmaken
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.href = url;
        link.setAttribute('download', `event_deelnemers_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Geheugenlek voorkomen
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
    // Reset functionaliteit
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
    // Deelnemers verwijderen
    localStorage.removeItem('eventParticipants');
    
    // Display leegmaken
    const displayContainer = document.getElementById('display-container');
    displayContainer.innerHTML = '';
    
    // Aantal bijwerken
    document.getElementById('participant-count').textContent = 'Aantal ingecheckt: 0';
    
    // Modal sluiten
    resetModal.style.display = 'none';
    
    alert('Alle deelnemers zijn succesvol verwijderd.');
});
});