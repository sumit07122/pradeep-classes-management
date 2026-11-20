import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch institute WhatsApp settings
    const { data: settings, error: settingsError } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: "WhatsApp settings not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch pending messages
    const { data: queueItems, error: queueError } = await supabase
      .from("whatsapp_message_queue")
      .select("*")
      .eq("status", "pending")
      .lt("attempts", 3)
      .limit(20);

    if (queueError) {
      return new Response(JSON.stringify({ error: queueError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ message: "No pending messages in queue", processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const item of queueItems) {
      // If WhatsApp is disabled or in test mode without token
      const isTestMode = !settings.is_enabled || !settings.api_token || !settings.phone_number_id;

      if (isTestMode) {
        // Safe sandbox simulation
        await supabase
          .from("whatsapp_message_queue")
          .update({
            status: "simulated_test",
            provider_response_id: `test_wamid_${Date.now()}_${item.id.slice(0, 8)}`,
            sent_at: new Date().toISOString(),
            attempts: item.attempts + 1,
            error_message: settings.is_enabled ? "Dispatched in sandbox test mode" : "Integration disabled in settings (test mode)",
          })
          .eq("id", item.id);

        results.push({ id: item.id, status: "simulated_test", recipient: item.recipient_phone });
        continue;
      }

      // Live Meta WhatsApp Cloud API call
      try {
        const metaUrl = `https://graph.facebook.com/v21.0/${settings.phone_number_id}/messages`;
        const metaPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: item.recipient_phone,
          type: "text",
          text: {
            preview_url: false,
            body: item.message_body,
          },
        };

        const res = await fetch(metaUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${settings.api_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metaPayload),
        });

        const metaData = await res.json();

        if (res.ok && metaData.messages?.[0]?.id) {
          const wamid = metaData.messages[0].id;
          await supabase
            .from("whatsapp_message_queue")
            .update({
              status: "sent",
              provider_response_id: wamid,
              sent_at: new Date().toISOString(),
              attempts: item.attempts + 1,
              error_message: null,
            })
            .eq("id", item.id);

          results.push({ id: item.id, status: "sent", wamid });
        } else {
          const errMsg = metaData.error?.message || "Meta API request failed";
          const newAttempts = item.attempts + 1;
          const newStatus = newAttempts >= (item.max_attempts || 3) ? "failed" : "pending";

          await supabase
            .from("whatsapp_message_queue")
            .update({
              status: newStatus,
              attempts: newAttempts,
              error_message: errMsg,
            })
            .eq("id", item.id);

          results.push({ id: item.id, status: newStatus, error: errMsg });
        }
      } catch (err: any) {
        const newAttempts = item.attempts + 1;
        await supabase
          .from("whatsapp_message_queue")
          .update({
            status: newAttempts >= 3 ? "failed" : "pending",
            attempts: newAttempts,
            error_message: err.message || "Network error",
          })
          .eq("id", item.id);

        results.push({ id: item.id, status: "error", error: err.message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
