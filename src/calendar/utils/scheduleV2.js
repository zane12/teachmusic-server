const { google } = require("googleapis");
const moment = require("moment");

async function scheduleMonth(student, auth) {
  const lessonDate = student.lessonTime.firstLesson;

  //   //finds next lesson day
  //   const today = new Date();
  //   lessonDate.setDate(
  //     today.getDate() + ((7 - today.getDay()) % 7) + student.lessonTime.lessonDay
  //   );

  const month = lessonDate.getMonth();

  lessonDate.setHours(
    student.lessonTime.lessonHour,
    student.lessonTime.lessonMinute,
    0,
    0
  );

  //lesson length defined as 30 minutes here, in case it needs to be changed
  let lessonEnd = lessonDate;
  lessonEnd = moment(lessonDate).add(30, "m").toDate();

  const monthEnd = new Date(lessonDate.getFullYear(), month + 1, 0);
  monthEnd.setHours(23, 59, 0, 0);

  const endRecurrence =
    moment(monthEnd).format("YYYYMMDD") +
    "T" +
    moment(monthEnd).format("HHmmss") +
    "Z";
  //20110701T170000Z <-- formatted for Google Calendar api v3 recurrence

  const calendarEvent = {
    summary: "Lesson",
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
        email: student.email,
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
      console.log("Event created: " + JSON.stringify(event));
    }
  );
}

module.exports = { scheduleMonth };
