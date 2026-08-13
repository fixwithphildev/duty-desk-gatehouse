-- Drops the tables for Staff Attendance, Off-Duty Attendance, and Access &
-- Keys, which were removed from the Gatehouse app (not practical to log by
-- name for 200 property-wide staff without a proper staff directory —
-- decided to drop these modules rather than build one).
-- Run this once in the Supabase SQL Editor for the gatehouse project, AFTER
-- 0001_init.sql.

drop table if exists attendance_logs;
drop table if exists off_duty_logs;
drop table if exists key_records;

drop type if exists gh_attendance_status;
drop type if exists gh_key_status;
