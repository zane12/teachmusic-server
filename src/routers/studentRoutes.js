const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const  Student = require("../models/Student")
const { authorizeCalendar } = require("../calendar/calendarAuth")
const { modifyLessons, stopLessons, scheduleMonth } = require("../calendar/utils/scheduleV2")

router.post("/student", auth, async (req, res) => {
    try {
      const student = new Student({
        ...req.body,
        teacherId: req.teacher._id,
        
      });
      
      student.paymentURL = process.env.CLIENT_URL + "/payment/" + student._id
      

      await authorizeCalendar(req.teacher, student, scheduleMonth);
  
      await student.save();
  
      res.status(201).send();
    } catch (e) {
      console.log(e)
      res.status(500).send(e);
    }
  });
  
  router.get("/student", auth, async (req, res) => {
    try {
      const teacher = await req.teacher
        .populate({ path: "students" })
        .execPopulate();
  
      res.send(teacher.students);
    } catch (e) {
      res.status(500).send();
    }
  });
  
  router.get("/student/:id", async (req, res) => {
    try {
      const _id = req.params.id;
  
      const student = await Student.findById(_id);
  
      if (!student) res.status(404).send();
  
      res.send(student);
    } catch (e) {
      res.status(500).send();
    }
  });
  
  router.patch("/student/:id", auth, async (req, res) => {
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
        console.log(e)
      res.status(500).send();
    }
  });
  module.exports = router