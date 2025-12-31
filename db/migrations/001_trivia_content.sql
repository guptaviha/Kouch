-- Trivia content schema for packs, questions, and tags (final combined version)

CREATE TYPE trivia_question_type AS ENUM ('multiple_choice', 'open_ended', 'multi_part');

CREATE TABLE trivia_tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  user_id TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trivia_questions (
  id BIGSERIAL PRIMARY KEY,
  prompt TEXT NOT NULL,
  question_type trivia_question_type NOT NULL,
  difficulty INT NOT NULL DEFAULT 3,
  clues TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  choices TEXT[],
  correct_choice_index INT,
  correct_answers TEXT[],
  multi_parts JSONB,
  user_id TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trivia_question_difficulty_range CHECK (difficulty BETWEEN 1 AND 5),
  CONSTRAINT trivia_question_choices_required CHECK (
    question_type <> 'multiple_choice'
    OR (
      choices IS NOT NULL
      AND array_length(choices, 1) >= 2
      AND correct_choice_index IS NOT NULL
      AND correct_choice_index >= 0
      AND correct_choice_index < array_length(choices, 1)
    )
  ),
  CONSTRAINT trivia_question_answers_required CHECK (
    question_type <> 'open_ended'
    OR (
      correct_answers IS NOT NULL
      AND array_length(correct_answers, 1) >= 1
    )
  ),
  CONSTRAINT trivia_question_multi_parts_required CHECK (
    question_type <> 'multi_part'
    OR (
      multi_parts IS NOT NULL
      AND jsonb_typeof(multi_parts) = 'array'
      AND jsonb_array_length(multi_parts) BETWEEN 2 AND 4
    )
  ),
  CONSTRAINT trivia_question_type_alignment CHECK (
    (question_type = 'multiple_choice' AND choices IS NOT NULL AND correct_choice_index IS NOT NULL AND multi_parts IS NULL)
    OR (question_type = 'open_ended' AND correct_answers IS NOT NULL AND choices IS NULL AND correct_choice_index IS NULL AND multi_parts IS NULL)
    OR (question_type = 'multi_part' AND multi_parts IS NOT NULL AND choices IS NULL AND correct_choice_index IS NULL AND correct_answers IS NULL)
  )
);

CREATE TABLE trivia_packs (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  user_id TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trivia_question_tags (
  question_id BIGINT NOT NULL REFERENCES trivia_questions(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES trivia_tags(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, tag_id)
);

CREATE TABLE trivia_pack_questions (
  pack_id BIGINT NOT NULL REFERENCES trivia_packs(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES trivia_questions(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  user_id TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pack_id, question_id),
  CONSTRAINT trivia_pack_questions_position_unique UNIQUE (pack_id, position)
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trivia_tags_updated BEFORE UPDATE ON trivia_tags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_trivia_questions_updated BEFORE UPDATE ON trivia_questions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_trivia_packs_updated BEFORE UPDATE ON trivia_packs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_trivia_question_tags_updated BEFORE UPDATE ON trivia_question_tags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_trivia_pack_questions_updated BEFORE UPDATE ON trivia_pack_questions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
