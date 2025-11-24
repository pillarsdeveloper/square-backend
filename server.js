import http from "http";
import crypto from "crypto";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const SQUARE_URL = process.env.SQUARE_URL;
const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const LOCATION_ID = process.env.SQUARE_LOCATION_ID;

if (!ACCESS_TOKEN || !LOCATION_ID) {
  throw new Error("Missing Square credentials. Please set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.");
}

// ⭐ Build Acuity Dynamic Link
function buildAcuityLink(booking) {
  const base = "https://dexafitdenver.as.me/schedule.php"; // main booking portal
  const p = new URLSearchParams();

  if (booking.appointmentType) p.append("appointmentType", booking.appointmentType);
  if (booking.firstName) p.append("firstName", booking.firstName);
  if (booking.lastName) p.append("lastName", booking.lastName);
  if (booking.email) p.append("email", booking.email);
  if (booking.phone) p.append("phone", booking.phone);
  if (booking.date) p.append("date", booking.date);
  if (booking.time) p.append("time", booking.time);

  return `${base}?${p.toString()}`;
}

const server = http.createServer(async (req, res) => {
  // ⭐⭐⭐ CORS for Squarespace
  res.setHeader("Access-Control-Allow-Origin", "https://www.denver.dexafit.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  if (req.method !== "POST" || req.url !== "/pay") {
    res.writeHead(404);
    return res.end("Not Found");
  }

  let body = "";
  req.on("data", chunk => body += chunk.toString());

  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      const { token, amount, bookingDetails } = data;

      console.log("➡️ Sending payment to Square…");
      console.log("Token:", token, "Amount:", amount);

      const payload = {
        source_id: token,
        idempotency_key: crypto.randomUUID(),
        location_id: LOCATION_ID,
        amount_money: { amount, currency: "USD" }
      };

      const response = await fetch(SQUARE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
          "Square-Version": "2023-10-18"
        },
        body: JSON.stringify(payload)
      });

      const json = await response.json();

      // ⭐ If payment success → Build Acuity Link
      if (response.ok && json.payment?.status === "COMPLETED") {

        const acuityUrl = buildAcuityLink(bookingDetails);

        return res.end(JSON.stringify({
          success: true,
          payment: json.payment,
          acuityUrl
        }));
      }

      return res.end(JSON.stringify({
        success: false,
        data: json,
        message: "Payment Failed"
      }));

    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        success: false,
        error: "SERVER ERROR",
        detail: err.message
      }));
    }
  });
});

server.listen(3000, () => {
  console.log("🔥 RUNNING — Square Payments Server on port 3000");
});
