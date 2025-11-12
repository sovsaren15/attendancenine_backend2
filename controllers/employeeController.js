import admin from "firebase-admin"

// Register new employee with face data
export const registerEmployee = async (req, res) => {
  const db = admin.firestore()
  try {
    let { name, email, department, faceDescriptor, dob, startWorkingDate, sex } = req.body

    // Robustness: If faceDescriptor is an object from JSON serialization, convert it to an array.
    if (faceDescriptor && typeof faceDescriptor === 'object' && !Array.isArray(faceDescriptor)) {
      faceDescriptor = Object.values(faceDescriptor);
    }

    if (!name || !email || !faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length === 0) {
      return res.status(400).json({ error: "Missing required fields, including a valid face descriptor." })
    }

    // Validate date formats
    const isValidDate = (dateString) => {
      const date = new Date(dateString);
      return date instanceof Date && !isNaN(date);
    };

    if (dob && !isValidDate(dob)) {
      return res.status(400).json({ error: "Invalid date of birth format. Use YYYY-MM-DD" })
    }

    if (startWorkingDate && !isValidDate(startWorkingDate)) {
      return res.status(400).json({ error: "Invalid start working date format. Use YYYY-MM-DD" })
    }

    // Validate sex field
    if (sex && !['male', 'female', 'other'].includes(sex.toLowerCase())) {
      return res.status(400).json({ error: "Sex must be 'male', 'female', or 'other'" })
    }

    // Check if employee exists
    const existingEmployee = await db.collection("employees").where("email", "==", email).get()

    if (!existingEmployee.empty) {
      return res.status(400).json({ error: "Employee already exists" })
    }

    const employeeRef = db.collection("employees").doc()
    await employeeRef.set({
      name,
      email,
      department: department || "General",
      faceDescriptor: { ...faceDescriptor }, // Convert array to an object for Firestore
      dob: dob || null,
      startWorkingDate: startWorkingDate || admin.firestore.FieldValue.serverTimestamp(),
      sex: sex ? sex.toLowerCase() : null,
      status: "active",
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    res.status(201).json({
      success: true,
      message: "Employee registered successfully",
      employeeId: employeeRef.id,
    })
  } catch (error) {
    console.error("Error registering employee:", error)
    res.status(500).json({ error: "Failed to register employee" })
  }
}

// Get all employees
export const getAllEmployees = async (req, res) => {
  const db = admin.firestore()
  try {
    const snapshot = await db.collection("employees").where("status", "==", "active").get()
    const employees = snapshot.docs.map((doc) => {
      const data = doc.data();
      // Ensure timestamp is converted to a serializable format
      const registeredAt = data.registeredAt?.toDate ? data.registeredAt.toDate().toISOString() : data.registeredAt;
      return { id: doc.id, ...data, registeredAt };
    });

    res.json({ success: true, employees })
  } catch (error) {
    console.error("Error fetching employees:", error)
    res.status(500).json({ error: "Failed to fetch employees" })
  }
}

// Get single employee
export const getEmployee = async (req, res) => {
  const db = admin.firestore()
  try {
    const { id } = req.params
    const doc = await db.collection("employees").doc(id).get()

    if (!doc.exists) {
      return res.status(404).json({ error: "Employee not found" })
    }

    res.json({ success: true, employee: { id: doc.id, ...doc.data() } })
  } catch (error) {
    console.error("Error fetching employee:", error)
    res.status(500).json({ error: "Failed to fetch employee" })
  }
}

// Update employee
export const updateEmployee = async (req, res) => {
  const db = admin.firestore()
  try {
    const { id } = req.params
    const { name, department, faceDescriptor, dob, startWorkingDate, sex } = req.body

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    // Validate date formats if provided
    const isValidDate = (dateString) => {
      const date = new Date(dateString);
      return date instanceof Date && !isNaN(date);
    };

    if (dob && !isValidDate(dob)) {
      return res.status(400).json({ error: "Invalid date of birth format. Use YYYY-MM-DD" })
    }

    if (startWorkingDate && !isValidDate(startWorkingDate)) {
      return res.status(400).json({ error: "Invalid start working date format. Use YYYY-MM-DD" })
    }

    // Validate sex field if provided
    if (sex && !['male', 'female', 'other'].includes(sex.toLowerCase())) {
      return res.status(400).json({ error: "Sex must be 'male', 'female', or 'other'" })
    }

    if (name) updateData.name = name
    if (department) updateData.department = department
    if (faceDescriptor) updateData.faceDescriptor = { ...faceDescriptor } // Convert to object for Firestore
    if (dob) updateData.dob = dob
    if (startWorkingDate) updateData.startWorkingDate = startWorkingDate
    if (sex) updateData.sex = sex.toLowerCase()

    await db.collection("employees").doc(id).update(updateData)

    res.json({ success: true, message: "Employee updated successfully" })
  } catch (error) {
    console.error("Error updating employee:", error)
    res.status(500).json({ error: "Failed to update employee" })
  }
}

// Delete employee (soft delete)
export const deleteEmployee = async (req, res) => {
  const db = admin.firestore()
  try {
    const { id } = req.params
    await db
      .collection("employees")
      .doc(id)
      .update({ status: "inactive", updatedAt: admin.firestore.FieldValue.serverTimestamp() })

    res.json({ success: true, message: "Employee deleted successfully" })
  } catch (error) {
    console.error("Error deleting employee:", error)
    res.status(500).json({ error: "Failed to delete employee" })
  }
}
