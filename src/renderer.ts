window.onload = function (): void {
    const messageInput: HTMLInputElement = document.getElementById('message-input') as HTMLInputElement;
    messageInput.focus();
    //@ts-ignore
    window.electronAPI.resetMessages();
};

//@ts-ignore
window.electronAPI.loadUrl((event: Event, url: string): void => {
    console.log(`load-url: ${url}`);
    const browserIframe: HTMLIFrameElement = document.getElementById('browserIframe') as HTMLIFrameElement;
    browserIframe.src = url;
});

//@ts-ignore
window.electronAPI.setOverlay((event: Event, isEnabled: boolean): void => {
    console.log(`set-overlay: ${isEnabled}`);

    const overlay: HTMLElement = document.querySelector('.overlay') as HTMLElement;
    overlay.style.zIndex = isEnabled ? '10' : '-1';
});

const form: HTMLFormElement = document.getElementById('message-form') as HTMLFormElement;
const messageInput: HTMLInputElement = document.getElementById('message-input') as HTMLInputElement;
const messageContainer: HTMLElement = document.getElementById('message-container') as HTMLElement;

interface Message {
    text: string;
    type: string;
    html?: string; // Assuming messages might contain an 'html' property for rendering
}

// Example data
let messages: Message[] = [];

function displayMessages(): void {
    const visible: boolean = isSpinnerVisible();
    messageContainer.innerHTML = ''; // Clear existing messages

    const firstMessage: HTMLElement = document.createElement('div');
    firstMessage.classList.add('message', "received");
    firstMessage.innerHTML = "Hi, how can I help you?";
    messageContainer.appendChild(firstMessage);

    messages.forEach((message: Message) => {
        const messageElement: HTMLElement = document.createElement('div');

        if (message.type != "info") {
            messageElement.classList.add('message');
        }

        messageElement.classList.add(message.type);
        if (message.html) {
            messageElement.innerHTML = message.html;
        }
        messageContainer.appendChild(messageElement);
    });

    messageContainer.innerHTML += '<div class="spinner-container"><div class="spinner"></div></div>'

    setSpinner(visible);

    messageContainer.scrollTop = messageContainer.scrollHeight; // Scroll to the bottom
}

form.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const message: string = messageInput.value.trim();

    if (message !== '') {
        //@ts-ignore
        window.electronAPI.sendMessage({ text: message, type: 'sent' });
        messageInput.value = ''; // Clear input
    }
});

//@ts-ignore
window.electronAPI.receiveMessage((event: Event, message: Message) => {
    messages.push(message);
    displayMessages();
});

//@ts-ignore
window.electronAPI.updatePriceBox((event: Event, params: { lastCost: number; totalCost: number }) => {
    let priceBox: HTMLElement = document.querySelector('.price-box') as HTMLElement;
    if (!priceBox) {
        priceBox = document.createElement('div');
        priceBox.classList.add('price-box');
        document.body.appendChild(priceBox); // Adjust based on your layout needs
    }
    priceBox.innerHTML = `$${params.lastCost.toFixed(2)} $${params.totalCost.toFixed(2)}`;
});

//@ts-ignore
window.electronAPI.setSpinner((event: Event, isVisible: boolean) => {
    setSpinner(isVisible);
});

function isSpinnerVisible(): boolean {
    const spinner: HTMLElement = document.querySelector('.spinner-container') as HTMLElement;

    return spinner ? spinner.style.display == 'flex' : false;
}

function setSpinner(isVisible: boolean): void {
    let spinner: HTMLElement = document.querySelector('.spinner-container') as HTMLElement;

    if (spinner) {
        if (isVisible) {
            spinner.style.display = 'flex';
        } else {
            spinner.style.display = 'none';
        }

        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
}

setSpinner(false);
displayMessages();
