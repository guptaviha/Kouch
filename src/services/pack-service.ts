import type { GamePackDetail, GameType, TriviaGameQuestion } from '../types/game-types.ts';
import { RebusService } from './rebus-service.ts';
import { TriviaService } from './trivia-service.ts';

export class PackService {
  static async getAllPacks(): Promise<GamePackDetail[]> {
    // Fetch trivia packs from database
    const triviaPacks = await TriviaService.getAllPacks();

    // Fetch rebus packs from third-party API
    let rebusPacks: GamePackDetail[] = [];
    try {
      rebusPacks = await RebusService.getAllPacks();
    } catch (error) {
      console.error('Error fetching rebus packs:', error);
      // Continue with trivia packs only if rebus fails
    }

    // Combine and return all packs
    return [...triviaPacks, ...rebusPacks];
  }

  static async getPackById(id: number, gameType?: GameType): Promise<GamePackDetail | null> {
    // If gameType is specified, use the appropriate service
    if (gameType === 'rebus') {
      return await RebusService.getPackById(id);
    }

    if (gameType === 'trivia') {
      return await TriviaService.getPackById(id);
    }

    // If gameType is not specified, try trivia first, then rebus
    const triviaPack = await TriviaService.getPackById(id);
    if (triviaPack) return triviaPack;

    const rebusPack = await RebusService.getPackById(id);
    return rebusPack;
  }

  static async getQuestionsForPack(id: number, gameType?: GameType): Promise<TriviaGameQuestion[]> {
    // If gameType is specified, use the appropriate service
    if (gameType === 'rebus') {
      return await RebusService.getQuestionsForPack(id);
    }

    if (gameType === 'trivia') {
      return await TriviaService.getQuestionsForPack(id);
    }

    // If gameType is not specified, determine it by fetching the pack
    const pack = await this.getPackById(id);
    if (!pack) {
      throw new Error(`Pack with id ${id} not found`);
    }

    return await this.getQuestionsForPack(id, pack.gameType);
  }
}
