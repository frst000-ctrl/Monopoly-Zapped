import type { CardDef, CardEffect, DeckKind } from './types';

// Cartes aux formulations originales (aucun texte officiel reproduit).
// Les montants sont modifiables en cours de partie depuis l'écran Cartes.

const c = (id: string, deck: DeckKind, text: string, effect: CardEffect): CardDef => ({ id, deck, text, effect });

export const DEFAULT_CARDS: CardDef[] = [
  // --- Chance ---
  c('ch-go', 'chance', 'Le métro express vous dépose directement sur la case Départ.', { type: 'moveTo', square: 0, collectGo: true }),
  c('ch-paix', 'chance', 'Rendez-vous d’affaires Rue de la Paix. Avancez jusqu’à cette case.', { type: 'moveTo', square: 39, collectGo: true }),
  c('ch-henri', 'chance', 'Dîner Avenue Henri-Martin. Avancez jusqu’à cette case.', { type: 'moveTo', square: 24, collectGo: true }),
  c('ch-villette', 'chance', 'Séance de shopping Boulevard de la Villette. Avancez jusqu’à cette case.', { type: 'moveTo', square: 11, collectGo: true }),
  c('ch-lyon', 'chance', 'Vous prenez le train : avancez jusqu’à la Gare de Lyon.', { type: 'moveTo', square: 15, collectGo: true }),
  c('ch-rail', 'chance', 'Correspondance ! Filez à la gare la plus proche. Si elle a un propriétaire, payez-lui le double du loyer.', { type: 'nearest', target: 'railroad' }),
  c('ch-util', 'chance', 'Panne de courant ! Allez à la compagnie la plus proche. Si elle a un propriétaire, lancez les dés et payez 10 fois le résultat.', { type: 'nearest', target: 'utility' }),
  c('ch-bourse', 'chance', 'Votre placement en bourse est rentable.', { type: 'money', amount: 50 }),
  c('ch-jail-free', 'chance', 'Laissez-passer : vous pourrez sortir de prison gratuitement. Conservez cette carte.', { type: 'jailFree' }),
  c('ch-back3', 'chance', 'Demi-tour ! Reculez de trois cases.', { type: 'moveBy', steps: -3 }),
  c('ch-jail', 'chance', 'Contrôle surprise : allez directement en prison, sans passer par le Départ.', { type: 'goToJail' }),
  c('ch-reno', 'chance', 'Ravalement de façade obligatoire : payez pour chaque maison et chaque hôtel.', { type: 'repairs', perHouse: 25, perHotel: 100 }),
  c('ch-speed', 'chance', 'Flashé pour excès de vitesse : réglez l’amende.', { type: 'money', amount: -15 }),
  c('ch-president', 'chance', 'Vous êtes élu président du club : offrez une prime à chaque joueur.', { type: 'payEach', amount: 50 }),
  c('ch-loan', 'chance', 'Votre prêt immobilier arrive à échéance : la banque vous verse un bonus.', { type: 'money', amount: 150 }),
  c('ch-crossword', 'chance', 'Vous remportez le grand concours de mots croisés.', { type: 'money', amount: 100 }),

  // --- Caisse de communauté ---
  c('cc-go', 'community', 'Avancez jusqu’à la case Départ.', { type: 'moveTo', square: 0, collectGo: true }),
  c('cc-bank-error', 'community', 'Erreur informatique de la banque en votre faveur.', { type: 'money', amount: 200 }),
  c('cc-doctor', 'community', 'Consultation chez le médecin : payez les honoraires.', { type: 'money', amount: -50 }),
  c('cc-vinyl', 'community', 'Vous vendez votre collection de vinyles.', { type: 'money', amount: 50 }),
  c('cc-jail-free', 'community', 'Laissez-passer : vous pourrez sortir de prison gratuitement. Conservez cette carte.', { type: 'jailFree' }),
  c('cc-jail', 'community', 'Allez directement en prison, sans passer par le Départ.', { type: 'goToJail' }),
  c('cc-birthday', 'community', 'C’est votre anniversaire : chaque joueur vous offre un cadeau.', { type: 'collectEach', amount: 10 }),
  c('cc-holiday', 'community', 'Votre épargne vacances est débloquée.', { type: 'money', amount: 100 }),
  c('cc-tax-refund', 'community', 'Remboursement du trop-perçu d’impôts.', { type: 'money', amount: 20 }),
  c('cc-insurance', 'community', 'Votre assurance vie vous verse un capital.', { type: 'money', amount: 100 }),
  c('cc-hospital', 'community', 'Frais d’hospitalisation à votre charge.', { type: 'money', amount: -100 }),
  c('cc-school', 'community', 'Frais d’inscription à l’université.', { type: 'money', amount: -50 }),
  c('cc-consult', 'community', 'Vous facturez une mission de conseil.', { type: 'money', amount: 25 }),
  c('cc-roads', 'community', 'Travaux de voirie devant vos immeubles : payez pour chaque maison et chaque hôtel.', { type: 'repairs', perHouse: 40, perHotel: 115 }),
  c('cc-garden', 'community', 'Deuxième prix du concours de jardinage.', { type: 'money', amount: 10 }),
  c('cc-inherit', 'community', 'Vous héritez d’un parent éloigné.', { type: 'money', amount: 100 }),
];

export const DECK_LABELS: Record<DeckKind, string> = {
  chance: 'Chance',
  community: 'Caisse de communauté',
};

/** Texte lisible de l'effet, pour l'affichage. */
export function describeEffect(effect: CardEffect, currency: string): string {
  const m = (n: number) => `${Math.abs(n).toLocaleString('fr-FR')} ${currency}`;
  switch (effect.type) {
    case 'money':
      return effect.amount >= 0 ? `Recevez ${m(effect.amount)}` : `Payez ${m(effect.amount)}`;
    case 'moveTo':
      return `Déplacement vers la case ${effect.square}${effect.collectGo ? ' (salaire si passage par Départ)' : ''}`;
    case 'moveBy':
      return effect.steps >= 0 ? `Avancez de ${effect.steps} cases` : `Reculez de ${-effect.steps} cases`;
    case 'goToJail':
      return 'Allez en prison';
    case 'jailFree':
      return 'Carte « Sortie de prison »';
    case 'payEach':
      return `Payez ${m(effect.amount)} à chaque joueur`;
    case 'collectEach':
      return `Recevez ${m(effect.amount)} de chaque joueur`;
    case 'repairs':
      return `Payez ${m(effect.perHouse)} / maison et ${m(effect.perHotel)} / hôtel`;
    case 'nearest':
      return effect.target === 'railroad' ? 'Gare la plus proche (loyer ×2)' : 'Compagnie la plus proche (dés ×10)';
  }
}

/** Mélange de Fisher-Yates avec un générateur injectable (tests déterministes). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
  return arr;
}
