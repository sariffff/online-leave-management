-- Snapshot ของ schema ฐานข้อมูล (จาก Supabase) ใช้อ้างอิงเท่านั้น ไม่ได้ออกแบบให้รันตรง ๆ
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  user_id uuid NOT NULL,
  prename character varying,
  name character varying,
  surname character varying,
  is_active boolean DEFAULT true,
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.roletype (
  role_name character varying,
  role_type_id integer NOT NULL DEFAULT nextval('roletype_role_type_id_seq'::regclass),
  CONSTRAINT roletype_pkey PRIMARY KEY (role_type_id)
);
CREATE TABLE public.userrole (
  user_id uuid,
  role_type_id integer,
  user_role_id integer NOT NULL DEFAULT nextval('userrole_user_role_id_seq'::regclass),
  CONSTRAINT userrole_pkey PRIMARY KEY (user_role_id),
  CONSTRAINT userrole_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT userrole_role_type_id_fkey FOREIGN KEY (role_type_id) REFERENCES public.roletype(role_type_id)
);
CREATE TABLE public.leavetype (
  leave_type_name character varying,
  max_leave_day integer,
  leave_type_id integer NOT NULL DEFAULT nextval('leavetype_leave_type_id_seq'::regclass),
  carry_over_max integer,
  note text,
  CONSTRAINT leavetype_pkey PRIMARY KEY (leave_type_id)
);
CREATE TABLE public.userleavequota (
  total_used numeric,
  total_remaining numeric,
  user_id uuid,
  leave_type_id integer,
  user_leave_quota_id integer NOT NULL DEFAULT nextval('userleavequota_user_leave_quota_id_seq'::regclass),
  reserved numeric,
  year integer,
  CONSTRAINT userleavequota_pkey PRIMARY KEY (user_leave_quota_id),
  CONSTRAINT userleavequota_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT userleavequota_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leavetype(leave_type_id)
);
CREATE TABLE public.subjectgroup (
  subject_group_name character varying,
  subject_group_id integer NOT NULL DEFAULT nextval('subjectgroup_subject_group_id_seq'::regclass),
  CONSTRAINT subjectgroup_pkey PRIMARY KEY (subject_group_id)
);
CREATE TABLE public.level (
  level_name character varying,
  level_id integer NOT NULL DEFAULT nextval('level_level_id_seq'::regclass),
  CONSTRAINT level_pkey PRIMARY KEY (level_id)
);
CREATE TABLE public.subject (
  subject_code character varying,
  subject_name character varying,
  subject_level_id integer,
  subject_group_id integer,
  subject_id integer NOT NULL DEFAULT nextval('subject_subject_id_seq'::regclass),
  CONSTRAINT subject_pkey PRIMARY KEY (subject_id),
  CONSTRAINT subject_subject_level_id_fkey FOREIGN KEY (subject_level_id) REFERENCES public.level(level_id),
  CONSTRAINT subject_subject_group_id_fkey FOREIGN KEY (subject_group_id) REFERENCES public.subjectgroup(subject_group_id)
);
CREATE TABLE public.classroom (
  classroom_name character varying,
  classroom_level integer,
  classroom_id integer NOT NULL DEFAULT nextval('classroom_classroom_id_seq'::regclass),
  CONSTRAINT classroom_pkey PRIMARY KEY (classroom_id),
  CONSTRAINT classroom_classroom_level_fkey FOREIGN KEY (classroom_level) REFERENCES public.level(level_id)
);
CREATE TABLE public.substituteuserteaching (
  date_time timestamp without time zone,
  substitute_user_id uuid,
  teaching_schedule_id integer,
  substitute_teaching_id integer NOT NULL DEFAULT nextval('substituteuserteaching_substitute_teaching_id_seq'::regclass),
  CONSTRAINT substituteuserteaching_pkey PRIMARY KEY (substitute_teaching_id),
  CONSTRAINT substituteuserteaching_substitute_user_id_fkey FOREIGN KEY (substitute_user_id) REFERENCES public.users(user_id),
  CONSTRAINT substituteuserteaching_teaching_schedule_id_fkey FOREIGN KEY (teaching_schedule_id) REFERENCES public.teachingschedule(teaching_schedule_id)
);
CREATE TABLE public.holiday (
  holiday_name character varying,
  holiday_date date,
  holiday_id integer NOT NULL DEFAULT nextval('holiday_holiday_id_seq'::regclass),
  CONSTRAINT holiday_pkey PRIMARY KEY (holiday_id)
);
CREATE TABLE public.leaverequest (
  reviewed_at timestamp with time zone,
  approved_at timestamp with time zone,
  year integer,
  date_start date,
  timestamp timestamp with time zone DEFAULT (now() AT TIME ZONE 'Asia/Bangkok'::text),
  date_end date,
  date_start_type character varying,
  date_end_type character varying,
  total_day numeric,
  reason text,
  file character varying,
  reviewed_by uuid,
  approved_by uuid,
  leave_type_id integer,
  user_id uuid,
  leave_request_id integer NOT NULL DEFAULT nextval('leaverequest_leave_request_id_seq'::regclass),
  status character varying NOT NULL DEFAULT 'pending'::character varying,
  comment character varying,
  CONSTRAINT leaverequest_pkey PRIMARY KEY (leave_request_id),
  CONSTRAINT leaverequest_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(user_id),
  CONSTRAINT leaverequest_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(user_id),
  CONSTRAINT leaverequest_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leavetype(leave_type_id),
  CONSTRAINT leaverequest_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.teacher (
  user_id uuid,
  subject_group_id integer,
  teacher_id integer NOT NULL DEFAULT nextval('teacher_teacher_id_seq'::regclass),
  CONSTRAINT teacher_pkey PRIMARY KEY (teacher_id),
  CONSTRAINT teacher_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT teacher_subject_group_id_fkey FOREIGN KEY (subject_group_id) REFERENCES public.subjectgroup(subject_group_id)
);
CREATE TABLE public.teachingschedule (
  semester text,
  day_of_week character varying,
  period_number integer,
  start_time time without time zone,
  end_time time without time zone,
  subject_id integer,
  classroom_id integer,
  teacher_id integer,
  teaching_schedule_id integer NOT NULL DEFAULT nextval('teachingschedule_teaching_schedule_id_seq'::regclass),
  CONSTRAINT teachingschedule_pkey PRIMARY KEY (teaching_schedule_id),
  CONSTRAINT teachingschedule_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subject(subject_id),
  CONSTRAINT teachingschedule_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classroom(classroom_id),
  CONSTRAINT teachingschedule_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teacher(teacher_id)
);
