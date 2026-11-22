# Zapped Bank — banque électronique pour Monopoly Zapped

Application web (PWA) qui remplace l’application officielle de **Monopoly zAPPed Edition** (Hasbro, 2012), retirée des stores. Elle gère toute la banque d’une partie de 2 à 4 joueurs : soldes, loyers, propriétés, constructions, hypothèques, cartes, dés, prison, faillites, historique et sauvegarde automatique.

> Application non officielle, sans lien avec Hasbro. « Monopoly » est une marque de Hasbro. Les textes des cartes sont des formulations originales ; aucun visuel officiel n’est reproduit.

## Lancer le projet

Prérequis : [Node.js](https://nodejs.org) 20 ou plus récent.

```bash
npm install        # installe les dépendances
npm run dev        # serveur de développement : http://localhost:5173
npm test           # tests unitaires (règles, banque, cartes, sauvegarde, Zapped)
npm run build      # version de production dans dist/
npm run preview    # sert la version de production : http://localhost:4173
```

Pour tester depuis un iPhone sur le même Wi-Fi : `npm run dev -- --host`, puis ouvrez l’adresse « Network » affichée. L’installation sur l’écran d’accueil d’un iPhone exige une adresse **HTTPS** : utilisez la version publiée sur GitHub Pages.

## Installer l’application (PWA)

- **iPhone / iPad** : ouvrir l’adresse dans Safari → bouton Partager → « Sur l’écran d’accueil ».
- **Windows** : dans Edge ou Chrome, icône « Installer » de la barre d’adresse.

Une fois installée, l’application fonctionne **hors connexion**.

## Publication sur GitHub Pages

Adresse publique : **https://frst000-ctrl.github.io/Monopoly-Zapped/**

Le workflow `.github/workflows/deploy.yml` lance les tests, construit l’application avec le bon chemin (`BASE_PATH=/<nom du dépôt>/`) et la publie à chaque push sur `main`.

Activation (une seule fois) : dans le dépôt GitHub, **Settings → Pages → Build and deployment → Source : GitHub Actions**. Ensuite, onglet **Actions** → « Tests et déploiement GitHub Pages » → **Run workflow** (ou faites simplement un push).

Mettre à jour l’application en ligne après une modification locale :

```bash
git add .
git commit -m "Description de la modification"
git push
```

### Sauvegardes et changement d’adresse

Les parties sont enregistrées dans le stockage du navigateur, **par adresse** : une partie jouée sur `http://localhost:5173` n’apparaît pas sur `https://frst000-ctrl.github.io/Monopoly-Zapped/`, et inversement. Pour transférer une partie : Réglages → **Exporter la sauvegarde**, puis sur l’autre adresse ou l’autre appareil : Accueil → **Importer**. Les mises à jour de l’application ne touchent pas aux sauvegardes. Supprimer les données du site dans le navigateur les efface : exportez avant.

## Utilisation

1. **Nouvelle partie** : 2 à 4 joueurs, nom et couleur de chacun, capital de départ, salaire du Départ, règle maison du Parc gratuit.
2. **Partie** : solde de chaque joueur, lancer des dés animé (ou saisie de vos dés réels), détection des doubles, tour supplémentaire, prison, « Joueur suivant ». Après un déplacement, l’application propose l’action de la case : acheter, payer le loyer (calculé automatiquement), payer la taxe, piocher une carte.
3. **Banque** (banque rapide) : gros boutons +100 / +200 / +500 / −100 / −200 / −500 (modifiables dans Réglages), paiement personnalisé, transfert, loyer, taxe, salaire, récompense.
4. **Titres** : les 28 propriétés du plateau classique avec prix, loyers, maisons, hôtel, hypothèque. Achat (ou enchères à prix libre), construction, vente de bâtiments, hypothèque, levée, vente/échange entre joueurs, attribution manuelle pour corriger une erreur.
5. **Cartes** : pioche Chance / Caisse de communauté pour n’importe quel joueur ; montants de chaque carte modifiables.
6. **Journal** : historique chronologique de toutes les transactions et événements, filtrable par joueur, avec **Annuler** (jusqu’à 30 opérations).
7. **Zapped** : transactions « à la Zapped » (choisir l’opération, présenter la carte du payeur puis du bénéficiaire), association des cartes physiques, tags NFC.
8. **Réglages** : salaire, amende de prison, seuil de confirmation, montants rapides, symbole monétaire, export de sauvegarde, vérification de cohérence, fin de partie, recommencer.

### Fiabilité

- Toutes les opérations passent par un **moteur de règles pur** qui vérifie les soldes *avant* d’écrire quoi que ce soit : en cas d’erreur, rien n’est modifié.
- Chaque formulaire porte un **identifiant unique** : un double clic ne peut jamais exécuter deux fois la même opération.
- Montants entiers uniquement, arithmétique entière (pas d’erreur d’arrondi), contrôle de cohérence (soldes ≥ 0, 32 maisons et 12 hôtels au total, propriétaires valides) après chaque opération.
- Confirmation au-delà d’un seuil réglable (500 par défaut), et toujours pour les achats, échanges, hypothèques et faillites.
- **Sauvegarde automatique** dans le navigateur après chaque opération, avec copie de secours : un rechargement ou une fermeture ne perd rien. Export/import en fichier JSON pour changer d’appareil.

## Module Zapped : ce qui a été vérifié

D’après les tests de presse parus à la sortie du jeu (Engadget, Father Geek, 2012) :

- les 4 cartes bancaires « Touch-Banking » **ne contiennent pas de puce NFC** ni de code-barres ;
- elles portent des **plots conducteurs** disposés selon un motif propre à chaque carte, que l’écran capacitif de l’iPhone/iPad détecte comme plusieurs doigts simultanés (le joueur doit tenir la carte) ;
- les cartes de propriétés n’ont aucune électronique.

En conséquence :

- **Lecteur tactile expérimental** : l’application mesure les distances entre les points de contact de la carte posée sur l’écran (empreinte indépendante de la position et de l’angle). On associe chaque carte à un joueur avec trois lectures concordantes. Son fonctionnement dépend de l’écran et n’est **pas garanti** : il doit être essayé avec les vraies cartes.
- **Web NFC** : disponible uniquement dans Chrome sur Android. Ni Safari (iPhone/iPad) ni Windows ne le proposent. Les cartes d’origine n’ayant pas de puce, cette fonction sert à des **tags NFC que vous collez vous-même** (sur une carte joueur ou une carte de propriété).
- **Mode manuel** : toujours disponible, il suffit de toucher le nom du joueur.

## Architecture

```
src/
├── domain/          Règles du Monopoly, sans React (100 % testable)
│   ├── types.ts       Types : joueurs, propriétés, cartes, transactions, état de partie
│   ├── board.ts       Plateau : 40 cases, 28 propriétés, loyers, prix
│   ├── cards.ts       Cartes Chance / Caisse de communauté (textes originaux)
│   ├── bank.ts        Banque électronique : crédit, débit, transfert, contrôles de solde
│   ├── rules.ts       Loyers, constructions, hypothèques, patrimoine (fonctions pures)
│   ├── game.ts        Moteur : applyAction(état, action) → nouvel état (dés, tours, prison, cartes, échanges, faillite)
│   ├── money.ts       Montants, arrondis, format
│   └── __tests__/     Tests unitaires
├── storage/         Sauvegarde localStorage + copie de secours + validation au chargement
├── store/           Lien moteur ↔ React : historique d’annulation, anti-doublon, sauvegarde automatique
├── zapped/          Lecture tactile des cartes (empreintes) et Web NFC
└── ui/              Interface React (écrans, fiches, composants)
```

Technologies : React 19, TypeScript, Vite, Tailwind CSS 4, Lucide, vite-plugin-pwa (Workbox), Vitest.
