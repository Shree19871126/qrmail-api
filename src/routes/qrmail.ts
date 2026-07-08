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

/**
 * General QR Mail Event Update
 */
router.patch("/events/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    const allowedFields = [
      "notes",
      "tags",
      "intent",
      "lifecycle_status",
      "outcome",
      "next_action",
      "next_action_at",
    ];

    const updates: Record<string, any> = {};

    for (const field of allowedFields) {
      if (field in req.body) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "No valid fields supplied.",
      });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("qrmail_events")
      .update(updates)
      .eq("id", eventId)
      .select(`
        *,
        qrmail_qr_codes (*),
        qrmail_scan_events (*)
      `)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to update QR Mail event",
    });
  }
});

export default router;