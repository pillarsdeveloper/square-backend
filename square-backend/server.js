import http from "http";
import crypto from "crypto";

// Use Node's built-in fetch (Node 18+)
const SQUARE_URL = "https://connect.squareupsandbox.com/v2/payments";
const ACCESS_TOKEN = "EAAAl2X7OPkU9gODUndmGJXW9qaPdNgurCO0pRkHfMC3Vg79Qq64CE9ZI5QwyN7z";
const LOCATION_ID = "L79D8F2G84D9N";

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/pay") {
    res.writeHead(404);
    return res.end("Not Found");
  }

  let body = "";
  req.on("data", chunk => body += chunk.toString());

  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      const { token, amount } = data;

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
      return res.end(JSON.stringify({
        success: response.ok,
        data: json
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
  console.log("🔥 RUNNING — Square Payments (NO SDK, FULLY STABLE) on port 3000");
});
