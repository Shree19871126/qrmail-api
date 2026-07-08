import { Router } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

router.get("/events", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("qrmail_events")
      .select(`
        *,
        qrmail_qr_codes (*),
        qrmail_scan_events (*)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch QR Mail events" });
  }
});

router.get("/events/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    const { data, error } = await supabase
      .from("qrmail_events")
      .select(`
        *,
        qrmail_qr_codes (*),
        qrmail_scan_events (*)
      `)
      .eq("id", eventId)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch QR Mail event" });
  }
});

router.patch("/events/:eventId/lifecycle", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { lifecycle_status, outcome, next_action, next_action_at } = req.body;

    const { data, error } = await supabase
      .from("qrmail_events")
      .update({
        lifecycle_status,
        outcome,
        next_action,
        next_action_at,
      })
      .eq("id", eventId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update lifecycle" });
  }
});

export default router;