-- Migration 0024: WhatsApp Automation RPC & Secure Queue Insertion
CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_automation_messages(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_ids uuid[];
  v_count integer := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_array_length(p_rows) = 0 THEN
    RETURN jsonb_build_object('success', true, 'count', 0, 'ids', '[]'::jsonb);
  END IF;

  WITH inserted AS (
    INSERT INTO public.whatsapp_message_queue (
      institute_id,
      student_id,
      recipient_phone,
      recipient_name,
      event_type,
      template_name,
      message_body,
      parameters,
      status,
      scheduled_for,
      attempts,
      max_attempts,
      error_message
    )
    SELECT
      COALESCE((r->>'institute_id')::uuid, '11111111-2222-3333-4444-555555555555'::uuid),
      CASE WHEN (r->>'student_id') IS NOT NULL AND (r->>'student_id') ~ '^[0-9a-fA-F-]{36}$'
           THEN (r->>'student_id')::uuid ELSE NULL END,
      r->>'recipient_phone',
      COALESCE(r->>'recipient_name', 'Student / Parent'),
      r->>'event_type',
      COALESCE(r->>'template_name', 'general_notice'),
      r->>'message_body',
      COALESCE(r->'parameters', '{}'::jsonb),
      COALESCE(r->>'status', 'pending'),
      COALESCE((r->>'scheduled_for')::timestamptz, now()),
      COALESCE((r->>'attempts')::integer, 0),
      COALESCE((r->>'max_attempts')::integer, 3),
      r->>'error_message'
    FROM jsonb_array_elements(p_rows) AS r
    RETURNING id
  )
  SELECT array_agg(id), count(*) INTO v_inserted_ids, v_count FROM inserted;

  RETURN jsonb_build_object(
    'success', true,
    'count', v_count,
    'ids', to_jsonb(COALESCE(v_inserted_ids, ARRAY[]::uuid[]))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_whatsapp_automation_messages(jsonb) TO authenticated, anon;
