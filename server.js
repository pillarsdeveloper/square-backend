import http from "http";
import crypto from "crypto";

// Use Node's built-in fetch (Node 18+)
const SQUARE_URL = process.env.SQUARE_URL;
const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const LOCATION_ID = process.env.SQUARE_LOCATION_ID;

const ACUITY_USER_ID = process.env.ACUITY_USER_ID;
const ACUITY_API_KEY = process.env.ACUITY_API_KEY;

const server = http.createServer(async (req, res) => {
  // ⭐⭐⭐ CORS FIX FOR SQUARESPACE ⭐⭐⭐
  res.setHeader("Access-Control-Allow-Origin", "https://www.denver.dexafit.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle CORS preflight
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

      console.log("➡️ Sending payment to Square via FETCH...");
      console.log("Token:", token, " Amount:", amount);

      const payload = {
        source_id: token,
        idempotency_key: crypto.randomUUID(),
        location_id: LOCATION_ID,
        amount_money: {
          amount: amount,
          currency: "USD",
        }
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

      res.writeHead(response.ok ? 200 : 400, {
        "Content-Type": "application/json"
      });
      if (response.ok && json.payment?.status === "COMPLETED") {

        console.log("✔ Payment successful. Creating appointment in Acuity...");

        const acuityResponse = await createAcuityAppointment(bookingDetails);

        return res.end(JSON.stringify({
          success: true,
          payment: json.payment,
          appointment: acuityResponse
        }));
      }


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

async function createAcuityAppointment(booking) {
  const auth = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

  const appointmentPayload = {
    appointmentTypeID: booking.appointmentType,
    datetime: `${booking.date}T${booking.time}:00`,  // Example: 2026-04-15T10:30:00
    firstName: booking.firstName,
    lastName: booking.lastName,
    email: booking.email,
    phone: booking.phone,
    calendarID: booking.calendarID
  };

  const response = await fetch("https://acuityscheduling.com/api/v1/appointments", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(appointmentPayload)
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.message || "Acuity Appointment Creation Failed");
  }

  return json;
}

server.listen(3000, () => {
  console.log("🔥 RUNNING — Square Payments (NO SDK, FULLY STABLE) on port 3000");
});