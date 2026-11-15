// The pictures on the panel buttons: the toys themselves, painted once at button size and kept.
import { def } from '../sim/data';
import { armyReach, paintArmyPiece } from './army';
import { dinoReach, isDinoBuilding, isDinoUnit, paintDinoPiece } from './dinos';
import { type Pen, TEAM, ToyBox } from './toys';

const box = new ToyBox();
const made = new Map<number, string>();

/** A picture of a unit or building in a side's colour (yours unless told), as an image address a button can show. */
export function toyIcon(kind: number, side = 0): string {
  let url = made.get(kind * 8 + side);
  if (url === undefined) {
    const t = TEAM[side]!, dino = isDinoUnit(kind) || isDinoBuilding(kind);
    const half = dino ? dinoReach(kind) : armyReach(kind);
    // Ninety pixels across, so it is sharp on any phone at any size a button uses.
    const paint = (p: Pen): void => (dino ? paintDinoPiece(p, t, kind) : paintArmyPiece(p, t, kind));
    url = box.picture(90, half, paint, t.ink, def(kind).building ? 'top' : 'dome', 4).toDataURL();
    made.set(kind * 8 + side, url);
  }
  return url;
}
