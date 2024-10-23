const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios'); // Using axios for API requests

// Load environment variables from .env file (optional)
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware to parse JSON body
app.use(bodyParser.json());

// Get the webhook secret and GitHub token from environment variables
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;  // GitHub token for API requests
const PROJECT_NODE_ID = process.env.PROJECT_NODE_ID; // Predefined project_node_id

// Function to verify the signature
function verifySignature(req) {
    const signature = req.headers['x-hub-signature-256'];
    const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
    const digest = `sha256=${hmac.update(JSON.stringify(req.body)).digest('hex')}`;
    return signature === digest;
}

// Function to get issue URL and body from content_node_id using GraphQL
async function getIssueDetails(contentNodeId) {
    const query = `
        query($id: ID!) {
            node(id: $id) {
                ... on Issue {
                    url
                    body
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
            console.error('Error fetching issue details:', data.errors);
            return null;
        }

        return data.data.node ? { url: data.data.node.url, body: data.data.node.body } : null;
    } catch (error) {
        console.error('Error during GraphQL request:', error);
        return null;
    }
}

// Function to update the issue body by appending text
async function updateIssueBody(issueUrl, newBodyContent) {
    // Extract the issue number and repository from the issue URL
    const issueUrlParts = issueUrl.split('/');
    const owner = issueUrlParts[4];  // owner part of the URL
    const repo = issueUrlParts[5];   // repository part of the URL
    const issueNumber = issueUrlParts[7];  // issue number part of the URL

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;

    try {
        const response = await axios.patch(
            apiUrl,
            { body: newBodyContent },
            {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,  // Use 'token' for the authorization header
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`Issue body updated successfully: ${response.data.url}`);
    } catch (error) {
        console.error('Error updating issue body:', error.response ? error.response.data : error.message);
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

    // Check if project_node_id matches the predefined one
    const projectNodeId = req.body.projects_v2_item?.project_node_id;
    if (projectNodeId !== PROJECT_NODE_ID) {
        console.log('project_node_id does not match. No action taken.', projectNodeId, PROJECT_NODE_ID);
        return res.status(200).send('No action taken.');
    }

    // Extract content_node_id from the webhook payload
    const contentNodeId = req.body.projects_v2_item?.content_node_id;

    if (contentNodeId) {
        console.log(`Found content_node_id: ${contentNodeId}`);

        // Fetch the issue URL and body using the content_node_id
        const issueDetails = await getIssueDetails(contentNodeId);

        if (issueDetails && issueDetails.url) {
            console.log(`Issue URL: ${issueDetails.url}`);

            // Append new text to the issue body
            const newBodyContent = `${issueDetails.body}\n\n**Automated Update:** Text appended to issue.`;

            // Update the issue body
            await updateIssueBody(issueDetails.url, newBodyContent);
        } else {
            console.log('Could not fetch issue details');
        }
    } else {
        console.log('content_node_id not found in the webhook payload');
    }

    // Respond with success
    res.status(200).send('Webhook received and processed!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`GitHub Webhook Receiver running on port ${PORT}`);
});
