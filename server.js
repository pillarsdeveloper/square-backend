import http from "http";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

// ENV VARS
const SQUARE_URL = process.env.SQUARE_URL;
const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const LOCATION_ID = process.env.SQUARE_LOCATION_ID;

const ACUITY_USER_ID = process.env.ACUITY_USER_ID;
const ACUITY_API_KEY = process.env.ACUITY_API_KEY;

// --------------------------------------------
// Helper: Global JSON response
// --------------------------------------------
function sendJSON(res, code, data) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

// --------------------------------------------
// Create Appointment (Only for normal booking)
// --------------------------------------------
async function createAcuityAppointment(booking) {
  const auth = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

  const appointmentPayload = {
    appointmentTypeID: booking.appointmentType,
    datetime: `${booking.date}T${booking.time}:00`,
    firstName: booking.firstName,
    lastName: booking.lastName,
    email: booking.email,
    phone: booking.phone,
    calendarID: booking.calendarID,
    fields: [
      { id: 15140822, value: "yes" } // Terms field
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

  if (!response.ok) throw new Error(json?.message || "Acuity Appointment Creation Failed");

  return json;
}

async function getAcuityAvailability(month, appointmentTypeID) {
  const authToken = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

  const url = `https://acuityscheduling.com/api/v1/availability/dates?month=${month}&appointmentTypeID=${appointmentTypeID}`;

  console.log("Calling Acuity URL:", url);
  console.log("Auth Header:", `Basic ${authToken}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${authToken}`,
      "Accept": "application/json"
    }
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("Acuity Error Response:", json);
    throw new Error(json?.message || "Failed to fetch Acuity availability");
  }

  return json;
}

async function getAcuityAppointmentTypes() {
  const authToken = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

  const url = `https://acuityscheduling.com/api/v1/appointment-types`;

  console.log("Calling Appointment Types URL:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${authToken}`,
      "Accept": "application/json",
      "User-Agent": "PostmanRuntime/7.49.1",
      "Connection": "keep-alive"
    }
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("Acuity Appointment Types Error:", json);
    throw new Error(json?.message || "Failed to fetch appointment types");
  }

  return json;
}


async function getAcuityTimes(date, appointmentTypeID) {
  const authToken = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

  const url = `https://acuityscheduling.com/api/v1/availability/times?date=${date}&appointmentTypeID=${appointmentTypeID}`;

  console.log("Calling TIMES URL:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${authToken}`,
      "Accept": "application/json",
      "User-Agent": "PostmanRuntime/7.49.1",
      "Connection": "keep-alive"
    }
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("Acuity Times Error:", json);
    throw new Error(json?.message || "Failed to fetch Acuity times");
  }

  return json;
}


// --------------------------------------------
// HTTP Server
// --------------------------------------------
const server = http.createServer(async (req, res) => {

  if (req.method === "OPTIONS") {
    return sendJSON(res, 200, { ok: true });
  }

  // --------------------------------------------------------
  // NEW ROUTE: GET /availability?month=YYYY-MM&appointmentTypeID=12345
  // --------------------------------------------------------
  if (req.method === "GET" && req.url.startsWith("/availability")) {
    const host = req.headers.host || "localhost:3000";
    const urlObj = new URL(`http://${host}${req.url}`);

    const month = urlObj.searchParams.get("month");
    const appointmentTypeID = urlObj.searchParams.get("appointmentTypeID");
    console.log("month:", month);
    console.log("appointmentTypeID:", appointmentTypeID);

    if (!month || !appointmentTypeID) {
      return sendJSON(res, 400, {
        success: false,
        message: "month and appointmentTypeID are required"
      });
    }

    try {
      const dates = await getAcuityAvailability(month, appointmentTypeID);
      console.log("Acuity Availability:", dates);
      return sendJSON(res, 200, {
        success: true,
        dates
      });

    } catch (err) {
      return sendJSON(res, 500, {
        success: false,
        error: err.message
      });
    }
  }

  // --------------------------------------------------------
  // NEW ROUTE: GET /times?date=YYYY-MM-DD&appointmentTypeID=12345
  // --------------------------------------------------------
  if (req.method === "GET" && req.url.startsWith("/times")) {
    const host = req.headers.host || "localhost:3000";
    const urlObj = new URL(`http://${host}${req.url}`);

    const date = urlObj.searchParams.get("date");
    const appointmentTypeID = urlObj.searchParams.get("appointmentTypeID");

    console.log("date:", date);
    console.log("appointmentTypeID:", appointmentTypeID);

    if (!date || !appointmentTypeID) {
      return sendJSON(res, 400, {
        success: false,
        message: "date and appointmentTypeID are required"
      });
    }

    try {
      const times = await getAcuityTimes(date, appointmentTypeID);

      return sendJSON(res, 200, {
        success: true,
        times
      });

    } catch (err) {
      return sendJSON(res, 500, {
        success: false,
        error: err.message
      });
    }
  }

  // --------------------------------------------------------
  // NEW ROUTE: GET /appointment-types
  // --------------------------------------------------------
  if (req.method === "GET" && req.url.startsWith("/appointment-types")) {
    try {
      const types = await getAcuityAppointmentTypes();

      return sendJSON(res, 200, {
        success: true,
        appointmentTypes: types
      });

    } catch (err) {
      return sendJSON(res, 500, {
        success: false,
        error: err.message
      });
    }
  }

  if (req.method === "POST" && req.url === "/pay") {
    let body = "";
    req.on("data", chunk => body += chunk.toString());

    req.on("end", async () => {
      try {
        const data = JSON.parse(body || "{}");
        const { token, amount, bookingDetails } = data;

        console.log("➡️ Payment Started");
        console.log("Booking Details:", bookingDetails);

        // Square Payment Payload
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

        const square = await response.json();

        if (!response.ok || square.payment?.status !== "COMPLETED") {
          return sendJSON(res, 400, {
            success: false,
            message: "Payment Failed",
            square
          });
        }

        console.log("✔ Payment Completed!");

        // ⭐ CASE 1 — BUNDLE / PACKAGE (NO APPOINTMENT NEEDED)
        if (bookingDetails.isPackage === true) {
          console.log("➡ Package Purchase Completed");

          return sendJSON(res, 200, {
            success: true,
            squarePayment: square.payment,
            message: "Package purchased successfully"
          });
        }

        // ⭐ CASE 2 — NORMAL APPOINTMENT
        console.log("➡ Creating Acuity Appointment...");

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
  }

});

server.listen(3000, () => {
  console.log("🔥 Square Backend Running on Port 3000");
});
