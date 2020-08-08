const express = require("express");
require("./db/mongoose");

const auth = require("./middleware/auth");
const {
  calendarAuthURL,
  authorizeCalendar,
} = require("./calendar/calendarAuth");
const { scheduleMonth } = require("./calendar/utils/scheduleV2");

const Teacher = require("./models/Teacher");
const Student = require("./models/Student");
const Lesson = require("./models/Lesson");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

app.listen(port, () => {
  console.log("Server is up on port: " + port);
});

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

app.patch("/teacher/:id", async (req, res) => {
  const _id = req.params.id;
  const body = req.body;

  try {
    const teacher = await Teacher.findByIdAndUpdate(_id, body);

    if (!teacher) res.status(404).send();

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
      });
    }

    const token = await teacher.generateAuthToken();

    res.send({ teacher, token });
  } catch (e) {
    res.status(401).send(e);
  }
});

app.post("/student", auth, async (req, res) => {
  try {
    const student = new Student(req.body);

    const newStudent = await student.save();

    authorizeCalendar(req.teacher, newStudent, scheduleMonth);

    res.status(201).send();
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get("/student", async (req, res) => {
  try {
    const students = await Student.find({});

    res.send(students);
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
    const student = await Student.findByIdAndUpdate(_id, body);
    if (allowed) {
      if (!student) res.status(404).send();

      res.status(200).send();
    } else res.status(400).send();
  } catch (e) {
    res.status(500).send();
  }
});

app.get("/lessons", async (req, res) => {
  try {
    const lessons = await Lesson.find({});
    res.send(lessons);
  } catch (e) {
    res.status(500).send();
  }
});

app.get("/lessons:id", async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) res.status(404).send();

    res.send(lesson);
  } catch (e) {
    res.status(500).send();
  }
});

app.get("/oauth", async (req, res) => {
  try {
    const calendarAuthCode = req.query.code;

    res.redirect("http://localhost:3000?code=" + calendarAuthCode);
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
