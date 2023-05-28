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
const wins: { [lane: number]: number } = {};

for (const race in races) {
  const winningLane = races[race].sort((a, b) => +a.place - +b.place)[0].lane;
  wins[winningLane] ??= 0;
  wins[winningLane]++;
}

console.log(wins);
