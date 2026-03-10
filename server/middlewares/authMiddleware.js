import jwt from "jsonwebtoken";
import appError from "../utils/errorUtils.js";

const isLoggedIn = async (req, res, next) => {
  try {
    const { token } = req.cookies;

    if (!token) {
      return next(
        new appError(
          "You are not logged in! Please log in to access this resource.",
          401
        )
      );
    }

    const userDetails = jwt.verify(token, process.env.JWT_SECRET);
    req.user = userDetails;
    next();
  } catch (error) {
    return next(new appError("Invalid token or session expired", 401));
  }
};



export default isLoggedIn;
