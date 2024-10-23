const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// Load environment variables from .env file (optional)
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON body
app.use(bodyParser.json());

// Get the webhook secret from environment variables
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

// Function to verify the signature
function verifySignature(req) {
    const signature = req.headers['x-hub-signature-256'];
    const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
    const digest = `sha256=${hmac.update(JSON.stringify(req.body)).digest('hex')}`;
    return signature === digest;
}

app.get('/', (req, res) => {
    res.send('GitHub Webhook Receiver');
});

// GitHub webhook receiver endpoint
app.post('/webhook', (req, res) => {
    // Verify the GitHub signature
    // if (!verifySignature(req)) {
    //     console.log('Signature mismatch!');
    //     return res.status(403).send('Signature mismatch!');
    // }

    // Get the event type from GitHub's headers
    // const event = req.headers['x-github-event'];

    // Log the event for debugging
    console.log(`Received event: ${event}`);
    console.log('Payload:', req.body);

    // Do something with the webhook payload here
    // if (event === 'push') {
    //     console.log('Received a push event!');
    //     // Handle push event
    // }

    // Respond with success
    res.status(200).send('Webhook received!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`GitHub Webhook Receiver running on port ${PORT}`);
});
