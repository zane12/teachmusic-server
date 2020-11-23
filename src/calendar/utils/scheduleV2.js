const { google } = require("googleapis");
const moment = require("moment");
const Student = require("../../models/Student");
const Lesson = require("../../models/Lesson");
const mongoose = require("mongoose");
const braintree = require('braintree');

const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY
});

async function addLessons(student, auth) {

  //count lessons for billing
  let lessonCount = 0; 

  const calendar = google.calendar({ version: "v3", auth });
  const response = await calendar.events.instances({
    auth,
    calendarId: "primary",
    eventId: student.recurringEventId,
  });
  const instances = response.data.items;
  //instances contains each events google calendar data
  instances.forEach(async (event) => {
    lessonCount++;

    const lessonDate = event.start.dateTime;
    const calendarId = event.id;

    const lesson = new Lesson({ lessonDate, student: student._id, calendarId });

    await lesson.save();
  });

  const update = [{
    amount: 30,
    existingId: process.env.BRAINTREE_LESSON_ADDON,
    neverExpires: true, 
    quantity: lessonCount          
  }]      

  if(student.braintreeSubscriptionId) {
    
    gateway.subscription.find(student.braintreeSubscriptionId)
      .then(result => {
        

        
        gateway.subscription.update(student.braintreeSubscriptionId, {addOns: {update}}).then(result => {
          console.log(result);
        }).catch(e => console.log(e));

      }).catch(e => console.log(e))
    
  } 
  
  
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

  let monthEnd = new Date(lessonDate.getFullYear(), month + 1, 0);
  monthEnd.setHours(23, 59, 0, 0);

  const dateCheck = new Date();
  dateCheck.setDate(25);
  dateCheck.setHours(0, 0, 0, 0);

  if (moment(lessonDate).isSameOrAfter(dateCheck) && moment(lessonDate).month() === moment(dateCheck).month()) {
   monthEnd = moment(monthEnd).add(1, "month");
  }  

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

const rescheduleLesson = async (student, auth) => {
  //student comes in with lessonToReschedule as mongoose ID, and newLessonDate as a Date object
  const calendar = google.calendar({ version: "v3", auth });

  const lessonToReschedule = await Lesson.findOne({
    _id: student.lessonToReschedule,
  });

  const lesson = await calendar.events.get({
    auth,
    calendarId: "primary",
    eventId: lessonToReschedule.calendarId,
  });

  lesson.data.start.dateTime = student.newLessonDate;
  const endtime = moment(student.newLessonDate).add(30, "minutes");
  lesson.data.end.dateTime = endtime.toISOString();

  await calendar.events.update(
    {
      auth,
      calendarId: "primary",
      eventId: lessonToReschedule.calendarId,
      resource: lesson.data,
    },
    (err, event) => {
      if (err) {
        console.log(err);
      } else {
      }
    }
  );
};

const removeLesson = async (student, auth) => {
  //student comes in as object with lessonToRemove attached as a Mongoose ID
  const calendar = google.calendar({ version: "v3", auth });

  const lessonToRemove = await Lesson.findOne({ _id: student.lessonToRemove });

  const lesson = await calendar.events.get({
    auth,
    calendarId: "primary",
    eventId: lessonToRemove.calendarId,
  });

  lesson.data.status = "cancelled";

  calendar.events.update({
    auth,
    calendarId: "primary",
    eventId: lessonToRemove.calendarId,
    resource: lesson.data,
  });

  gateway.subscription.update(student.braintreeId, {
    discounts: {
      add: [
        {inheritedFromId: process.env.BRAINTREE_LESSON_CREDIT}
      ]
    }
  })
};

const stopLessons = async (student, auth) => {
  //student comes in as an object with endLessonTime attached
  const endMoment = moment(student.endLessonTime.firstLesson);
  removeLessons(student, auth);

  let rescheduleCheck = true;

  if (endMoment.isSameOrBefore(moment(student.lessonTime.firstLesson))) {
    rescheduleCheck = false;
  }

  const calendar = google.calendar({ version: "v3", auth });

  const oldLesson = await calendar.events.get({
    auth,
    calendarId: "primary",
    eventId: student.recurringEventId,
  });

  if (rescheduleCheck) {
    const endRecurrence =
      moment(endMoment).format("YYYYMMDD") + "T" + "000000Z";
    //20110701T170000Z <-- formatted for Google Calendar api v3 recurrence

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
  } else {
    await calendar.events.delete({
      auth,
      calendarId: "primary",
      eventId: student.recurringEventId,
    });
  }
};

const getCalendarName = async (student, auth) => {
  const calendar = google.calendar({ version: "v3", auth });

  const response = await calendar.calendars.get({
    auth,
    calendarId: "primary",
  });

  return response.data.id;
};

module.exports = {
  scheduleMonth,
  modifyLessons,
  stopLessons,
  addLessons,
  removeLesson,
  removeLessons,
  getCalendarName,
  rescheduleLesson,
};
