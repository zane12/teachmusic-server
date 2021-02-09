const express = require("express");
const cors = require("cors");
require("./db/mongoose");
const lessonRoutes = require("./routers/lessonRoutes")
const studentRoutes = require("./routers/studentRoutes")
const teacherRoutes = require("./routers/teacherRoutes")
//const paymentRoutes = require("./routers/paymentRoutes")


const moment = require("moment");
const {

  authorizeCalendar,
} = require("./calendar/calendarAuth");
const {
  scheduleMonth,
 
} = require("./calendar/utils/scheduleV2");

const Teacher = require("./models/Teacher");
const Student = require("./models/Student");


const CronJob = require("cron").CronJob;

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());
app.use(cors());
app.use(studentRoutes)
app.use(teacherRoutes)
app.use(lessonRoutes)
//app.use(paymentRoutes);

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

      if(moment(student.lessonTime.firstLesson).isAfter(searchDate)) {
        return null;
      }

      while (searchDate.day() !== dayToFind) {
        searchDate.add(1, "day");
      }

      student.lessonTime.firstLesson = searchDate.toDate();
      //student.lessonTime.firstLesson = something
      console.log(student.lessonTime)

      authorizeCalendar(teacher, student, scheduleMonth);
    });
  },
  null,
  true,
  "America/Chicago"
);
job.start();

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
