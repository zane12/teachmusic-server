const Teacher = require("../models/Teacher");
const jwt = require("jsonwebtoken");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    teacher = await Teacher.findOne({
      _id: decoded,
      "tokens.token": token,
    });

    if (!teacher) throw new Error("Error in auth");

    req.teacher = teacher;
    req.token = token;

    next();
  } catch (e) {
    res.status(401).send({ error: "User must authenticate." });
  }
};

module.exports = auth;
