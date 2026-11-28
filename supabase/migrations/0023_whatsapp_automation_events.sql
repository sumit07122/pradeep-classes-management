-- Migration 0023: WhatsApp Automations Schema & Event Types
-- Extends whatsapp_message_queue with scheduled_for timestamp and expands event_type check constraint

ALTER TABLE public.whatsapp_message_queue 
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.whatsapp_message_queue 
DROP CONSTRAINT IF EXISTS whatsapp_message_queue_event_type_check;

ALTER TABLE public.whatsapp_message_queue 
ADD CONSTRAINT whatsapp_message_queue_event_type_check 
CHECK (event_type IN (
  'attendance_present', 
  'attendance_absent', 
  'attendance_late', 
  'attendance_leave', 
  'fee_receipt', 
  'fee_due_reminder',
  'exam_scorecard',
  'class_diary',
  'birthday_wishes',
  'announcement', 
  'test_message'
));
