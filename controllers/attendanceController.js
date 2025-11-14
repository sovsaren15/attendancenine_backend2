import admin from "firebase-admin"

// Mark attendance with face data
export const markAttendance = async (req, res) => {
  const db = admin.firestore()
  try {
    const { employeeId, type } = req.body // type can be 'check-in' or 'check-out'

    if (!employeeId || !type) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const attendanceQuery = db
      .collection("attendance")
      .where("employeeId", "==", employeeId)
      .where("checkIn", ">=", today)
      .where("checkIn", "<", tomorrow)

    // --- Handle forgotten check-outs from previous days ---
    const oldOpenAttendanceQuery = db
      .collection("attendance")
      .where("employeeId", "==", employeeId)
      .where("checkOut", "==", null);

    const now = new Date();
    const oldSnapshot = await oldOpenAttendanceQuery.get();
    for (const doc of oldSnapshot.docs) {
      const checkInTime = doc.data().checkIn.toDate();
      // Check if the check-in was on a day before today
      if (checkInTime.toDateString() !== now.toDateString()) {
        const autoCheckOutTime = new Date(checkInTime);
        autoCheckOutTime.setHours(15, 0, 0, 0); // Set to 3:00 PM on the same day as check-in

        await doc.ref.update({
          checkOut: autoCheckOutTime,
          status: "auto-completed", // Use a specific status for clarity
        });
      }
    }
    // --- End of forgotten check-out handling ---

    const snapshot = await attendanceQuery.get()

    if (type === "check-in") {
      if (!snapshot.empty && snapshot.docs[0].data().status !== 'incomplete') {
        return res.status(400).json({ error: "You have already checked in today." })
      }

      // Determine time status
      const earlyThreshold = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0); // Before 8:00:00 AM is Early
      const onTimeThreshold = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 15, 0); // 8:15:00 AM and after is Late

      let timeStatus = "";
      if (now < earlyThreshold) { // e.g., 7:59 AM
        timeStatus = "Early";
      } else if (now >= onTimeThreshold) { // e.g., 8:15 AM or later
        timeStatus = "Late";
      } else { // Between 8:00:00 AM and 8:14:59 AM
        timeStatus = "Good";
      }

      const attendanceRef = db.collection("attendance").doc()
      await attendanceRef.set({
        employeeId,
        checkIn: admin.firestore.FieldValue.serverTimestamp(),
        checkOut: null,
        status: "present",
        timeStatus: timeStatus,
      })
      return res.status(201).json({ success: true, message: "Checked in successfully." })
    } else if (type === "check-out") {
      if (snapshot.empty) {
        return res.status(400).json({ error: "You have not checked in today." })
      }
      const attendanceDoc = snapshot.docs[0]
      if (attendanceDoc.data().checkOut) {
        return res.status(400).json({ error: "You have already checked out today." })
      }
      await attendanceDoc.ref.update({
        checkOut: admin.firestore.FieldValue.serverTimestamp(),
        status: "completed",
      })
      return res.status(200).json({ success: true, message: "Checked out successfully." })
    } else {
      return res.status(400).json({ error: "Invalid attendance type." })
    }
  } catch (error) {
    console.error("Error marking attendance:", error)
    res.status(500).json({ error: "Failed to mark attendance" })
  }
}

// Get attendance records for an employee
export const getAttendanceRecords = async (req, res) => {
  const db = admin.firestore()
  try {
    const { employeeId } = req.params
    const { startDate, endDate } = req.query

    let query = db.collection("attendance").where("employeeId", "==", employeeId)

    if (startDate) {
      query = query.where("checkIn", ">=", new Date(startDate))
    }
    if (endDate) {
      query = query.where("checkIn", "<=", new Date(endDate))
    }

    const snapshot = await query.orderBy("checkIn", "desc").get()
    const records = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        checkIn: data.checkIn?.toDate ? data.checkIn.toDate().toISOString() : data.checkIn,
        checkOut: data.checkOut?.toDate ? data.checkOut.toDate().toISOString() : data.checkOut,
      };
    });

    res.json({ success: true, records })
  } catch (error) {
    console.error("Error fetching attendance:", error)
    res.status(500).json({ error: "Failed to fetch attendance records" })
  }
}

