import {
  createGameContentService,
  getGameContentConfigFromEnv,
  type GamePackDetail,
  type GameType,
  type TriviaGameQuestion,
} from '@kouch/game-content';

const gameContentService = createGameContentService(getGameContentConfigFromEnv(process.env));

export class PackService {
  static async getAllPacks(): Promise<GamePackDetail[]> {
    return gameContentService.getAllPacks();
  }

  static async getPackById(id: number, gameType?: GameType): Promise<GamePackDetail | null> {
    return gameContentService.getPackById(id, gameType);
  }

  static async getQuestionsForPack(id: number, gameType?: GameType): Promise<TriviaGameQuestion[]> {
    return gameContentService.getQuestionsForPack(id, gameType);
  }
}
