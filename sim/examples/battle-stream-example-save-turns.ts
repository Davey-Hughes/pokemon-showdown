/**
 * Battle Stream Example
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * Example of how to create AIs battling against each other.
 * Run this using `node build && node .sim-dist/examples/battle-stream-example`.
 *
 * @license MIT
 * @author Guangcong Luo <guangcongluo@gmail.com>
 */

import {BattleStream, getPlayerStreams, Teams} from '..';
import {RandomPlayerAI} from '../tools/random-player-ai';
const fs = require('fs');

/*********************************************************************
 * Run AI
 *********************************************************************/

const battlestream = new BattleStream();
const streams = getPlayerStreams(battlestream);

const spec = {
	formatid: "gen7customgame",
};
const p1spec = {
	name: "Bot 1",
	team: Teams.pack(Teams.generate('gen7randombattle')),
};
const p2spec = {
	name: "Bot 2",
	team: Teams.pack(Teams.generate('gen7randombattle')),
};

const p1 = new RandomPlayerAI(streams.p1);
const p2 = new RandomPlayerAI(streams.p2);

console.log("p1 is " + p1.constructor.name);
console.log("p2 is " + p2.constructor.name);

void p1.start();
void p2.start();

void (async () => {
	const battle_json_dir = './battle_jsons';
	fs.mkdir(battle_json_dir, {recursive: true}, (err) => {
		if (err) throw err;
	});

	for await (const chunk of streams.omniscient) {
		console.log(chunk);
		const turn = battlestream.battle.turn.toString().padStart(3, '0');
		const battle_output = JSON.stringify(battlestream.battle.toJSON(), null, 4);
		if (battle_output !== null) {
			fs.writeFileSync(`${battle_json_dir}/turn_${turn}.json`, battle_output);
		}
	}
})();

void streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}`);
