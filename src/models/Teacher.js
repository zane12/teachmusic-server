const mongoose = require("mongoose");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const teacherSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  bio: {
    type: String,
    default: "",
  },
  //   subjects: {},
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    validate(value) {
      if (!validator.isEmail(value)) {
        throw new Error("Not a valid email address");
      }
    },
  },
  password: {
    type: String,
    required: true,
    trim: true,
    minlength: 7,
    validate(value) {
      if (value === value.toLowerCase() || value === value.toUpperCase())
        throw new Error("Password must include both upper and lower case");
    },
  },

  authorized: {
    type: Boolean,
    default: false,
  },

  calendarAuthCode: {
    type: String,
  },
  calendarToken: {
    type: String,
  },

  tokens: [
    {
      token: {
        type: String,
        required: true,
      },
    },
  ],

  //   phone: {},
  //   rate: {},
  //   photo: {},
  //   payment: {},
});

teacherSchema.virtual("students", {
  ref: "Student",
  localField: "_id",
  foreignField: "teacherId",
});

teacherSchema.methods.generateAuthToken = async function () {
  const teacher = this;

  const token = jwt.sign(
    { _id: teacher._id.toString() },
    process.env.JWT_SECRET
  );

  teacher.tokens = teacher.tokens.concat({ token });
  await teacher.save();
  return token;
};

teacherSchema.methods.toJSON = function () {
  const teacher = this;
  const teacherObject = teacher.toObject();

  delete teacherObject.students;
  delete teacherObject.password;
  delete teacherObject.tokens;
  delete teacherObject.calendarAuthCode;
  delete teacherObject.calendarToken;

  return teacherObject;
};

const Teacher = mongoose.model("Teacher", teacherSchema);

module.exports = Teacher;
