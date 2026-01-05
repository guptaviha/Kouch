import { NextRequest, NextResponse } from 'next/server';

import { getSqlClient, withTransaction } from '@/lib/neon';
import type {
  CreateQuestionPayload,
  QuestionType,
  TriviaQuestion,
  TriviaTag,
} from '@/types/game-types';

const sql = getSqlClient();
// TODO: Replace placeholder URL with uploaded S3 object URL once upload flow is wired.
const PLACEHOLDER_IMAGE_URL = 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

    let rows: any[];

    if (q && q.length > 0) {
      rows = (await sql`
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
        WHERE q.prompt ILIKE ${'%' + q + '%'}
        GROUP BY q.id
        ORDER BY q.updated_at DESC
        LIMIT ${limit};
      `) as unknown as any[];
    } else {
      rows = (await sql`
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
        GROUP BY q.id
        ORDER BY q.updated_at DESC
        LIMIT ${limit};
      `) as unknown as any[];
    }

    const questions: TriviaQuestion[] = rows.map((row: any) => ({
      ...row,
      tags: (row.tags as TriviaTag[]) ?? [],
    }));

    return NextResponse.json(questions);
  } catch (error) {
    console.error('Failed to fetch questions', error);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
      const [created] = (await tx`
        INSERT INTO trivia_questions (
          prompt,
          prompts,
          prompt_images,
          question_type,
          difficulty,
          clues,
          image_url,
          choices,
          correct_choice_index,
          correct_answers,
          multi_parts
        ) VALUES (
          ${basePrompt},
          ${prompts},
          ${promptImages},
          ${questionType},
          ${difficulty},
          ${clues},
          ${imageUrl},
          ${choices},
          ${correctChoiceIndex},
          ${correctAnswers},
          ${null}
        )
        RETURNING id, prompt, prompts, prompt_images, question_type, difficulty, clues, image_url, choices, correct_choice_index, correct_answers, multi_parts, user_id, created_at, updated_at;
      `) as unknown as TriviaQuestion[];

      const tags = await upsertTags(tx, tagNames);

      for (const tag of tags) {
        await tx`
          INSERT INTO trivia_question_tags (question_id, tag_id)
          VALUES (${created.id}, ${tag.id})
          ON CONFLICT (question_id, tag_id) DO NOTHING;
        `;
      }

      return { ...created, tags } satisfies TriviaQuestion & { tags: TriviaTag[] };
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    console.error('Failed to create question', error);
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
  }
}
