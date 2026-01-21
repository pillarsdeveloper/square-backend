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
const ACUITY_OWNER_ID = process.env.ACUITY_OWNER_ID;

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

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject("Invalid JSON body");
      }
    });
  });
}

// --------------------------------------------
// Create Appointment (Only for normal booking)
// --------------------------------------------
async function createAcuityAppointment(booking) {
  const auth = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

  const appointmentPayload = {
    appointmentTypeID: booking.appointmentTypeID,
    datetime: booking.datetime,
    firstName: booking.firstName,
    lastName: booking.lastName,
    email: booking.email,
    phone: booking.phone,
    fields: [
      { id: 15140822, value: "yes" } // Terms field
    ]
  };

  // ✅ ADDONS — normalize safely
  if (booking.addonIDs) {
    if (Array.isArray(booking.addonIDs)) {
      appointmentPayload.addonIDs = booking.addonIDs.map(Number);
    } else {
      // single addon as string/number → convert to array
      appointmentPayload.addonIDs = [Number(booking.addonIDs)];
    }
  }


  console.log("Calling Acuity Appointment Creation:", appointmentPayload);
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

async function getAcuityAvailability(appointmentTypeID, month) {
  const authToken = Buffer
    .from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`)
    .toString("base64");

  const owner = process.env.ACUITY_OWNER_ID;

  let url =
    `https://app.acuityscheduling.com/api/scheduling/v1/availability/month` +
    `?owner=${owner}` +
    `&appointmentTypeId=${appointmentTypeID}` +
    `&calendarId=any` +
    `&timezone=America/Denver`;

  // month optional rakha
  if (month) {
    url += `&month=${month}`;
  }

  console.log("Calling Acuity URL:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${authToken}`,
      Accept: "application/json"
    }
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("Acuity Error:", json);
    throw new Error(json?.message || "Failed to fetch availability");
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


async function getAcuityTimes(date, appointmentTypeId, calendarId = "any", addonIds = []) {
  const authToken = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

  // Build URL with required parameters
  const urlObj = new URL("https://app.acuityscheduling.com/api/scheduling/v1/availability/times");
  urlObj.searchParams.set("owner", ACUITY_OWNER_ID);
  urlObj.searchParams.set("appointmentTypeId", appointmentTypeId);
  urlObj.searchParams.set("calendarId", calendarId);
  urlObj.searchParams.set("startDate", date);
  urlObj.searchParams.set("timezone", "America/Denver");

  // Add optional addonIds if provided
  if (addonIds && addonIds.length > 0) {
    addonIds.forEach(id => {
      urlObj.searchParams.append("addonIds[]", id);
    });
  }

  const url = urlObj.toString();
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

async function getAcuityAddons() {
  const authToken = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

  const url = `https://acuityscheduling.com/api/v1/appointment-addons`;

  console.log("Calling ADDONS URL:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${authToken}`,
      "Accept": "application/json"
    }
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("Acuity Addons Error:", json);
    throw new Error(json?.message || "Failed to fetch Acuity addons");
  }

  return json;
}

async function getAcuityProducts() {
  const authToken = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");
  const url = `https://acuityscheduling.com/api/v1/products`;

  console.log("Calling PRODUCTS URL:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${authToken}`,
      "Accept": "application/json"
    }
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("Acuity Products Error:", json);
    throw new Error(json?.message || "Failed to fetch Acuity products");
  }

  return json;   // array of gift cards, packages, bundles
}

async function getAcuityOrderSummary(
  selectedAppointments,
  tipAmount,
  certificateCode,
  additionalAmount,
  bookingEmail
) {
  const authToken = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

  const url = "https://app.acuityscheduling.com/api/scheduling/v1/appointments/order-summary";

  // Owner ALWAYS from env
  const bodyData = {
    owner: ACUITY_OWNER_ID,
    selectedAppointments,
    tipAmount,
    certificateCode,
    additionalAmount,
    bookingEmail
  };

  console.log("Calling ORDER SUMMARY URL:", url);
  console.log("Request Body:", JSON.stringify(bodyData, null, 2));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authToken}`,
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(bodyData)
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("Acuity Order Summary Error:", json);

    throw {
      status: response.status,
      acuityError: json
    };
  }

  return json;
}

async function placeAcuityGiftOrder(orderData) {
  const authToken = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

  const url = `https://app.acuityscheduling.com/api/scheduling/v1/catalog/place-order`;

  console.log("Calling Acuity Gift/Package Order:", url);

  const payload = {
    firstName: orderData.firstName,
    lastName: orderData.lastName,
    email: Array.isArray(orderData.email) ? orderData.email : [orderData.email],
    phone: orderData.phone,
    smsOptIn: false,
    owner: process.env.ACUITY_OWNER_ID,
    couponCode: orderData.couponCode || "Ashok1234567890",
    orderItems: orderData.orderItems || []
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("Acuity Gift Order Error:", json);
    throw new Error(json?.message || "Failed to place gift/package order");
  }

  return json;
}

