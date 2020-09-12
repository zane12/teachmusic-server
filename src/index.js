const express = require("express");
const cors = require("cors");
require("./db/mongoose");

const auth = require("./middleware/auth");
const moment = require("moment");
const {
  calendarAuthURL,
  authorizeCalendar,
} = require("./calendar/calendarAuth");
const {
  scheduleMonth,
  modifyLessons,
  stopLessons,
  getCalendarName,
  removeLesson,
  rescheduleLesson,
} = require("./calendar/utils/scheduleV2");

const Teacher = require("./models/Teacher");
const Student = require("./models/Student");
const Lesson = require("./models/Lesson");

const CronJob = require("cron").CronJob;

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());
app.use(cors());

app.listen(port, () => {
  console.log("Server is up on port: " + port);
});

const job = new CronJob(
  "0 0 25 * *",

  async () => {
    const students = await Student.find({});
    students.map(async (student) => {
      const teacher = await Teacher.findOne({ _id: student.teacherId });

      const dayToFind = student.lessonTime.lessonDay;
      let searchDate = moment(new Date());
      searchDate = searchDate.add(1, "month").startOf("month");

      while (searchDate.day() !== dayToFind) {
        searchDate.add(1, "day");
      }

      student.lessonTime.firstLesson = searchDate.toDate();
      //student.lessonTime.firstLesson = something

      authorizeCalendar(teacher, student, scheduleMonth);
    });
  },
  null,
  true,
  "America/Chicago"
);
job.start();

app.post("/teacher", async (req, res) => {
  try {
    const teacher = new Teacher(req.body);
    await teacher.save();
    const token = teacher.generateAuthToken();

    res.status(201).send(JSON.stringify({ calendarAuthURL, teacher, token }));
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get("/teacher/:id/calendar", auth, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) res.status(404).send();

    const calendarName = await authorizeCalendar(
      teacher,
      null,
      getCalendarName
    );

    res.send(JSON.stringify({ calendarName }));
  } catch (e) {
    res.status(500).send(e);
  }
});

app.patch("/teacher/:id", auth, async (req, res) => {
  const _id = req.params.id;
  const body = req.body;

  for (prop in body) {
    if (body[prop] === "") {
      delete body[prop];
    }
  }

  try {
    const authorize = await Teacher.findOne({
      email: body.email,
      password: body.password,
    });

    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) res.status(404).send();
    if (!authorize) res.status(401).send();
    if (authorize._id.equals(teacher._id)) {
      if (body.newPassword && body.newPassword === body.confirmNewPassword) {
        body.password = body.newPassword;
        delete body.newPassword;
        delete body.confirmNewPassword;
      }

      if (body.newEmail) {
        body.email = body.newEmail;
        delete body.newEmail;
      }

      await Teacher.findByIdAndUpdate(req.params.id, body);
    }

    res.status(200).send();
  } catch (e) {
    res.status(500).send();
  }
});

app.post("/teacher/login", async (req, res) => {
  try {
    const teacher = await Teacher.findOne({
      email: req.body.email,
      password: req.body.password,
    });

    if (teacher === undefined || teacher.length === 0) {
      throw new Error("email/password combination not found");
    }

    if (req.body.calendarAuthCode) {
      await Teacher.findByIdAndUpdate(teacher._id, {
        calendarAuthCode: req.body.calendarAuthCode,
        authorized: req.body.authorized,
      });
    }

    const token = await teacher.generateAuthToken();
    let data = { teacher, token };
    if (!teacher.authorized) {
      data.calendarAuthURL = calendarAuthURL;
    }

    res.send(data);
  } catch (e) {
    res.status(401).send(e);
  }
});

