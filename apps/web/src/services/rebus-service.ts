import {
  createGameContentService,
  getGameContentConfigFromEnv,
  type RebusPack,
  type TriviaGameQuestion,
} from '@kouch/game-content';

const gameContentService = createGameContentService(getGameContentConfigFromEnv(process.env));

export class RebusService {
  static async getAllPacks(): Promise<RebusPack[]> {
    const packs = await gameContentService.getAllPacks();
    return packs.filter((pack): pack is RebusPack => pack.gameType === 'rebus');
  }

  static async getPackById(id: number): Promise<RebusPack | null> {
    const pack = await gameContentService.getPackById(id, 'rebus');
    return pack && pack.gameType === 'rebus' ? pack : null;
  }

  static async getQuestionsForPack(id: number): Promise<TriviaGameQuestion[]> {
    return gameContentService.getQuestionsForPack(id, 'rebus');
  }
}
