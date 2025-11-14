import jwt from "jsonwebtoken"

export const loginAdmin = async (req, res, next) => {
  const { email, password } = req.body

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." })
  }

  try {
    const adminEmail = process.env.ADMIN_EMAIL
    const adminPassword = process.env.ADMIN_PASSWORD

    // In a real-world app, passwords should be hashed and stored securely.
    // For this project, we'll compare against environment variables.
    if (email === adminEmail && password === adminPassword) {
      // Credentials are correct, generate a JWT
      const token = jwt.sign(
        { email: adminEmail, role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "1000h" } // Token expires in 1000 hours
      )

      res.json({ message: "Admin login successful", token })
    } else {
      // Invalid credentials
      res.status(401).json({ message: "Invalid credentials" })
    }
  } catch (error) {
    next(error) // Pass errors to the global error handler
  }
}