app.post("/student", auth, async (req, res) => {
  try {
    const student = new Student({
      ...req.body,
      teacherId: req.teacher._id,
    });

    await authorizeCalendar(req.teacher, student, scheduleMonth);

    await student.save();

    res.status(201).send();
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get("/student", auth, async (req, res) => {
  try {
    const teacher = await req.teacher
      .populate({ path: "students" })
      .execPopulate();

    res.send(teacher.students);
  } catch (e) {
    res.status(500).send();
  }
});

app.get("/student/:id", async (req, res) => {
  try {
    const _id = req.params.id;

    const student = await Student.findById(_id);

    if (!student) res.status(404).send();

    res.send(student);
  } catch (e) {
    res.status(500).send();
  }
});

app.patch("/student/:id", auth, async (req, res) => {
  const _id = req.params.id;
  const body = req.body;
  const allowedUpdates = [
    "name",
    "contactName",
    "email",
    "contactPhone",
    "lessonTime",
    "password",
    "endLessons",
  ];
  let allowed = true;

  for (const update in body) {
    const compare = allowedUpdates.indexOf(update);
    if (compare === -1) {
      allowed = false;
      break;
    }
  }

  try {
    if (allowed) {
      //Check if lesson time has been updated and update calendar

      if (body.lessonTime) {
        //Stop lessons if marked for stop
        //If marked for stop, body comes in as lessonTime: dateToStop and endLessons: true
        if (body.endLessons) {
          const stopStudent = (await Student.findById(_id)).toObject();

          stopStudent.endLessonTime = req.body.lessonTime;

          authorizeCalendar(req.teacher, stopStudent, stopLessons);

          stopStudent.stopped = true;

          const updatedStudent = await Student.findByIdAndUpdate(
            _id,
            stopStudent
          );

          return res.send();
        }

        const current = (await Student.findById(_id)).toObject();
        current.newLessonTime = body.lessonTime;
        authorizeCalendar(req.teacher, current, modifyLessons);
      }

      const student = await Student.findByIdAndUpdate(_id, body, {
        runValidators: true,
      });
      if (!student) res.status(404).send();

      res.status(200).send();
    } else res.status(400).send();
  } catch (e) {
    res.status(500).send();
  }
});

app.get("/lessons", auth, async (req, res) => {
  try {
    // const lessons = await Lesson.find({});
    const teacher = await req.teacher
      .populate({ path: "students" })
      .execPopulate();

    const lessons = await Promise.all(
      teacher.students.map(async (stu) => {
        const student = await stu.populate({ path: "lessons" }).execPopulate();

        return { student, lessons: student.lessons };
      })
    );

    res.send(lessons);
  } catch (e) {
    res.status(500).send();
  }
});

app.get("/lessons/:id", async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) res.status(404).send();

    res.send(lesson);
  } catch (e) {
    res.status(500).send();
  }
});

app.patch("/lessons/:id", auth, async (req, res) => {
  try {
    const lesson = await Lesson.findByIdAndUpdate(req.params.id, req.body);
    const student = await Student.findById(lesson.student);
    if (lesson) {
      if (req.body.cancelled) {
        student.lessonToRemove = req.params.id;

        authorizeCalendar(req.teacher, student, removeLesson);
      }
      if (req.body.lessonDate) {
        student.lessonToReschedule = req.params.id;
        student.newLessonDate = req.body.lessonDate;
        authorizeCalendar(req.teacher, student, rescheduleLesson);
      }
      res.send();
    } else {
      res.status(404).send();
    }
  } catch (e) {
    res.status(500).send();
  }
});

app.get("/oauth", async (req, res) => {
  try {
    const calendarAuthCode = req.query.code;

    res.redirect(process.env.CLIENT_URL + "?code=" + calendarAuthCode);
  } catch (e) {
    res.status(500).send(e);
  }
});

//testing grounds

// testStudent = new Student({
//   name: "test",
//   contactName: "test",
//   lessonTime: {
//     lessonDay: 1,
//     lessonHour: 12,
//     lessonMinute: 0,
//   },
// });

// scheduleChange = new Date();
// scheduleChange.setDate(3);
// scheduleChange.setMonth(8);
// scheduleChange.setHours(4, 0, 0);

// newLessonTime = { lessonDay: 3, lessonHour: 14, lessonMinute: 30 };

//fillMonth(testStudent);

// rescheduleOneLesson("5f1dac74779d844e7c967367", scheduleChange).then(
//   (lesson) => {
//     createLink(lesson);
//   }
// );

// rescheduleLessons("5f1cfa20b887a762f85d1099", newLessonTime).then((student) => {
//   scheduleNextLesson(student).then((lesson) => {
//     createLink(lesson);
//   });
// });
