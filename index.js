import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import "./config/firebase.js" // Import to initialize Firebase
import attendanceRoutes from "./routes/attendance.js"
import employeeRoutes from "./routes/employees.js"
import uploadRoutes from "./routes/uploads.js"
import authRoutes from "./routes/auth.js"

dotenv.config()

const app = express()

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use("/api/attendance", attendanceRoutes)
app.use("/api/employees", employeeRoutes)
app.use("/api/uploads", uploadRoutes)
app.use("/api/auth", authRoutes)

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Attendance API. Please use the /api routes. V2" })
})

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" })
})

// Global error handler - MUST be the last middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  const statusCode = err.status || 500
  const message = err.message || "Internal Server Error"
  res.status(statusCode).json({ error: { message, status: statusCode } })
})
app.listen(process.env.PORT || 5000, () => {
  console.log(`Server is running on port localhost${process.env.PORT || 5000}`)
})

// Export the app for Vercel
export default app
