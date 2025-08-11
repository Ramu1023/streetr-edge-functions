import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Environment variables
const CASHFREE_API_URL = "https://sandbox.cashfree.com/pg/orders"; // Use "https://api.cashfree.com/pg/orders" for production
const CASHFREE_CLIENT_ID = Deno.env.get("CASHFREE_CLIENT_ID");
const CASHFREE_CLIENT_SECRET = Deno.env.get("CASHFREE_CLIENT_SECRET");
const API_VERSION = "2022-09-01";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { total_amount, cart } = await req.json();

    if (!total_amount || !cart || cart.length === 0) {
      throw new Error("Total amount and cart details are required.");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated.");
    }

    const orderId = `order_${Date.now()}`;

    const orderPayload = {
      order_id: orderId,
      order_amount: total_amount,
      order_currency: "INR",
      customer_details: {
        customer_id: user.id,
        customer_email: user.email,
        customer_phone: user.phone || "9999999999", // Fallback phone number
      },
      order_meta: {
        return_url: `http://localhost/order-success?order_id=${orderId}`, // Replace with your actual return URL
      },
      order_note: "StreetR Food Order",
    };

    const response = await fetch(CASHFREE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": API_VERSION,
        "x-client-id": CASHFREE_CLIENT_ID,
        "x-client-secret": CASHFREE_CLIENT_SECRET,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cashfree API Error: ${errorText}`);
    }

    const cashfreeOrder = await response.json();

    return new Response(JSON.stringify({ order_token: cashfreeOrder.order_token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
                                        
