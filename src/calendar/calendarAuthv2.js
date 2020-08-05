const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENTID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL
);

const calendarAuthURL = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
});

module.exports = calendarAuthURL;
