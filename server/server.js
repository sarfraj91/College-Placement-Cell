import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔴 FORCE dotenv to read server/.env
dotenv.config({ path: path.join(__dirname, ".env") });



// Use dynamic import to ensure dotenv loads BEFORE app imports cloudinary
const { default: app } = await import("./app.js");
const { default: connectDB } = await import("./config/dbConnection.js");

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  await connectDB();
  console.log(`Server is running on port http://localhost:${PORT}`);
});
