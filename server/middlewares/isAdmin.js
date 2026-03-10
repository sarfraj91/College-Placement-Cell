import jwt from "jsonwebtoken";
import appError from "../utils/errorUtils.js";

const isAdmin = (req, res, next) => {
  try {
    // 1️⃣ Get token from cookies
    const token = req.cookies?.token;

    if (!token) {
      return next(new appError("Access denied. No token provided.", 403));
    }

    // 2️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3️⃣ Attach user to request
    req.user = decoded; 
    // decoded should contain { id, role }

    // 4️⃣ Check admin role
    if (req.user.role !== "admin") {
      return next(new appError("Access denied. Admins only.", 403));
    }

    next();
  } catch (error) {
    return next(new appError("Invalid or expired token.", 403));
  }
};

export default isAdmin;
