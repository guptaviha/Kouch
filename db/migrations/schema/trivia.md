# Trivia Content Schema

## Types
- `trivia_question_type` enum: `multiple_choice` | `open_ended` | `multi_part`.

## Tables

### trivia_tags
- `id` (bigserial, primary key)
- `name` (text, unique, stored lowercase via API)
- `description` (text, nullable)
- `user_id` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, auto-updated trigger)

### trivia_questions
- `id` (bigserial, primary key)
- `prompt` (text, required)
- `question_type` (`trivia_question_type`, required)
- `difficulty` (int, default `3`, check between 1-5)
- `clues` (text[], default `{}`)
- `image_url` (text, nullable; overall prompt image)
- `choices` (text[], nullable; required when `question_type = multiple_choice`)
- `correct_choice_index` (int, nullable; required when `question_type = multiple_choice` and within `choices` bounds)
- `correct_answers` (text[], nullable; required when `question_type = open_ended` and must contain at least one entry)
- `multi_parts` (jsonb, nullable; required when `question_type = multi_part`, array length 2-4 of part objects)
	- Part shape: `{ "prompt": text, "correct_answers": text[], "image_url": text | null }`
- `user_id` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, auto-updated trigger)

### trivia_packs
- `id` (bigserial, primary key)
- `name` (text, unique, required)
- `description` (text, nullable)
- `user_id` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, auto-updated trigger)

### trivia_question_tags
- `question_id` (bigint, FK -> `trivia_questions.id`, cascade delete)
- `tag_id` (bigint, FK -> `trivia_tags.id`, cascade delete)
- `user_id` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, auto-updated trigger)
- Primary key: (`question_id`, `tag_id`)

### trivia_pack_questions
- `pack_id` (bigint, FK -> `trivia_packs.id`, cascade delete)
- `question_id` (bigint, FK -> `trivia_questions.id`, cascade delete)
- `position` (int, default `0`, unique per pack)
- `user_id` (text, default `admin`)
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, auto-updated trigger)
- Primary key: (`pack_id`, `question_id`)
- Unique: (`pack_id`, `position`)

## Triggers
`set_updated_at()` keeps `updated_at` current on updates for all tables above.
