const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");
const Lesson = require("../models/Lesson");
const Student= require("../models/Student");


const { authorizeCalendar } = require("../calendar/calendarAuth")
const { rescheduleLesson, removeLesson } = require("../calendar/utils/scheduleV2")

router.get("/lessons", auth, async (req, res) => {
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
  
  router.get("/lessons/:id", async (req, res) => {
    try {
      const lesson = await Lesson.findById(req.params.id);
  
      if (!lesson) res.status(404).send();
  
      res.send(lesson);
    } catch (e) {
      res.status(500).send();
    }
  });
  
  router.patch("/lessons/:id", auth, async (req, res) => {
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

  module.exports = router