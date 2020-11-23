const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");
const Teacher = require("../models/Teacher")
const { calendarAuthURL, authorizeCalendar } = require("../calendar/calendarAuth")
const { getCalendarName } = require("../calendar/utils/scheduleV2")

router.post("/teacher", async (req, res) => {
    try {
      const teacher = new Teacher(req.body);
      await teacher.save();
      const token = teacher.generateAuthToken();
  
      res.status(201).send(JSON.stringify({ calendarAuthURL, teacher, token }));
    } catch (e) {
      res.status(500).send(e);
    }
  });
  
  router.get("/teacher/:id/calendar", auth, async (req, res) => {
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
  
  router.patch("/teacher/:id", auth, async (req, res) => {
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
  
  router.post("/teacher/login", async (req, res) => {
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

  module.exports = router