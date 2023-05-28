import PDFJS from 'pdfjs-dist/legacy/build/pdf.js';
import { TextItem } from 'pdfjs-dist/types/src/display/api.js';
import { stringify } from 'csv-stringify/sync';
import fs from 'fs';
import { LaneInfo } from './types.mjs';

const evts = ['200m', '400m', '400mH', '4x100m'] as const;
const deny = ['4x400m'];

const MIDPOINT_X = 290;
const CHAMPS_HEIGHT = 12;
const X = 4;
const Y = 5;
// origin = bottom left
const CUTOFF_YEAR = 1952;

const deltaSort = (xPos: number, yPos: number) => (a: TextItem, b: TextItem) => {
  const aXpos = a.transform[X];
  const aYpos = a.transform[Y];
  const bXpos = b.transform[X];
  const bYpos = b.transform[Y];
  const deltaA = Math.abs(aXpos - xPos) + Math.abs(aYpos - yPos);
  const deltaB = Math.abs(bXpos - xPos) + Math.abs(bYpos - yPos);
  return deltaA - deltaB;
};

const isChamp = (item: TextItem) => {
  return (
    item.height === CHAMPS_HEIGHT &&
    item.str
      .split(' ')
      .at(-1)
      ?.match(/\d\d\d\d/)
  );
};

const laneInfos: LaneInfo[] = [];

for (const { docName, range, hdrText } of [
  { docName: 'Oregon stats book.pdf', range: [96, 412], hdrText: 'PASTRESULTS' },
  { docName: 'tokyo-2020-olympic-games-statistics-handbook1.pdf', range: [95, 360], hdrText: 'OLYMPICFINALS' },
]) {
  const doc = await PDFJS.getDocument(docName).promise;
  let prevPageItems: TextItem[] = [];
  for (let pageNo = range[0]; pageNo <= range[1]; pageNo++) {
    // if (pageNo !== 112) continue; // 106, 116, 111 (wrap), 114, 112
    const page = await doc.getPage(pageNo);
    const { items } = (await page.getTextContent()) as { items: TextItem[] };
    const header = items
      .filter((item) => item.transform[Y] > 810)
      .map((item) => item.str)
      .join('')
      .replaceAll(' ', '');

    if (header.includes(hdrText) && evts.some((evt) => header.includes(evt)) && !deny.some((evt) => header.includes(evt))) {
      const evt = evts.findLast((evt) => header.includes(evt));
      const sex = header.includes('WOMEN') ? 'F' : 'M';
      const lanes = items.filter((item) => item.str.match(/\|\d\|/));
      const places = items.filter((item) => item.str.match(/^\(?=?\d,\)?$/));
      const times = items.filter(
        (item) => (item.str.length >= 3 && item.str.match(/^[\d\.:]+$/)) || item.str === 'DQ' || item.str === 'DNF' || item.str === 'DNS'
      );
      const champs = items.filter(isChamp);
      for (const lane of lanes) {
        const xPos = lane.transform[X];
        const yPos = lane.transform[Y];
        const matchingPlace = places.sort(deltaSort(xPos, yPos))[0];
        const matchingTime = times
          .filter((t) => t.transform[X] > xPos && Math.abs(t.transform[Y] - matchingPlace.transform[Y]) < 5)
          .sort(deltaSort(xPos, yPos))[0];
        let matchingChamp: TextItem | undefined = undefined;
        const leftSide = xPos < MIDPOINT_X;
        if (!leftSide) {
          // right side
          matchingChamp = champs
            .filter((champ) => champ.transform[Y] > yPos && champ.transform[X] > MIDPOINT_X)
            .sort((a, b) => a.transform[Y] - b.transform[Y])[0];
        }
        if (!matchingChamp) {
          // left side
          matchingChamp = champs
            .filter((champ) => (leftSide ? champ.transform[Y] > yPos : true) && champ.transform[X] < MIDPOINT_X)
            .sort((a, b) => a.transform[Y] - b.transform[Y])[0];
        }
        if (!matchingChamp) {
          const prevChamps = prevPageItems.filter(isChamp);
          matchingChamp = prevChamps.filter((champ) => champ.transform[X] > MIDPOINT_X).sort((a, b) => a.transform[Y] - b.transform[Y])[0];
          if (!matchingChamp) {
            matchingChamp = prevChamps.filter((champ) => champ.transform[X] < MIDPOINT_X).sort((a, b) => a.transform[Y] - b.transform[Y])[0];
          }
        }
        if (+(matchingChamp.str.split(' ').at(-1) ?? 0) < CUTOFF_YEAR) continue;
        laneInfos.push({
          lane: +lane.str.replace(/[^\d]/g, ''),
          place: +matchingPlace.str.replace(/[^\d]/g, ''),
          time: matchingTime?.str ?? '',
          champs: matchingChamp.str,
          sex,
          event: evt!,
          page: pageNo,
        });
      }
    }
    prevPageItems = items;
  }
}
fs.writeFileSync('lanes.csv', stringify(laneInfos, { header: true }));
