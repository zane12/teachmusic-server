const { google } = require("googleapis");
const Teacher = require("../models/Teacher");

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar",
];

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENTID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL
);

const calendarAuthURL = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent",
});

const getCalendarToken = (teacher, student, callback) => {
  const code = teacher.calendarAuthCode;

  oAuth2Client.getToken(code, async (err, token) => {
    if (err) {
      return console.log("client id: " + process.env.GOOGLE_CLIENTID,
        "client secret: " + process.env.GOOGLE_CLIENT_SECRET,
        "redirect url: " + process.env.GOOGLE_REDIRECT_URL);
    }

    oAuth2Client.setCredentials(token);

    token = JSON.stringify(token);

    await Teacher.updateOne(
      { _id: teacher._id },
      {
        calendarToken: token,
      }
    );

    return callback(student, oAuth2Client);
  });
};

const authorizeCalendar = async (teacher, student, callback) => {
  if (!teacher.calendarToken) {
    return getCalendarToken(teacher, student, callback);
  }

  oAuth2Client.setCredentials(JSON.parse(teacher.calendarToken));

  return callback(student, oAuth2Client);
};

module.exports = { calendarAuthURL, authorizeCalendar };