// Get today's attendance report
export const getTodayAttendance = async (req, res) => {
  const db = admin.firestore()
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const snapshot = await db
      .collection("attendance")
      .where("checkIn", ">=", today)
      .where("checkIn", "<", tomorrow)
      .orderBy("checkIn", "desc")
      .get()

    // Fetch employee details for each attendance record
    const attendance = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const attendanceData = doc.data()
        const employeeDoc = await db.collection("employees").doc(attendanceData.employeeId).get()
        const employeeData = employeeDoc.data()
        
        return {
          id: doc.id,
          ...attendanceData, // Keep original data
          // Explicitly convert timestamps to ISO strings for frontend compatibility
          checkIn: attendanceData.checkIn?.toDate ? attendanceData.checkIn.toDate().toISOString() : attendanceData.checkIn,
          checkOut: attendanceData.checkOut?.toDate ? attendanceData.checkOut.toDate().toISOString() : attendanceData.checkOut,
          employeeName: employeeData?.name || 'Unknown',
        }
      })
    )

    res.json({ success: true, attendance })
  } catch (error) {
    console.error("Error fetching today attendance:", error)
    res.status(500).json({ error: "Failed to fetch today attendance" })
  }
}

// Get top performers
export const getTopPerformers = async (req, res) => {
  const db = admin.firestore()
  try {
    const attendanceSnapshot = await db.collection("attendance").get()
    const employeesSnapshot = await db.collection("employees").get()

    const employeeMap = {}
    employeesSnapshot.forEach(doc => {
      employeeMap[doc.id] = { ...doc.data(), id: doc.id }
    })

    const stats = {}

    attendanceSnapshot.forEach(doc => {
      const record = doc.data()
      const employeeId = record.employeeId

      if (!stats[employeeId]) {
        stats[employeeId] = {
          id: employeeId,
          name: employeeMap[employeeId]?.name || 'Unknown',
          lateCount: 0,
          earlyCount: 0,
          attendanceCount: 0,
          overtimeHours: 0,
        }
      }

      stats[employeeId].attendanceCount += 1

      if (record.timeStatus === "Late") {
        stats[employeeId].lateCount += 1
      }
      if (record.timeStatus === "Early") {
        stats[employeeId].earlyCount += 1
      }

      if (record.checkIn && record.checkOut) {
        // Ensure we have valid Date objects to compare
        const checkInTime = record.checkIn.toDate ? record.checkIn.toDate() : new Date(record.checkIn);
        const checkOutTime = record.checkOut.toDate ? record.checkOut.toDate() : new Date(record.checkOut);

        const durationMs = checkOutTime - checkInTime
        const standardWorkdayMs = 5 * 60 * 60 * 1000 // 5 hours
        if (durationMs > standardWorkdayMs) {
          const overtimeMs = durationMs - standardWorkdayMs
          stats[employeeId].overtimeHours += overtimeMs / (1000 * 60 * 60) // convert to hours
        }
      }
    })

    const statsArray = Object.values(stats)

    const topLate = [...statsArray].sort((a, b) => b.lateCount - a.lateCount).slice(0, 3)
    const topEarly = [...statsArray].sort((a, b) => b.earlyCount - a.earlyCount).slice(0, 3)
    const topAttendance = [...statsArray].sort((a, b) => b.attendanceCount - a.attendanceCount).slice(0, 3)
    const topOvertime = [...statsArray].sort((a, b) => b.overtimeHours - a.overtimeHours).slice(0, 3)

    res.json({ success: true, topLate, topEarly, topAttendance, topOvertime })

  } catch (error) {
    console.error("Error fetching top performers:", error)
    res.status(500).json({ error: "Failed to fetch top performers" })
  }
}

// Get all attendance records
export const getAllAttendance = async (req, res) => {
  const db = admin.firestore();
  try {
    const snapshot = await db
      .collection("attendance")
      .orderBy("checkIn", "desc")
      .get();

    // Fetch employee details for each attendance record
    const attendance = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const attendanceData = doc.data();
        const employeeDoc = await db.collection("employees").doc(attendanceData.employeeId).get();
        const employeeData = employeeDoc.data();
        
        return {
          id: doc.id,
          ...attendanceData,
          checkIn: attendanceData.checkIn?.toDate ? attendanceData.checkIn.toDate().toISOString() : attendanceData.checkIn,
          checkOut: attendanceData.checkOut?.toDate ? attendanceData.checkOut.toDate().toISOString() : attendanceData.checkOut,
          employeeName: employeeData?.name || 'Unknown',
        };
      })
    );

    res.json({ success: true, attendance });
  } catch (error) {
    console.error("Error fetching all attendance:", error);
    res.status(500).json({ error: "Failed to fetch all attendance" });
  }
};

// Delete attendance record
export const deleteAttendance = async (req, res) => {
  const db = admin.firestore()
  try {
    const { id } = req.params
    await db.collection("attendance").doc(id).delete()
    res.json({ success: true, message: "Attendance record deleted" })
  } catch (error) {
    console.error("Error deleting attendance:", error)
    res.status(500).json({ error: "Failed to delete attendance record" })
  }
}
