# BLUNEURON warranty registration

The form keeps an unfinished draft locally in the browser. It writes to Google Sheets only when the Register warranty button is clicked. After a successful registration, the form resets and the next registration is saved to a new row. Separate tabs get separate drafts.

## Setup

1. Install Node.js 20 or newer.
2. Open the target Google spreadsheet, choose **Extensions > Apps Script**, and replace the editor contents with [`Code.gs`](Code.gs). Save the project.
3. Select `setup` in the Apps Script function menu and click **Run**. Approve the requested permissions. In the execution log, copy the generated API token.
4. In Apps Script, choose **Deploy > New deployment**, select **Web app**, set **Execute as** to **Me**, and set access to **Anyone**. Deploy and copy the URL ending in `/exec`.
5. In PowerShell, from this project folder, run:

   ```powershell
   Copy-Item .env.example .env
   ```

6. Open `.env` and set `GOOGLE_APPS_SCRIPT_URL` to the deployment URL and `GOOGLE_APPS_SCRIPT_TOKEN` to the token from the execution log.
7. Install dependencies and start the app:

   ```powershell
   npm.cmd install
   npm.cmd start
   ```

8. Open [http://localhost:3000](http://localhost:3000). The script creates the `Warranty Registrations` tab and its headers when it first saves a draft.

The sheet stores a registration ID, full name, purchase date, invoice number, last-updated timestamp, phone number, and email. The Apps Script runs as your Google account; neither the script URL nor its token is sent to browser JavaScript. The Express endpoint forwards saves and returns the script's success or failure to the form.

The web app must allow access to **Anyone** so the server can call it. Some Google Workspace administrators disable public web apps; if that applies, ask your administrator or use an authenticated deployment. For a public site, use HTTPS and appropriate abuse protection and privacy controls before collecting real customer information.