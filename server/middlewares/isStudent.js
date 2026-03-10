import appError from "../utils/errorUtils.js";

const isStudent = (req, res, next) => {
  if (req.user?.role !== "student") {
    return next(new appError("Access denied. Students only.", 403));
  }
  next();
};

export default isStudent;
