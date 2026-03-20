import {
  createGameContentService,
  getGameContentConfigFromEnv,
  type TriviaGameQuestion,
  type TriviaPack,
} from '@kouch/game-content';

const gameContentService = createGameContentService(getGameContentConfigFromEnv(process.env));

export class TriviaService {
  static async getAllPacks(): Promise<TriviaPack[]> {
    const packs = await gameContentService.getAllPacks();
    return packs.filter((pack): pack is TriviaPack => pack.gameType === 'trivia');
  }

  static async getPackById(id: number): Promise<TriviaPack | null> {
    const pack = await gameContentService.getPackById(id, 'trivia');
    return pack && pack.gameType === 'trivia' ? pack : null;
  }

  static async getQuestionsForPack(id: number): Promise<TriviaGameQuestion[]> {
    return gameContentService.getQuestionsForPack(id, 'trivia');
  }
}
