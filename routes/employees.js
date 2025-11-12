import express from "express"
import {
  registerEmployee,
  getAllEmployees,
  getEmployee,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employeeController.js"

const router = express.Router()

router.post("/register", registerEmployee)
router.get("/", getAllEmployees)
router.get("/:id", getEmployee)
router.put("/:id", updateEmployee)
router.delete("/:id", deleteEmployee)

export default router
