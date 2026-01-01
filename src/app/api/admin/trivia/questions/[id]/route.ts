import { NextRequest, NextResponse } from 'next/server';

import { getSqlClient, withTransaction } from '@/lib/neon';
import type {
  CreateQuestionPayload,
  QuestionType,
  TriviaQuestion,
  TriviaTag,
} from '@/types/trivia';

const sql = getSqlClient();
const PLACEHOLDER_IMAGE_URL = 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

function cleanStrings(values?: string[], toLower = false): string[] {
  const cleaned = (values ?? [])
    .map((value) => (value ?? '').trim())
    .filter((value) => value.length > 0)
    .map((value) => (toLower ? value.toLowerCase() : value));

  return Array.from(new Set(cleaned));
}

function validateQuestionType(type: string): type is QuestionType {
  return type === 'multiple_choice' || type === 'open_ended' || type === 'multi_part';
}

async function upsertTags(
  tx: ReturnType<typeof getSqlClient>,
  tagNames: string[],
): Promise<TriviaTag[]> {
  const tags: TriviaTag[] = [];
  for (const tagName of tagNames) {
    const [tag] = (await tx`
      INSERT INTO trivia_tags (name)
      VALUES (${tagName})
      ON CONFLICT (name) DO UPDATE SET updated_at = now()
      RETURNING id, name, description, user_id, created_at, updated_at;
    `) as unknown as TriviaTag[];

    tags.push(tag);
  }
  return tags;
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return badRequest('Invalid question id');
  }

  try {
    const rows = (await sql`
      SELECT
        q.id,
        q.prompt,
        q.question_type,
        q.prompts,
        q.prompt_images,
        q.difficulty,
        q.clues,
        q.image_url,
        q.choices,
        q.correct_choice_index,
        q.correct_answers,
        q.multi_parts,
        q.user_id,
        q.created_at,
        q.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'name', t.name,
              'description', t.description,
              'user_id', t.user_id,
              'created_at', t.created_at,
              'updated_at', t.updated_at
            )
            ORDER BY t.name
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS tags
      FROM trivia_questions q
      LEFT JOIN trivia_question_tags qt ON qt.question_id = q.id
      LEFT JOIN trivia_tags t ON t.id = qt.tag_id
      WHERE q.id = ${id}
      GROUP BY q.id;
    `) as unknown as Array<TriviaQuestion & { tags: TriviaTag[] }>;

    if (!rows || rows.length === 0) {
      return notFound('Question not found');
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Failed to fetch question', error);
    return NextResponse.json({ error: 'Failed to fetch question' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return badRequest('Invalid question id');
  }

  try {
    const payload = (await request.json()) as CreateQuestionPayload;

    if (!validateQuestionType(payload.question_type)) {
      return badRequest('Invalid question_type. Use multiple_choice, open_ended, or multi_part');
    }

    const promptsRaw = Array.isArray(payload.prompts) ? payload.prompts : [];
    const promptImagesRaw = Array.isArray(payload.prompt_images) ? payload.prompt_images : [];

    const prompts = promptsRaw.map((p) => (p ?? '').trim()).filter((p) => p.length > 0);
    if (prompts.length === 0) {
      return badRequest('At least one prompt is required');
    }

    const promptImages = prompts.map((_, index) => {
      const img = promptImagesRaw[index];
      return img ? PLACEHOLDER_IMAGE_URL : null;
    });

    if (payload.question_type === 'multi_part' && (prompts.length < 2 || prompts.length > 4)) {
      return badRequest('Multi-part questions need between 2 and 4 prompts');
    }

    if (payload.question_type !== 'multi_part' && prompts.length !== 1) {
      return badRequest('This question type requires exactly one prompt');
    }

    const difficulty = Number.isInteger(payload.difficulty)
      ? Math.min(5, Math.max(1, Number(payload.difficulty)))
      : 3;

    const clues = cleanStrings(payload.clues);
    const tagNames = cleanStrings(payload.tag_names, true);
    const questionType: QuestionType = payload.question_type;

    const basePrompt = prompts[0];
    const imageUrl = promptImages[0] ?? null;

    let choices: string[] | null = null;
    let correctChoiceIndex: number | null = null;
    let correctAnswers: string[] | null = null;

    if (questionType === 'multiple_choice') {
      choices = cleanStrings(payload.choices ?? []);
      if (choices.length < 2) {
        return badRequest('Multiple choice questions need at least two options');
      }
      const suppliedIndex = payload.correct_choice_index ?? 0;
      const indexIsValid = Number.isInteger(suppliedIndex) && suppliedIndex >= 0 && suppliedIndex < choices.length;
      if (!indexIsValid) {
        return badRequest('correct_choice_index must point to one of the provided options');
      }
      correctChoiceIndex = suppliedIndex;
    } else {
      correctAnswers = cleanStrings(payload.correct_answers ?? [], true);
      if (correctAnswers.length === 0) {
        return badRequest('Open ended and multi-part questions need at least one accepted answer');
      }
    }

    const question = await withTransaction(async (tx) => {
      const [updated] = (await tx`
        UPDATE trivia_questions
        SET 
          prompt = ${basePrompt},
          prompts = ${prompts},
          prompt_images = ${promptImages},
          question_type = ${questionType},
          difficulty = ${difficulty},
          clues = ${clues},
          image_url = ${imageUrl},
          choices = ${choices},
          correct_choice_index = ${correctChoiceIndex},
          correct_answers = ${correctAnswers},
          updated_at = now()
        WHERE id = ${id}
        RETURNING id, prompt, prompts, prompt_images, question_type, difficulty, clues, image_url, choices, correct_choice_index, correct_answers, multi_parts, user_id, created_at, updated_at;
      `) as unknown as TriviaQuestion[];

      if (!updated) {
        throw notFound('Question not found');
      }

      // Remove existing tags
      await tx`DELETE FROM trivia_question_tags WHERE question_id = ${id};`;

      // Add new tags
      const tags = await upsertTags(tx, tagNames);

      for (const tag of tags) {
        await tx`
          INSERT INTO trivia_question_tags (question_id, tag_id)
          VALUES (${id}, ${tag.id})
          ON CONFLICT (question_id, tag_id) DO NOTHING;
        `;
      }

      return { ...updated, tags } satisfies TriviaQuestion & { tags: TriviaTag[] };
    });

    return NextResponse.json(question);
  } catch (error) {
    console.error('Failed to update question', error);
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
  }
}
