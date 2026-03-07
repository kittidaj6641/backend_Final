import express from "express"
import memberRoutes from "./routes/member.js"
import registerRoutes from "./routes/register.js"
import cors from "cors"
import path from "path"
import { fileURLToPath } from "url"

const app = express()
const port = process.env.PORT || 8080

app.use(cors())
app.use(express.json())

// ======================
// API ROUTES
// ======================

app.use("/member", memberRoutes)
app.use("/register", registerRoutes)

app.get("/api", (req, res) => {
  res.json({ message: "hello KSU YES I CAN" })
})

// ======================
// REACT FRONTEND
// ======================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

if (process.env.NODE_ENV === "production") {

  app.use(express.static(path.join(__dirname, "../../login-react/build")))

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../../login-react/build/index.html"))
  })

}

app.listen(port, () => {
  console.log("server running at port " + port)
})
