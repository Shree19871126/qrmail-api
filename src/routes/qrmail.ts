import { Router } from "express";
import multer from "multer";
import { supabase } from "../lib/supabase";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const ATTACHMENT_BUCKET = "qrmail-event-attachments";

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

router.post("/events", async (req, res) => {
  try {
    const {
      qr_code_id,
      scan_event_id,
      event_type,
      title,
      description,
      status,
      amount,
      currency,
      notes,
      tags,
      intent,
      lifecycle_status,
      outcome,
      next_action,
      next_action_at,
      metadata,
    } = req.body;

    if (!qr_code_id) {
      return res.status(400).json({ error: "qr_code_id required" });
    }

    if (!event_type) {
      return res.status(400).json({ error: "event_type required" });
    }

    const insertPayload: Record<string, any> = {
      qr_code_id,
      scan_event_id: scan_event_id || null,
      event_type,
      title: title || `${event_type} event`,
      description: description || null,
      status: status || "recorded",
      amount: amount === "" || amount === undefined ? null : Number(amount),
      currency: currency || null,
      notes: notes || null,
      tags: Array.isArray(tags) ? tags : [],
      intent: intent || null,
      lifecycle_status: lifecycle_status || "open",
      outcome: outcome || null,
      next_action: next_action || null,
      next_action_at: next_action_at || null,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("qrmail_events")
      .insert(insertPayload)
      .select(`
        *,
        qrmail_qr_codes (*),
        qrmail_scan_events (*)
      `)
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error: any) {
    console.error("Create QR Mail event error:", {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    res.status(500).json({
      error: "Failed to create QR Mail event",
      details: error?.message,
    });
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
      return res.status(400).json({ error: "No valid fields supplied." });
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
    res.status(500).json({ error: "Failed to update QR Mail event" });
  }
});

router.get("/events/:eventId/attachments", async (req, res) => {
  try {
    const { eventId } = req.params;

    const { data, error } = await supabase
      .from("qrmail_event_attachments")
      .select("*")
      .eq("event_id", eventId)
      .order("uploaded_at", { ascending: false });

    if (error) throw error;

    res.json({ attachments: data || [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch attachments" });
  }
});

router.post(
  "/events/:eventId/attachments",
  upload.single("file"),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${eventId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("qrmail_event_attachments")
        .insert({
          event_id: eventId,
          file_name: file.originalname,
          file_type: file.mimetype,
          file_size: file.size,
          storage_path: storagePath,
        })
        .select("*")
        .single();

      if (error) throw error;

      res.status(201).json({ attachment: data });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to upload attachment" });
    }
  }
);

router.delete("/attachments/:attachmentId", async (req, res) => {
  try {
    const { attachmentId } = req.params;

    const { data: attachment, error: fetchError } = await supabase
      .from("qrmail_event_attachments")
      .select("*")
      .eq("id", attachmentId)
      .single();

    if (fetchError) throw fetchError;

    const { error: storageError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .remove([attachment.storage_path]);

    if (storageError) throw storageError;

    const { error: deleteError } = await supabase
      .from("qrmail_event_attachments")
      .delete()
      .eq("id", attachmentId);

    if (deleteError) throw deleteError;

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

/* ---------------------------------------
   Collections
--------------------------------------- */

router.get("/collections", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("qrmail_collections")
      .select("*")
      .order("name");

    if (error) throw error;

    res.json({
      collections: data || [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to load collections",
    });
  }
});

router.post("/collections", async (req, res) => {
  try {
    const { name, color, icon, user_id } = req.body;

    const cleanName = name?.trim();

    if (!cleanName) {
      return res.status(400).json({
        error: "Collection name required",
      });
    }

    if (!user_id) {
      return res.status(400).json({
        error: "user_id required",
      });
    }

    const { data: existing, error: existingError } = await supabase
      .from("qrmail_collections")
      .select("*")
      .eq("user_id", user_id)
      .ilike("name", cleanName)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return res.json({
        collection: existing,
      });
    }

    const { data, error } = await supabase
      .from("qrmail_collections")
      .insert({
        user_id,
        name: cleanName,
        description: null,
        color: color || null,
        icon: icon || "📁",
      })
      .select("*")
      .single();

    if (error) throw error;

    res.status(201).json({
      collection: data,
    });
  } catch (err: any) {
    console.error("Create collection error:", {
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
      code: err?.code,
    });

    res.status(500).json({
      error: "Failed to create collection",
      details: err?.message,
    });
  }
});

router.get("/events/:eventId/collections", async (req, res) => {
  try {
    const { eventId } = req.params;

    const { data, error } = await supabase
      .from("qrmail_event_collections")
      .select(`
        collection_id,
        qrmail_collections (
          id,
          name,
          color,
          icon
        )
      `)
      .eq("event_id", eventId);

    if (error) throw error;

    res.json({
      collections:
        data?.map((row: any) => row.qrmail_collections).filter(Boolean) || [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to load event collections",
    });
  }
});

router.post("/events/:eventId/collections", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { collection_id } = req.body;

    const { error } = await supabase
      .from("qrmail_event_collections")
      .upsert({
        event_id: eventId,
        collection_id,
      });

    if (error) throw error;

    res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to add collection",
    });
  }
});

router.delete(
  "/events/:eventId/collections/:collectionId",
  async (req, res) => {
    try {
      const { eventId, collectionId } = req.params;

      const { error } = await supabase
        .from("qrmail_event_collections")
        .delete()
        .eq("event_id", eventId)
        .eq("collection_id", collectionId);

      if (error) throw error;

      res.json({
        success: true,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Failed to remove collection",
      });
    }
  }
);

export default router;
