import type { ColorGroup, PropertyDef, SquareDef, StreetDef } from './types';

// Plateau classique (édition française). Les valeurs (prix, loyers) sont celles
// des règles standard. Noms de rues = lieux publics parisiens.

const street = (
  index: number,
  name: string,
  group: ColorGroup,
  price: number,
  rents: StreetDef['rents'],
  housePrice: number,
): StreetDef => ({ kind: 'street', index, name, group, price, rents, housePrice, mortgage: price / 2 });

export const BOARD: SquareDef[] = [
  { kind: 'go', index: 0, name: 'Départ' },
  street(1, 'Boulevard de Belleville', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
  { kind: 'community', index: 2, name: 'Caisse de communauté' },
  street(3, 'Rue Lecourbe', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
  { kind: 'tax', index: 4, name: 'Impôts sur le revenu', amount: 200 },
  { kind: 'railroad', index: 5, name: 'Gare Montparnasse', price: 200, mortgage: 100 },
  street(6, 'Rue de Vaugirard', 'lightBlue', 100, [6, 30, 90, 270, 400, 550], 50),
  { kind: 'chance', index: 7, name: 'Chance' },
  street(8, 'Rue de Courcelles', 'lightBlue', 100, [6, 30, 90, 270, 400, 550], 50),
  street(9, 'Avenue de la République', 'lightBlue', 120, [8, 40, 100, 300, 450, 600], 50),
  { kind: 'jail', index: 10, name: 'Prison / Simple visite' },
  street(11, 'Boulevard de la Villette', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  { kind: 'utility', index: 12, name: 'Compagnie d’électricité', price: 150, mortgage: 75 },
  street(13, 'Avenue de Neuilly', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  street(14, 'Rue de Paradis', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
  { kind: 'railroad', index: 15, name: 'Gare de Lyon', price: 200, mortgage: 100 },
  street(16, 'Avenue Mozart', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  { kind: 'community', index: 17, name: 'Caisse de communauté' },
  street(18, 'Boulevard Saint-Michel', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  street(19, 'Place Pigalle', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),
  { kind: 'freeParking', index: 20, name: 'Parc gratuit' },
  street(21, 'Avenue Matignon', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  { kind: 'chance', index: 22, name: 'Chance' },
  street(23, 'Boulevard Malesherbes', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  street(24, 'Avenue Henri-Martin', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
  { kind: 'railroad', index: 25, name: 'Gare du Nord', price: 200, mortgage: 100 },
  street(26, 'Faubourg Saint-Honoré', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  street(27, 'Place de la Bourse', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  { kind: 'utility', index: 28, name: 'Compagnie des eaux', price: 150, mortgage: 75 },
  street(29, 'Rue La Fayette', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { kind: 'goToJail', index: 30, name: 'Allez en prison' },
  street(31, 'Avenue de Breteuil', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  street(32, 'Avenue Foch', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { kind: 'community', index: 33, name: 'Caisse de communauté' },
  street(34, 'Boulevard des Capucines', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  { kind: 'railroad', index: 35, name: 'Gare Saint-Lazare', price: 200, mortgage: 100 },
  { kind: 'chance', index: 36, name: 'Chance' },
  street(37, 'Avenue des Champs-Élysées', 'darkBlue', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { kind: 'tax', index: 38, name: 'Taxe de luxe', amount: 100 },
  street(39, 'Rue de la Paix', 'darkBlue', 400, [50, 200, 600, 1400, 1700, 2000], 200),
];

export const BOARD_SIZE = BOARD.length; // 40
export const JAIL_INDEX = 10;
export const GO_TO_JAIL_INDEX = 30;
export const TOTAL_HOUSES = 32;
export const TOTAL_HOTELS = 12;
export const RAILROAD_RENTS = [25, 50, 100, 200] as const;
export const UTILITY_MULTIPLIERS = [4, 10] as const;

export const PROPERTIES: PropertyDef[] = BOARD.filter(
  (s): s is PropertyDef => s.kind === 'street' || s.kind === 'railroad' || s.kind === 'utility',
);

export function getSquare(index: number): SquareDef {
  const sq = BOARD[index];
  if (!sq) throw new Error(`Case inconnue : ${index}`);
  return sq;
}

export function getProperty(index: number): PropertyDef {
  const sq = getSquare(index);
  if (sq.kind !== 'street' && sq.kind !== 'railroad' && sq.kind !== 'utility') {
    throw new Error(`La case ${sq.name} n’est pas une propriété`);
  }
  return sq;
}

export function isProperty(index: number): boolean {
  const sq = BOARD[index];
  return !!sq && (sq.kind === 'street' || sq.kind === 'railroad' || sq.kind === 'utility');
}

export function groupMembers(group: ColorGroup): StreetDef[] {
  return BOARD.filter((s): s is StreetDef => s.kind === 'street' && s.group === group);
}

export const GROUP_LABELS: Record<ColorGroup, string> = {
  brown: 'Marron',
  lightBlue: 'Bleu ciel',
  pink: 'Rose',
  orange: 'Orange',
  red: 'Rouge',
  yellow: 'Jaune',
  green: 'Vert',
  darkBlue: 'Bleu foncé',
};

export const GROUP_COLORS: Record<ColorGroup, string> = {
  brown: '#8b5a2b',
  lightBlue: '#7cc8f0',
  pink: '#d6458f',
  orange: '#f28c28',
  red: '#e0262f',
  yellow: '#f5d020',
  green: '#1f9d55',
  darkBlue: '#1f4bb8',
};

export const GROUP_ORDER: ColorGroup[] = ['brown', 'lightBlue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkBlue'];
