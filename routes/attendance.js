import express from "express"
import {
  markAttendance,
  getAttendanceRecords,
  getTodayAttendance,
  deleteAttendance,
  getTopPerformers,
} from "../controllers/attendanceController.js";

const router = express.Router()

router.post("/mark", markAttendance)
router.get("/employee/:employeeId", getAttendanceRecords)
router.get("/today", getTodayAttendance)
router.delete("/:id", deleteAttendance)
router.get("/top-performers", getTopPerformers);

export default router
