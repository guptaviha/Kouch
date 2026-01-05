import type { RebusPack, TriviaGameQuestion } from '../types/game-types';

const REBUS_API_BASE_URL = 'https://rebus.games/api/admin';
const REBUS_API_KEY = process.env.REBUS_PACKS_API_SECRET_KEY;

export class RebusService {
  private static getHeaders() {
    if (!REBUS_API_KEY) {
      throw new Error('REBUS_PACKS_API_SECRET_KEY environment variable is not set');
    }
    return {
      'x-api-key': REBUS_API_KEY,
    };
  }

  static async getAllPacks(): Promise<RebusPack[]> {
    try {
      const response = await fetch(`${REBUS_API_BASE_URL}/packs`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch rebus packs: ${response.status} ${response.statusText}`);
      }

      const packs = await response.json();
      
      // Map rebus packs to RebusPack format
      return packs.map((pack: any) => ({
        ...pack,
        gameType: 'rebus' as const,
      }));
    } catch (error) {
      console.error('Error fetching rebus packs:', error);
      throw error;
    }
  }

  static async getPackById(id: number): Promise<RebusPack | null> {
    try {
      const response = await fetch(`${REBUS_API_BASE_URL}/packs/${id}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch rebus pack: ${response.status} ${response.statusText}`);
      }

      const pack = await response.json();
      return {
        ...pack,
        gameType: 'rebus' as const,
      };
    } catch (error) {
      console.error(`Error fetching rebus pack ${id}:`, error);
      throw error;
    }
  }

  static async getQuestionsForPack(id: number): Promise<TriviaGameQuestion[]> {
    try {
      const response = await fetch(`${REBUS_API_BASE_URL}/packs/${id}/questions`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch rebus questions: ${response.status} ${response.statusText}`);
      }

      const questions = await response.json();
      
      // Map rebus questions to TriviaGameQuestion format
      // Assuming the response structure is similar to our existing format
      return questions.map((q: any) => ({
        question: q.question || q.prompt,
        answers: q.answers || q.correct_answers || [],
        image: q.image || q.image_url,
        hint: q.hint || (q.clues && q.clues.length > 0 ? q.clues[0] : undefined),
        questionType: q.questionType || q.question_type || 'open_ended',
        prompts: q.prompts,
        promptImages: q.promptImages || q.prompt_images,
      }));
    } catch (error) {
      console.error(`Error fetching rebus questions for pack ${id}:`, error);
      throw error;
    }
  }
}
