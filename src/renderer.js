window.onload = function () {
    document.getElementById('message-input').focus();
    window.electronAPI.resetMessages();
    setSpinner(false);
};

window.electronAPI.loadUrl((event, url) => {
    console.log(`load-url: ${url}`);
    document.getElementById('browserIframe').src = url;
});

// Adjusted to control the overlay's z-index
window.electronAPI.setOverlay((event, isEnabled) => {
    console.log(`set-overlay: ${isEnabled}`)

    const overlay = document.querySelector('.overlay');
    // If `isVisible` is true, set a high z-index. Otherwise, set a negative z-index to hide it.
    overlay.style.zIndex = isEnabled ? '10' : '-1';
});

const form = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messageContainer = document.getElementById('message-container');

// Example data
let messages = [
    // { text: "Hi, how can I help you?", type: "received" },
    // { text: "I'm good, thanks! And you?", type: "sent" }
];

function displayMessages() {
    messageContainer.innerHTML = ''; // Clear existing messages
    messages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', message.type);
        // Use the exposed `markdown.render` function
        messageElement.innerHTML = message.html;
        messageContainer.appendChild(messageElement);
    });
    messageContainer.innerHTML += '<div class="spinner-container"><div class="spinner"></div></div>'
    messageContainer.scrollTop = messageContainer.scrollHeight; // Scroll to the bottom
}

form.addEventListener('submit', e => {
    e.preventDefault();
    const message = messageInput.value.trim();

    if (message !== '') {
        window.electronAPI.sendMessage({ text: message, type: 'sent' });
        messageInput.value = ''; // Clear input
    }
});

window.electronAPI.receiveMessage((event, message) => {
    messages.push(message);
    displayMessages();
});

window.electronAPI.updatePriceBox((event, params) => {
    let priceBox = document.querySelector('.price-box');
    if (!priceBox) {
        priceBox = document.createElement('div');
        priceBox.classList.add('price-box');
        document.body.appendChild(priceBox); // Adjust based on your layout needs
    }
    priceBox.innerHTML = `$${params.lastCost.toFixed(2)} $${params.totalCost.toFixed(2)}`;
});

window.electronAPI.setSpinner((event, isVisible) => {
    setSpinner(isVisible);
});

function setSpinner(isVisible) {
    // Check if the spinner already exists
    let spinner = document.querySelector('.spinner-container');
    const messageContainer = document.getElementById('message-container');

    if (isVisible) {
        spinner.style.display = 'flex';
    } else {
        spinner.style.display = 'none';
    }

    // Scroll to the bottom to ensure the spinner is visible
    messageContainer.scrollTop = messageContainer.scrollHeight;
}
