import express from "express";
import cors from "cors";
import qrmailRoutes from "./routes/qrmail";

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "Qincept API is running" });
});

app.use("/api/qrmail", qrmailRoutes);

export default app;