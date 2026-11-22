// Types du domaine. Aucun import React ici : la logique métier reste testable seule.

export type PlayerId = string;
export type SquareIndex = number;

export type ColorGroup =
  | 'brown'
  | 'lightBlue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'darkBlue';

export interface StreetDef {
  kind: 'street';
  index: SquareIndex;
  name: string;
  group: ColorGroup;
  price: number;
  /** [terrain nu, 1 maison, 2, 3, 4, hôtel] */
  rents: [number, number, number, number, number, number];
  housePrice: number;
  mortgage: number;
}

export interface RailroadDef {
  kind: 'railroad';
  index: SquareIndex;
  name: string;
  price: number;
  mortgage: number;
}

export interface UtilityDef {
  kind: 'utility';
  index: SquareIndex;
  name: string;
  price: number;
  mortgage: number;
}

export type PropertyDef = StreetDef | RailroadDef | UtilityDef;

export type SquareDef =
  | PropertyDef
  | { kind: 'go'; index: SquareIndex; name: string }
  | { kind: 'tax'; index: SquareIndex; name: string; amount: number }
  | { kind: 'chance'; index: SquareIndex; name: string }
  | { kind: 'community'; index: SquareIndex; name: string }
  | { kind: 'jail'; index: SquareIndex; name: string }
  | { kind: 'freeParking'; index: SquareIndex; name: string }
  | { kind: 'goToJail'; index: SquareIndex; name: string };

export interface PropertyState {
  ownerId: PlayerId | null;
  /** 0 à 4 maisons, 5 = hôtel */
  houses: number;
  mortgaged: boolean;
}

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  balance: number;
  position: SquareIndex;
  inJail: boolean;
  jailTurns: number;
  /** Identifiants des cartes « Sortie de prison » détenues. */
  jailCards: string[];
  bankrupt: boolean;
  /** Signature tactile d'une carte bancaire physique associée (module Zapped). */
  cardSignature?: number[];
}

export type DeckKind = 'chance' | 'community';

export type CardEffect =
  | { type: 'money'; amount: number }
  | { type: 'moveTo'; square: SquareIndex; collectGo: boolean }
  | { type: 'moveBy'; steps: number }
  | { type: 'goToJail' }
  | { type: 'jailFree' }
  | { type: 'payEach'; amount: number }
  | { type: 'collectEach'; amount: number }
  | { type: 'repairs'; perHouse: number; perHotel: number }
  | { type: 'nearest'; target: 'railroad' | 'utility' };

export interface CardDef {
  id: string;
  deck: DeckKind;
  text: string;
  effect: CardEffect;
}

export type TxKind =
  | 'credit'
  | 'debit'
  | 'transfer'
  | 'rent'
  | 'tax'
  | 'reward'
  | 'go'
  | 'purchase'
  | 'build'
  | 'sellBuilding'
  | 'mortgage'
  | 'unmortgage'
  | 'trade'
  | 'card'
  | 'jail'
  | 'bankruptcy'
  | 'freeParking';

/** Une écriture du journal. from/to null = la Banque. */
export interface Transaction {
  id: string;
  at: number;
  kind: TxKind;
  from: PlayerId | null;
  to: PlayerId | null;
  amount: number;
  label: string;
}

export interface LogEvent {
  id: string;
  at: number;
  text: string;
}

export interface GameSettings {
  startingCash: number;
  goSalary: number;
  currency: string;
  /** Règle maison : les taxes et amendes alimentent le Parc gratuit. */
  freeParkingJackpot: boolean;
  /** Montant à partir duquel une confirmation est demandée. */
  confirmThreshold: number;
  quickAmounts: number[];
  jailFine: number;
  /**
   * Suivi de la position des pions par l'application. Désactivé quand la partie
   * se joue sur le plateau physique : les cartes de déplacement deviennent de
   * simples consignes, sans calcul de passage par le Départ.
   */
  trackPositions: boolean;
}

export interface TurnState {
  currentIndex: number;
  doublesCount: number;
  hasRolled: boolean;
  lastRoll: [number, number] | null;
  /** Le joueur a fait un double : il rejoue après ce tour. */
  extraTurn: boolean;
  turnNumber: number;
}

export interface DeckState {
  order: string[];
  next: number;
}

export interface PendingCard {
  cardId: string;
  playerId: PlayerId;
}

export interface GameState {
  schemaVersion: 1;
  id: string;
  createdAt: number;
  updatedAt: number;
  status: 'playing' | 'ended';
  winnerId: PlayerId | null;
  settings: GameSettings;
  players: Player[];
  properties: Record<number, PropertyState>;
  bankHouses: number;
  bankHotels: number;
  freeParkingPot: number;
  turn: TurnState;
  cards: CardDef[];
  decks: Record<DeckKind, DeckState>;
  pendingCard: PendingCard | null;
  lastDrawn: { cardId: string; playerId: PlayerId } | null;
  transactions: Transaction[];
  events: LogEvent[];
  /** Module Zapped : tags NFC associés à des joueurs ou propriétés. */
  zapped: { nfcLinks: Record<string, ZappedTarget> };
  /** Identifiants des dernières actions appliquées : protection anti double exécution. */
  processedActionIds: string[];
}

export type ZappedTarget = { kind: 'player'; playerId: PlayerId } | { kind: 'property'; square: SquareIndex };
