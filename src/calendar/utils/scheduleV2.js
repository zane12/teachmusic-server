const { google } = require("googleapis");
const moment = require("moment");
const Student = require("../../models/Student");
const Lesson = require("../../models/Lesson");
const mongoose = require("mongoose");

async function addLessons(student, auth) {
  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.events.instances({
    auth,
    calendarId: "primary",
    eventId: student.recurringEventId,
  });
  const instances = response.data.items;
  //instances contains each events google calendar data
  instances.forEach(async (event) => {
    const lessonDate = moment(event.start.dateTime).format("MMDDYYYY");
    const calendarId = event.id;

    const lesson = new Lesson({ lessonDate, student: student._id, calendarId });

    await lesson.save();
  });
}

async function removeLessons(student, auth) {
  const calendar = google.calendar({ version: "v3", auth });

  if (!student.recurringEventId) {
    return null;
  }
  const response = await calendar.events
    .instances({
      auth,
      calendarId: "primary",
      eventId: student.recurringEventId,
    })
    .catch((e) => {
      console.log(e);
    });
  const instances = response.data.items;
  //instances contains each events google calendar data
  if (instances.length > 0) {
    instances.forEach(async (event) => {
      const calendarId = event.id;

      const lesson = await Lesson.findOne({ calendarId });

      if (lesson) {
        if (!lesson.taught) {
          await lesson.deleteOne();
        }
      }
    });
  } else {
    console.log("No lesson to remove");
  }
}

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
    sendUpdates: "none",
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

      const newStudent = Student.findByIdAndUpdate(
        student._id,
        {
          recurringEventId: event.data.id,
        },
        { new: true },
        (err, stu) => {
          if (err) {
            console.log(err);
          }
          addLessons(stu, auth);
        }
      );

      return newStudent;
    }
  );
}

const modifyLessons = async (student, auth) => {
  //student comes in as an object with newLessonTime attached.

  const endMoment = moment(student.newLessonTime.firstLesson).subtract(
    1,
    "days"
  );

  //used to check if the event should be readded or removed completely
  let rescheduleCheck = true;

  if (
    moment(student.newLessonTime.firstLesson).isBefore(
      moment(student.lessonTime.firstLesson)
    )
  ) {
    rescheduleCheck = false;
  }

  const endRecurrence =
    moment(endMoment).format("YYYYMMDD") +
    "T" +
    moment(endMoment).format("HHmmss") +
    "Z";
  //20110701T170000Z <-- formatted for Google Calendar api v3 recurrence

  removeLessons(student, auth);

  const calendar = google.calendar({ version: "v3", auth });

  if (rescheduleCheck) {
    const oldLesson = await calendar.events.get({
      auth,
      calendarId: "primary",
      eventId: student.recurringEventId,
    });

    oldLesson.data.recurrence = ["RRULE:FREQ=WEEKLY;UNTIL=" + endRecurrence];

    await calendar.events.update({
      auth,
      calendarId: "primary",
      eventId: student.recurringEventId,
      resource: oldLesson.data,
    });

    addLessons(student, auth);
  } else {
    await calendar.events.delete({
      auth,
      calendarId: "primary",
      eventId: student.recurringEventId,
    });
  }

  const newLessonDate = moment(student.newLessonTime.firstLesson);

  newLessonDate
    .toDate()
    .setHours(
      student.lessonTime.lessonHour,
      student.lessonTime.lessonMinute,
      0,
      0
    );

  let newLessonEnd = newLessonDate;
  newLessonEnd = moment(newLessonDate).add(30, "m").toDate();

  const month = newLessonDate.month();

  const monthEnd = new Date(newLessonDate.year(), month + 1, 0);
  monthEnd.setHours(23, 59, 0, 0);

  const newEndRecurrence =
    moment(monthEnd).format("YYYYMMDD") +
    "T" +
    moment(monthEnd).format("HHmmss") +
    "Z";
  //20110701T170000Z <-- formatted for Google Calendar api v3 recurrence

  const newEvent = {
    summary: "Lesson",
    location: "Somewhere",
    start: {
      dateTime: newLessonDate,
      timeZone: "America/Chicago",
    },
    end: {
      dateTime: newLessonEnd,
      timeZone: "America/Chicago",
    },
    recurrence: ["RRULE:FREQ=WEEKLY;UNTIL=" + newEndRecurrence],
    attendees: [
      {
        email: student.email,
      },
    ],
    sendUpdates: "none",
  };

  await calendar.events.insert(
    {
      auth,
      calendarId: "primary",
      resource: newEvent,
    },
    (err, event) => {
      if (err) {
        return console.log("Error contacting Google Calendar: " + err);
      }

      return Student.findByIdAndUpdate(
        student._id,
        {
          recurringEventId: event.data.id,
        },
        { new: true },
        (err, stu) => {
          if (err) {
            console.log(err);
          }
          addLessons(stu, auth);
        }
      );
    }
  );
};

const stopLessons = async (student, auth) => {
  //student comes in as an object with endLessonTime attached
  const endMoment = moment(student.endLessonTime.firstLesson);
  removeLessons(student, auth);
  const calendar = google.calendar({ version: "v3", auth });

  const endRecurrence =
    moment(endMoment).format("YYYYMMDD") +
    "T" +
    moment(endMoment).format("HHmmss") +
    "Z";
  //20110701T170000Z <-- formatted for Google Calendar api v3 recurrence

  const oldLesson = await calendar.events.get({
    auth,
    calendarId: "primary",
    eventId: student.recurringEventId,
  });

  oldLesson.data.recurrence = ["RRULE:FREQ=WEEKLY;UNTIL=" + endRecurrence];

  await calendar.events
    .update({
      auth,
      calendarId: "primary",
      eventId: student.recurringEventId,
      resource: oldLesson.data,
    })
    .then(() => {
      addLessons(student, auth);
    });
};

module.exports = {
  scheduleMonth,
  modifyLessons,
  stopLessons,
  addLessons,
  removeLessons,
};
