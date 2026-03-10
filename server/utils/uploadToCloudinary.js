import cloudinary from "./cloudinary.js"; // ✅ MUST BE THIS
import path from "path";

// ✅ Support images + PDFs. Try raw for PDFs, fallback to auto if raw fails.
const uploadToCloudinary = async (filePath, options = {}) => {
  const ext = path.extname(filePath).toLowerCase();
  const isPdf = ext === ".pdf";

  const baseOptions = {
    folder: "placement_certificates",
    type: "upload",
    ...options,
  };

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      ...baseOptions,
      resource_type: isPdf ? "raw" : "auto",
    });

    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      resource_type: result.resource_type,
    };
  } catch (err) {
    // ✅ Fallback for PDF delivery if raw is blocked in account settings
    if (isPdf) {
      const result = await cloudinary.uploader.upload(filePath, {
        ...baseOptions,
        resource_type: "auto",
      });

      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        resource_type: result.resource_type,
      };
    }

    throw err;
  }
};

// ✅ Try delete for both image and raw resources (PDFs are usually raw)
export const deleteFromCloudinary = async (public_id) => {
  if (!public_id) return;
  await cloudinary.uploader.destroy(public_id);
  await cloudinary.uploader.destroy(public_id, { resource_type: "raw" });
};

export default uploadToCloudinary;
