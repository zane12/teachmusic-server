const axios = require("axios");
const moment = require("moment");

const Lesson = require("../../models/Lesson");
const Student = require("../../models/Student");

const scheduleNextLesson = async (
  student,
  today = new Date(),
  sameMonthOnly = false
) => {
  const lessonDate = new Date();
  const month = today.getMonth();

  lessonDate.setDate(
    //finds next lesson day
    today.getDate() + ((7 - today.getDay()) % 7) + student.lessonTime.lessonDay
  );
  lessonDate.setHours(
    student.lessonTime.lessonHour,
    student.lessonTime.lessonMinute,
    0,
    0
  );

  const nextLesson = new Lesson({ student, lessonDate });

  if (!sameMonthOnly) {
    return await nextLesson.save();
  } else if (nextLesson.lessonDate.getMonth() === month) {
    return await nextLesson.save();
  } else {
    return null;
  }
};

const createLesson = async ({ student, nextLesson }) => {
  newLesson = new Lesson({ lessonDate: nextLesson, student: student._id });
  await newLesson.save();
};

const rescheduleOneLesson = async (lessonId, newDate) => {
  return await Lesson.findByIdAndUpdate(lessonId, {
    lessonDate: newDate,
  });
};

const rescheduleLessons = async (studentId, lessonTime) => {
  return await Student.findByIdAndUpdate(studentId, { lessonTime });
};

const createLink = async (lesson) => {
  let link = await axios
    .get("https://calendly.com/api/v1/users/me/event_types", {
      headers: {
        "X-TOKEN": "GMJNCLJPG7ROEHPTFMRTIGXOMFXQKLCL",
      },
    })
    .then((res) => {
      return res.data.data[0].attributes.url;
    })
    .catch((e) => {
      console.log(e);
    });

  const urlParams = moment(lesson.lessonDate).toISOString(true).slice(0, -13);

  return console.log(link + "/" + urlParams);
};

const fillMonth = async (student) => {
  let d = new Date();
  const month = d.getMonth();
  let n = new Lesson();
  do {
    //when n is null, the month was filled
    await scheduleNextLesson(student, d, true)
      .then((lesson) => {
        n = lesson;
        if (lesson) {
          d = lesson.lessonDate;

          createLink(lesson);
        } else {
          return null;
        }
      })
      .catch((e) => {
        console.log(e);
      });
  } while (n);
};

module.exports = {
  scheduleNextLesson,
  rescheduleOneLesson,
  rescheduleLessons,
  createLesson,
  createLink,
  fillMonth,
};
