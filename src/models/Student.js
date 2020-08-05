const mongoose = require("mongoose");
const validator = require("validator");

const studentSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  contactName: {
    type: String,
    required: true,
    trim: true,
  },

  lessonTime: {
    lessonDay: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    lessonHour: {
      type: Number,
      required: true,
      min: 0,
      max: 23,
    },
    lessonMinute: {
      type: Number,
      required: true,
      min: 0,
      max: 59,
    },
  },

  email: {
    type: String,
    required: true,
    trim: true,
    validate(value) {
      if (!validator.isEmail(value)) {
        throw new Error("Not a valid email address");
      }
    },
  },

  contactPhone: {
    type: String,
    required: true,
    trim: true,
    validate(value) {
      if (!validator.isMobilePhone(value)) {
        throw new Error("Not a valid phone number");
      }
    },
  },
});

studentSchema.virtual("lessons", {
  ref: "Lesson",
  localField: "_id",
  foreignField: "student",
});

const Student = mongoose.model("Student", studentSchema);

module.exports = Student;
