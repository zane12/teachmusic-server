const { google } = require("googleapis");
const { authorize } = require("./calendarAuth");
const fs = require("fs");
const moment = require("moment");
const Student = require("../models/Student");

const student = new Student({
  name: "TestStudent",
  contactName: "TestContact",
  lessonTime: {
    lessonDay: 1,
    lessonHour: 14,
    lessonMinute: 30,
  },
});

// Load client secrets from a local file.
fs.readFile("credentials.json", (err, content) => {
  if (err) return console.log("Error loading client secret file:", err);
  // Authorize a client with credentials, then call the Google Calendar API.

  authorize(JSON.parse(content), student, scheduleMonth);
});

//schedules next lesson recurring to the end of the month.
async function scheduleMonth(auth, student) {
  const today = new Date();

  const lessonDate = new Date();

  //finds next lesson day
  lessonDate.setDate(
    today.getDate() + ((7 - today.getDay()) % 7) + student.lessonTime.lessonDay
  );

  const month = lessonDate.getMonth();

  lessonDate.setHours(
    student.lessonTime.lessonHour,
    student.lessonTime.lessonMinute,
    0,
    0
  );

  let lessonEnd = lessonDate;
  lessonEnd = moment(lessonDate).add(30, "m").toDate();

  const monthEnd = new Date(lessonDate.getFullYear(), month + 1, 0);
  monthEnd.setHours(23, 59, 0, 0);

  const endRecurrence =
    moment(monthEnd).format("YYYYMMDD") +
    "T" +
    moment(monthEnd).format("HHmmss") +
    "Z";
  //20110701T170000Z

  const calendarEvent = {
    summary: "Appointment",
    location: "Somewhere",
    start: {
      dateTime: lessonDate,
      timeZone: "America/Chicago",
    },
    end: {
      dateTime: lessonEnd,
      timeZone: "America/Chicago",
    },
    recurrence: ["RRULE:FREQ=WEEKLY;UNTIL=" + endRecurrence],
    attendees: [
      {
        email: "test@test.com",
      },
    ],
  };

  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.insert(
    {
      auth,
      calendarId: "primary",
      resource: calendarEvent,
    },
    (err, event) => {
      if (err) {
        return console.log("Error contacting Google Calendar: " + err);
      }
      console.log("Event created: " + event);
    }
  );
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */

function listEvents(auth) {
  const calendar = google.calendar({ version: "v3", auth });
  calendar.events.list(
    {
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    },
    (err, res) => {
      if (err) return console.log("The API returned an error: " + err);
      const events = res.data.items;
      if (events.length) {
        console.log("Upcoming 10 events:");
        events.map((event, i) => {
          const start = event.start.dateTime || event.start.date;
          console.log(`${start} - ${event.summary}`);
        });
      } else {
        console.log("No upcoming events found.");
      }
    }
  );
}
