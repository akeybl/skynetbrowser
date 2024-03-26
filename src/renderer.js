window.onload = function () {
    document.getElementById('message-input').focus();
    window.electronAPI.resetMessages();
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
        messageElement.textContent = message.text;
        messageContainer.appendChild(messageElement);
    });
    messageContainer.scrollTop = messageContainer.scrollHeight; // Scroll to the bottom
}

form.addEventListener('submit', e => {
    e.preventDefault();
    const message = messageInput.value.trim();

    if (message !== '') {
        //   messages.push({ text: message, type: 'sent' });
        //   displayMessages();

        window.electronAPI.sendMessage({ text: message, type: 'sent' });
        messageInput.value = ''; // Clear input
        //   messageContainer.scrollTop = messageContainer.scrollHeight; // Scroll to the bottom
    }
});

window.electronAPI.receiveMessage((event, message) => {
    messages.push(message); // Assuming message is { text: string, type: 'received' }
    displayMessages();
});

// Initially display messages
// displayMessages();
