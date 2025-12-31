import { NextRequest, NextResponse } from 'next/server';

import { getSqlClient, withTransaction } from '@/lib/neon';
import type {
  CreateQuestionPayload,
  QuestionType,
  TriviaQuestion,
  TriviaMultiPart,
  TriviaTag,
} from '@/types/trivia';

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

function validatePayload(payload: CreateQuestionPayload): { error: string } | { prompt: string } {
  const prompt = (payload.prompt ?? '').trim();
  if (prompt.length < 5) {
    return { error: 'Question prompt must be at least 5 characters long' };
  }

  if (
    payload.question_type !== 'multiple_choice' &&
    payload.question_type !== 'open_ended' &&
    payload.question_type !== 'multi_part'
  ) {
    return { error: 'Invalid question_type. Use multiple_choice, open_ended, or multi_part' };
  }

  return { prompt };
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
      multi_parts:
        typeof row.multi_parts === 'string'
          ? (JSON.parse(row.multi_parts) as TriviaMultiPart[])
          : (row.multi_parts as TriviaMultiPart[] | null),
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
    const validation = validatePayload(payload);
    if ('error' in validation) {
      return badRequest(validation.error);
    }

    const difficulty = Number.isInteger(payload.difficulty)
      ? Math.min(5, Math.max(1, Number(payload.difficulty)))
      : 3;

    const clues = cleanStrings(payload.clues);
    const tagNames = cleanStrings(payload.tag_names, true);
    const questionType: QuestionType = payload.question_type;

    const baseImageRequested = Boolean(payload.image_url);
    const imageUrl = baseImageRequested ? PLACEHOLDER_IMAGE_URL : null;

    let choices: string[] | null = null;
    let correctChoiceIndex: number | null = null;
    let correctAnswers: string[] | null = null;
    let multiParts: TriviaMultiPart[] | null = null;

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
    } else if (questionType === 'open_ended') {
      correctAnswers = cleanStrings(payload.correct_answers ?? [], true);
      if (correctAnswers.length === 0) {
        return badRequest('Open ended questions need at least one accepted answer');
      }
    } else {
      const parts = Array.isArray(payload.multi_parts) ? payload.multi_parts : [];
      if (parts.length < 2 || parts.length > 4) {
        return badRequest('Multi-part questions need between 2 and 4 parts');
      }

      const builtParts: TriviaMultiPart[] = [];
      for (const [index, part] of parts.entries()) {
        const prompt = (part.prompt ?? '').trim();
        if (prompt.length < 3) {
          return badRequest(`Part ${index + 1} prompt must be at least 3 characters`);
        }

        const answers = cleanStrings(part.correct_answers, true);
        if (answers.length === 0) {
          return badRequest(`Part ${index + 1} needs at least one accepted answer`);
        }

        const partImageUrl = part.image_url ? PLACEHOLDER_IMAGE_URL : null;

        builtParts.push({
          prompt,
          correct_answers: answers,
          image_url: partImageUrl,
        });
      }

      multiParts = builtParts;
    }

    const question = await withTransaction(async (tx) => {
      const [created] = (await tx`
        INSERT INTO trivia_questions (
          prompt,
          question_type,
          difficulty,
          clues,
          image_url,
          choices,
          correct_choice_index,
          correct_answers,
          multi_parts
        ) VALUES (
          ${validation.prompt},
          ${questionType},
          ${difficulty},
          ${clues},
          ${imageUrl},
          ${choices},
          ${correctChoiceIndex},
          ${correctAnswers},
          ${multiParts ? JSON.stringify(multiParts) : null}
        )
        RETURNING id, prompt, question_type, difficulty, clues, image_url, choices, correct_choice_index, correct_answers, multi_parts, user_id, created_at, updated_at;
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
