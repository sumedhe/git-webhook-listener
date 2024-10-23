const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios'); // Using axios now!

// Load environment variables from .env file (optional)
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware to parse JSON body
app.use(bodyParser.json());

// Get the webhook secret and GitHub token from environment variables
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;  // GitHub token for API requests

// Function to verify the signature
function verifySignature(req) {
    const signature = req.headers['x-hub-signature-256'];
    const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
    const digest = `sha256=${hmac.update(JSON.stringify(req.body)).digest('hex')}`;
    return signature === digest;
}

// Function to get issue URL from content_node_id using GraphQL
async function getIssueUrl(contentNodeId) {
    const query = `
        query($id: ID!) {
            node(id: $id) {
                ... on Issue {
                    url
                }
            }
        }
    `;

    try {
        const response = await axios.post(
            'https://api.github.com/graphql',
            {
                query: query,
                variables: { id: contentNodeId },
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                },
            }
        );

        const data = response.data;
        if (data.errors) {
            console.error('Error fetching issue URL:', data.errors);
            return null;
        }

        return data.data.node ? data.data.node.url : null;
    } catch (error) {
        console.error('Error during GraphQL request:', error);
        return null;
    }
}

app.get('/', (req, res) => {
    console.log('GET /');
    res.send('GitHub Webhook Receiver');
});

// GitHub webhook receiver endpoint
app.post('/webhook', async (req, res) => {
    // Verify the GitHub signature
    // if (!verifySignature(req)) {
    //     console.log('Signature mismatch!');
    //     return res.status(403).send('Signature mismatch!');
    // }

    console.log("Received a webhook event!", req.body);

    // Extract content_node_id from the webhook payload
    const contentNodeId = req.body.projects_v2_item?.content_node_id;

    if (contentNodeId) {
        console.log(`Found content_node_id: ${contentNodeId}`);

        // Fetch the issue URL using the content_node_id
        const issueUrl = await getIssueUrl(contentNodeId);

        if (issueUrl) {
            console.log(`Issue URL: ${issueUrl}`);
        } else {
            console.log('Could not fetch issue URL');
        }
    } else {
        console.log('content_node_id not found in the webhook payload');
    }

    // Respond with success
    res.status(200).send('Webhook received!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`GitHub Webhook Receiver running on port ${PORT}`);
});
