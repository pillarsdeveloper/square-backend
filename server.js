import http from "http";
import crypto from "crypto";

// Use Node's built-in fetch (Node 18+)
const SQUARE_URL = process.env.SQUARE_URL;
const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const LOCATION_ID = process.env.SQUARE_LOCATION_ID;

const ACUITY_USER_ID = process.env.ACUITY_USER_ID;
const ACUITY_API_KEY = process.env.ACUITY_API_KEY;

// ⭐ ALWAYS return CORS + JSON safely
function sendJSON(res, code, data) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://www.denver.dexafit.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

async function createAcuityAppointment(booking) {
  const auth = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

  const appointmentPayload = {
    appointmentTypeID: booking.appointmentType,
    datetime: `${booking.date}T${booking.time}:00`,  // Example: 2026-04-15T10:30:00
    firstName: booking.firstName,
    lastName: booking.lastName,
    email: booking.email,
    phone: booking.phone,
    calendarID: booking.calendarID,
    fields: [
      {
        id: 15140822,
        value: "yes"
      }
    ]
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

const server = http.createServer(async (req, res) => {
  // Handle OPTIONS request (CORS)
  if (req.method === "OPTIONS") {
    return sendJSON(res, 200, { ok: true });
  }

  if (req.method !== "POST" || req.url !== "/pay") {
    return sendJSON(res, 404, { error: "Not Found" });
  }

  let body = "";
  req.on("data", chunk => body += chunk.toString());

  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      const { token, amount, bookingDetails } = data;

      console.log("➡️ Payment + Booking Started");
      console.log("Booking Details:", bookingDetails);

      // ⭐ Square Payment Payload
      const payload = {
        source_id: token,
        idempotency_key: crypto.randomUUID(),
        location_id: LOCATION_ID,
        amount_money: { amount, currency: "USD" }
      };

      // ⭐ SEND PAYMENT REQUEST
      const response = await fetch(SQUARE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
          "Square-Version": "2023-10-18"
        },
        body: JSON.stringify(payload)
      });

      const square = await response.json();

      if (!response.ok || square.payment?.status !== "COMPLETED") {
        return sendJSON(res, 400, {
          success: false,
          message: "Payment Failed",
          square
        });
      }

      console.log("✔ Payment Completed. Now Booking Appointment...");

      // ⭐ Create Appointment
      const appointment = await createAcuityAppointment(bookingDetails);

      return sendJSON(res, 200, {
        success: true,
        squarePayment: square.payment,
        acuityAppointment: appointment
      });

    } catch (err) {
      console.error("❌ SERVER ERROR:", err.message);
      return sendJSON(res, 500, {
        success: false,
        error: err.message
      });
    }
  });
});

server.listen(3000, () => {
  console.log("🔥 RUNNING — Square Payments (NO SDK, FULLY STABLE) on port 3000");
});