import { Router } from "express"
import { Storage } from "@google-cloud/storage"
import createError from "http-errors"

const router = Router()

// This assumes you have your Google Cloud credentials configured in your Vercel environment variables.
// Vercel automatically decodes the base64-encoded GOOGLE_CREDENTIALS variable.
const storage = new Storage()

const bucketName = process.env.GCS_BUCKET_NAME // Make sure to set this in your .env and Vercel environment

router.post("/generate-signed-url", async (req, res, next) => {
  if (!bucketName) {
    return next(createError(500, "GCS_BUCKET_NAME is not configured."))
  }

  const { fileName, contentType } = req.body

  if (!fileName || !contentType) {
    return next(createError(400, "fileName and contentType are required."))
  }

  const options = {
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType: contentType,
  }

  const [url] = await storage.bucket(bucketName).file(fileName).getSignedUrl(options)
  res.json({ url })
})

export default router