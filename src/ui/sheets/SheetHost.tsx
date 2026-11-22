import type { SheetRequest } from '../gameUi';
import { useGameUi } from '../gameUi';
import { BankruptcySheet } from './BankruptcySheet';
import { PlayerSheet } from './PlayerSheet';
import { PropertySheet } from './PropertySheet';
import { TradeSheet } from './TradeSheet';
import { CardPaySheet, UnknownCardSheet } from './CardPaySheet';
import { CustomSheet, RentSheet, TaxSheet, TransferSheet } from './MoneySheets';

export function SheetHost({ sheet }: { sheet: SheetRequest | null }) {
  const { close } = useGameUi();
  if (!sheet) return null;
  // La clé force un formulaire neuf (et une nouvelle clé anti-doublon) à chaque ouverture.
  const key = JSON.stringify(sheet);
  switch (sheet.type) {
    case 'player':
      return <PlayerSheet key={key} playerId={sheet.playerId} onClose={close} />;
    case 'property':
      return <PropertySheet key={key} square={sheet.square} onClose={close} />;
    case 'trade':
      return <TradeSheet key={key} init={sheet} onClose={close} />;
    case 'custom':
      return <CustomSheet key={key} init={sheet} onClose={close} />;
    case 'transfer':
      return <TransferSheet key={key} init={sheet} onClose={close} />;
    case 'rent':
      return <RentSheet key={key} init={sheet} onClose={close} />;
    case 'tax':
      return <TaxSheet key={key} init={sheet} onClose={close} />;
    case 'cardPay':
      return <CardPaySheet key={key} playerId={sheet.playerId} onClose={close} />;
    case 'unknownCard':
      return <UnknownCardSheet key={key} signature={sheet.signature} onClose={close} />;
    case 'bankruptcy':
      return <BankruptcySheet key={key} playerId={sheet.playerId} onClose={close} />;
  }
}
