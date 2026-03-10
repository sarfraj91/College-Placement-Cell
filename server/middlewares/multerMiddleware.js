import multer from "multer";
import path from "path"

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
  fileFilter: (_req, file, cb) => {
    // ✅ Accept PDF even if mimetype is application/octet-stream
    const ext = path.extname(file.originalname).toLowerCase();
    const isPdf = ext === ".pdf";
    const isImage = [".jpeg", ".jpg", ".png"].includes(ext);

    const allowedImageMime = ["image/jpeg", "image/png"];
    const allowedPdfMime = ["application/pdf", "application/octet-stream"];

    const imageOk = isImage && allowedImageMime.includes(file.mimetype);
    const pdfOk = isPdf && allowedPdfMime.includes(file.mimetype);

    if (imageOk || pdfOk) {
      return cb(null, true);
    }

    cb(new Error("Only .jpeg, .jpg, .png, .pdf format allowed!"));
  },

});

export default upload;
