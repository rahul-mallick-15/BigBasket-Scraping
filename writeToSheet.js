require("dotenv").config();
const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

// Scarped data
const data = require("./data.json");

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

async function writeToSheet() {
  try {
    const auth = await authorize();
    const sheets = google.sheets({ version: "v4", auth });
    const batchUpdateRequest = {
      requests: [],
    };

    const values = [];
    values.push(Object.keys(data[0]));
    values.push(...data.map((item) => Object.values(item)));
    const request = {
      updateCells: {
        range: {
          sheetId: 0,
          startRowIndex: 0,
          endRowIndex: values.length,
          startColumnIndex: 0,
          endColumnIndex: 14,
        },
        fields: "userEnteredValue(stringValue)",
        rows: values.map((row) => ({
          values: row.map((value) => ({
            userEnteredValue: { stringValue: value.toString() },
          })),
        })),
      },
    };
    batchUpdateRequest.requests.push(request);
    // batchUpdateRequest.requests.push(formatFirstRow);

    // Execute the batch update request to format the first row
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.SHEET_ID,
      resource: batchUpdateRequest,
    });
    console.log(response.data);
  } catch (error) {
    console.log(error);
  }
}

writeToSheet();
const formatFirstRow = {
  repeatCell: {
    range: {
      sheetId: 0,
      startRowIndex: 0,
      endRowIndex: 1,
      startColumnIndex: 0,
      endColumnIndex: 14,
    },
    cell: {
      userEnteredFormat: {
        horizontalAlignment: "CENTER",
        backgroundColor: {
          red: 0.88,
          green: 0.88,
          blue: 0.88,
        },
        padding: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10,
        },
        textFormat: {
          bold: true,
        },
      },
    },
    fields:
      "userEnteredFormat(textFormat,horizontalAlignment,backgroundColor,padding)",
  },
};