async function getAcuityGiftOrderSummary(data) {
  const authToken = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

  const url = `https://app.acuityscheduling.com/api/scheduling/v1/catalog/order-summary`;

  console.log("Calling Acuity Order Summary:", url);

  const payload = {
    owner: process.env.ACUITY_OWNER_ID,       // always from backend
    orderItems: data.orderItems || []
  };

  // Optional fields
  if (data.couponCode) payload.couponCode = data.couponCode;
  if (data.email) payload.email = Array.isArray(data.email) ? data.email : [data.email];

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("Acuity Order Summary Error:", json);
    throw new Error(json?.message || "Failed to fetch order summary");
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

    const appointmentTypeID = urlObj.searchParams.get("appointmentTypeID");
    const month = urlObj.searchParams.get("month"); // optional

    if (!appointmentTypeID) {
      return sendJSON(res, 400, {
        success: false,
        message: "appointmentTypeID is required"
      });
    }

    try {
      const availability = await getAcuityAvailability(
        appointmentTypeID,
        month
      );

      return sendJSON(res, 200, {
        success: true,
        availability
      });

    } catch (err) {
      return sendJSON(res, 500, {
        success: false,
        error: err.message
      });
    }
  }

  // --------------------------------------------------------
  // NEW ROUTE: GET /times?date=YYYY-MM-DD&appointmentTypeID=12345&calendarId=any&addonIds[]=12345
  // --------------------------------------------------------
  if (req.method === "GET" && req.url.startsWith("/times")) {
    const host = req.headers.host || "localhost:3000";
    const urlObj = new URL(`http://${host}${req.url}`);

    const date = urlObj.searchParams.get("date");
    const appointmentTypeID = urlObj.searchParams.get("appointmentTypeID");
    const calendarId = urlObj.searchParams.get("calendarId") || "any";

    // Extract addonIds[] array from query params
    const addonIds = urlObj.searchParams.getAll("addonIds[]").filter(id => id && id.trim() !== "");

    console.log("date:", date);
    console.log("appointmentTypeID:", appointmentTypeID);
    console.log("calendarId:", calendarId);
    console.log("addonIds:", addonIds);

    if (!date || !appointmentTypeID) {
      return sendJSON(res, 400, {
        success: false,
        message: "date and appointmentTypeID are required"
      });
    }

    try {
      const times = await getAcuityTimes(date, appointmentTypeID, calendarId, addonIds);

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

  // --------------------------------------------------------
  // NEW ROUTE: GET /addons
  // --------------------------------------------------------
  if (req.method === "GET" && req.url.startsWith("/appointment-addons")) {
    try {
      const addons = await getAcuityAddons();

      return sendJSON(res, 200, {
        success: true,
        addons
      });

    } catch (err) {
      return sendJSON(res, 500, {
        success: false,
        error: err.message
      });
    }
  }

  // --------------------------------------------------------
  // NEW ROUTE: POST /order-summary
  // --------------------------------------------------------
  if (req.method === "POST" && req.url.startsWith("/order-summary")) {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const jsonBody = JSON.parse(body);

        const {
          selectedAppointments,
          tipAmount = 0,
          certificateCode = "",
          additionalAmount = 0,
          bookingEmail
        } = jsonBody;

        // Owner NOT required from payload
        if (!selectedAppointments || !bookingEmail) {
          return sendJSON(res, 400, {
            success: false,
            message: "selectedAppointments and bookingEmail are required"
          });
        }

        const summary = await getAcuityOrderSummary(
          selectedAppointments,
          tipAmount,
          certificateCode,
          additionalAmount,
          bookingEmail
        );

        return sendJSON(res, 200, {
          success: true,
          summary
        });

      } catch (err) {
        if (err.acuityError) {
          return sendJSON(res, err.status || 400, {
            success: false,
            acuityError: err.acuityError
          });
        }

        return sendJSON(res, 500, {
          success: false,
          error: err.message || "Unexpected server error"
        });
      }
    });
  }

  // --------------------------------------------------------
  // POST /acuity/gift-order
  // --------------------------------------------------------
  if (req.method === "POST" && req.url === "/acuity/gift-order") {
    try {
      const body = await getRequestBody(req);

      const result = await placeAcuityGiftOrder(body);

      return sendJSON(res, 200, {
        success: true,
        order: result
      });

    } catch (err) {
      return sendJSON(res, 500, {
        success: false,
        error: err.message
      });
    }
  }

  // --------------------------------------------------------
  // POST /acuity/order-summary
  // --------------------------------------------------------
  if (req.method === "POST" && req.url === "/acuity/gift-order-summary") {
    try {
      const body = await getRequestBody(req);

      const summary = await getAcuityGiftOrderSummary(body);

      return sendJSON(res, 200, {
        success: true,
        summary
      });

    } catch (err) {
      return sendJSON(res, 500, {
        success: false,
        error: err.message
      });
    }
  }


  // --------------------------------------------------------
  // NEW ROUTE: GET /products
  // --------------------------------------------------------
  if (req.method === "GET" && req.url.startsWith("/products")) {
    try {
      const products = await getAcuityProducts();

      return sendJSON(res, 200, {
        success: true,
        products
      });

    } catch (err) {
      return sendJSON(res, 500, {
        success: false,
        error: err.message
      });
    }
  }


  // Only for normal booking 
  if (req.method === "POST" && req.url === "/appointments/checkout") {
    let body = "";

    req.on("data", chunk => body += chunk.toString());

    req.on("end", async () => {
      try {
        const bookingDetails = JSON.parse(body || "{}");

        console.log("➡ Creating Acuity Appointment...");
        console.log("Booking Details:", bookingDetails);

        const appointment = await createAcuityAppointment(bookingDetails);

        return sendJSON(res, 200, {
          success: true,
          appointment: appointment
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


  // Booking API with Square Payment Integration & Acuity Appointment Creation
  if (req.method === "POST" && req.url === "/pay") {
    let body = "";

    req.on("data", chunk => body += chunk.toString());

    req.on("end", async () => {
      try {
        const data = JSON.parse(body || "{}");
        const { token, amount } = data;

        console.log("➡️ Payment Started");

        if (!token || !amount) {
          return sendJSON(res, 400, {
            success: false,
            message: "token and amount are required"
          });
        }

        // Square Payment Payload
        const payload = {
          source_id: token,
          idempotency_key: crypto.randomUUID(),
          location_id: LOCATION_ID,
          amount_money: {
            amount,
            currency: "USD"
          }
        };

        console.log("➡️ Square Payment SQUARE_URL:", SQUARE_URL);
        console.log("➡️ Square Payment ACCESS_TOKEN:", ACCESS_TOKEN);
        console.log("Using Location:", LOCATION_ID);

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

        // ❌ Payment Failed
        if (!response.ok || square.payment?.status !== "COMPLETED") {
          return sendJSON(res, 400, {
            success: false,
            message: "Payment Failed",
            square
          });
        }

        console.log("✔ Payment Completed!");

        // ✅ Only return the Square payment response
        return sendJSON(res, 200, {
          success: true,
          squarePayment: square.payment,
          message: "Payment completed successfully"
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
