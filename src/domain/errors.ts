export type GameErrorCode =
  | 'INVALID_AMOUNT'
  | 'INSUFFICIENT_FUNDS'
  | 'UNKNOWN_PLAYER'
  | 'PLAYER_BANKRUPT'
  | 'NOT_A_PROPERTY'
  | 'ALREADY_OWNED'
  | 'NOT_OWNER'
  | 'RULE_VIOLATION'
  | 'BANK_SHORTAGE'
  | 'DUPLICATE_ACTION'
  | 'GAME_ENDED'
  | 'INVALID_STATE';

export class GameError extends Error {
  readonly code: GameErrorCode;
  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'GameError';
  }
}

export const fail = (code: GameErrorCode, message: string): never => {
  throw new GameError(code, message);
};
