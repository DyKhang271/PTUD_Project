-- =========================================================
-- Student management relational schema (PostgreSQL)
-- Source JSON sections:
-- student, curriculum_summary, curriculum_courses,
-- transcript_terms, transcript_courses, midterm_scores
-- =========================================================

DROP TABLE IF EXISTS app_runtime_state;
DROP TABLE IF EXISTS student_raw_records;

-- Drop in dependency order
DROP TABLE IF EXISTS transcript_course_midterm_scores;
DROP TABLE IF EXISTS transcript_courses;
DROP TABLE IF EXISTS transcript_terms;
DROP TABLE IF EXISTS curriculum_courses;
DROP TABLE IF EXISTS curriculum_summaries;
DROP TABLE IF EXISTS students;

CREATE TABLE student_raw_records (
    student_id TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_raw_records_payload
    ON student_raw_records USING GIN (payload);

CREATE TABLE app_runtime_state (
    state_key TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1) students
CREATE TABLE students (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    schema_version TEXT NOT NULL,
    student_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    program_name TEXT NOT NULL,
    faculty TEXT NOT NULL,
    education_level TEXT NOT NULL,
    print_date DATE NOT NULL
);

-- 2) curriculum_summaries (1-1 with students)
CREATE TABLE curriculum_summaries (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id INTEGER NOT NULL UNIQUE,
    total_required_credits INTEGER NOT NULL,
    mandatory_credits INTEGER NOT NULL,
    elective_credits INTEGER NOT NULL,
    note TEXT NOT NULL,
    CONSTRAINT fk_curriculum_summaries_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- 3) curriculum_courses (1-N from students)
CREATE TABLE curriculum_courses (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id INTEGER NOT NULL,
    semester INTEGER NOT NULL,
    course_code TEXT NOT NULL,
    course_name TEXT NOT NULL,
    credits INTEGER NOT NULL,
    lt_hours INTEGER NOT NULL,
    th_hours INTEGER NOT NULL,
    elective_group INTEGER NOT NULL,
    group_required_credits INTEGER NULL,
    prerequisites_raw TEXT NULL,
    passed_in_curriculum BOOLEAN NOT NULL,
    course_type TEXT NOT NULL,
    is_excluded_from_gpa BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_curriculum_courses_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT ck_curriculum_course_type
        CHECK (course_type IN ('mandatory', 'elective'))
);

CREATE INDEX idx_curriculum_courses_student_semester
    ON curriculum_courses(student_id, semester);

CREATE INDEX idx_curriculum_courses_student_course_code
    ON curriculum_courses(student_id, course_code);

-- 4) transcript_terms (1-N from students)
CREATE TABLE transcript_terms (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id INTEGER NOT NULL,
    term TEXT NOT NULL,
    gpa10_term NUMERIC(4,2) NULL,
    gpa4_term NUMERIC(4,2) NULL,
    gpa10_cumulative NUMERIC(4,2) NOT NULL,
    gpa4_cumulative NUMERIC(4,2) NOT NULL,
    registered_credits INTEGER NOT NULL,
    earned_credits INTEGER NOT NULL,
    passed_credits INTEGER NOT NULL,
    outstanding_failed_credits INTEGER NOT NULL,
    academic_standing_cumulative TEXT NOT NULL,
    academic_standing_term TEXT NULL,
    CONSTRAINT fk_transcript_terms_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT uq_transcript_terms_student_term
        UNIQUE (student_id, term)
);

-- 5) transcript_courses (1-N from transcript_terms)
CREATE TABLE transcript_courses (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id INTEGER NOT NULL,
    transcript_term_id INTEGER NOT NULL,
    term TEXT NOT NULL,
    class_section_code TEXT NOT NULL,
    course_name TEXT NOT NULL,
    credits INTEGER NOT NULL,
    final_score NUMERIC(4,2) NULL,
    gpa4 NUMERIC(4,2) NULL,
    letter TEXT NULL,
    classification TEXT NULL,
    status TEXT NULL,
    CONSTRAINT fk_transcript_courses_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_transcript_courses_term
        FOREIGN KEY (transcript_term_id) REFERENCES transcript_terms(id) ON DELETE CASCADE
);

CREATE INDEX idx_transcript_courses_student_term
    ON transcript_courses(student_id, transcript_term_id);

CREATE INDEX idx_transcript_courses_student_class_section
    ON transcript_courses(student_id, class_section_code);

-- 6) transcript_course_midterm_scores (array split to child table)
CREATE TABLE transcript_course_midterm_scores (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transcript_course_id INTEGER NOT NULL,
    score_order INTEGER NOT NULL,
    score NUMERIC(4,2) NOT NULL,
    CONSTRAINT fk_midterm_scores_course
        FOREIGN KEY (transcript_course_id) REFERENCES transcript_courses(id) ON DELETE CASCADE,
    CONSTRAINT uq_midterm_scores_course_order
        UNIQUE (transcript_course_id, score_order)
);

CREATE INDEX idx_midterm_scores_course
    ON transcript_course_midterm_scores(transcript_course_id);

