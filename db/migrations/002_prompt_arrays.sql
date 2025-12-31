-- Add prompt and prompt_image arrays and align constraints for multi-part prompts

ALTER TABLE trivia_questions
  ADD COLUMN IF NOT EXISTS prompts TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS prompt_images TEXT[] NOT NULL DEFAULT '{}';

-- Backfill prompts/images from existing prompt/multi_parts/image_url
WITH expanded AS (
  SELECT
    id,
    COALESCE(
      (SELECT array_agg(trim(mp->>'prompt')) FROM jsonb_array_elements(multi_parts) mp WHERE mp ? 'prompt'),
      NULL
    ) AS mp_prompts,
    COALESCE(
      (SELECT array_agg(NULLIF(mp->>'image_url', '')) FROM jsonb_array_elements(multi_parts) mp),
      NULL
    ) AS mp_images
  FROM trivia_questions
)
UPDATE trivia_questions q
SET
  prompts = COALESCE(exp.mp_prompts, ARRAY[q.prompt]),
  prompt_images = COALESCE(
    exp.mp_images,
    CASE WHEN q.image_url IS NULL THEN '{}'::text[] ELSE ARRAY[q.image_url] END
  ),
  prompt = COALESCE(exp.mp_prompts[1], q.prompt),
  image_url = COALESCE(exp.mp_images[1], q.image_url),
  multi_parts = NULL
FROM expanded exp
WHERE q.id = exp.id;

-- Drop outdated constraints
ALTER TABLE trivia_questions
  DROP CONSTRAINT IF EXISTS trivia_question_choices_required,
  DROP CONSTRAINT IF EXISTS trivia_question_answers_required,
  DROP CONSTRAINT IF EXISTS trivia_question_multi_parts_required,
  DROP CONSTRAINT IF EXISTS trivia_question_type_alignment;

-- New constraints for prompt arrays and question shapes
ALTER TABLE trivia_questions
  ADD CONSTRAINT trivia_question_prompts_required CHECK (array_length(prompts, 1) >= 1),
  ADD CONSTRAINT trivia_question_prompt_images_match CHECK (
    prompt_images IS NULL OR array_length(prompt_images, 1) = array_length(prompts, 1)
  ),
  ADD CONSTRAINT trivia_question_prompt_count CHECK (
    (question_type = 'multi_part' AND array_length(prompts, 1) BETWEEN 2 AND 4)
    OR (question_type <> 'multi_part' AND array_length(prompts, 1) = 1)
  ),
  ADD CONSTRAINT trivia_question_choices_required_v2 CHECK (
    question_type <> 'multiple_choice'
    OR (
      choices IS NOT NULL
      AND array_length(choices, 1) >= 2
      AND correct_choice_index IS NOT NULL
      AND correct_choice_index >= 0
      AND correct_choice_index < array_length(choices, 1)
    )
  ),
  ADD CONSTRAINT trivia_question_answers_required_v2 CHECK (
    question_type NOT IN ('open_ended', 'multi_part')
    OR (
      correct_answers IS NOT NULL
      AND array_length(correct_answers, 1) >= 1
    )
  ),
  ADD CONSTRAINT trivia_question_shape_alignment CHECK (
    (question_type = 'multiple_choice' AND choices IS NOT NULL AND correct_choice_index IS NOT NULL AND correct_answers IS NULL)
    OR (question_type IN ('open_ended', 'multi_part') AND choices IS NULL AND correct_choice_index IS NULL)
  );
