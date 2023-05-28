import { parse } from 'csv-parse/sync';
import { LaneInfo } from './types.mjs';
import fs from 'fs';

const groupBy = function <T>(arr: T[], cb: (x: T) => string): { [k: string]: T[] } {
  return arr.reduce((acc, x) => {
    (acc[cb(x)] ??= []).push(x);
    return acc;
  }, {});
};

const laneInfos: Array<LaneInfo> = parse(fs.readFileSync('lanes.csv', 'utf-8'), { columns: true });

const races = groupBy(laneInfos, ({ champs, sex, event }) => `${champs} ${sex} ${event}`);
const wins: {
  overall: { [lane: number]: number };
  [event: string]: { [lane: number]: number };
} = {
  overall: {},
};

// see: Athens 1997 F 400m (283), Beijing 2015 M 400mH (169), London 2017 F 400mH (332)
for (const race in races) {
  const evt = race.split(' ').at(-1) ?? '';
  const winningLane = races[race].sort((a, b) => +a.place - +b.place)[0].lane;
  // if (+winningLane === 9) console.log(races[race].at(0))
  wins[evt] ??= {};
  wins[evt][winningLane] ??= 0;
  wins[evt][winningLane]++;
  wins.overall[winningLane] ??= 0;
  wins.overall[winningLane]++;
}

console.log(wins);
