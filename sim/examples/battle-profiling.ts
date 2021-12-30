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

/*********************************************************************
 * Run AI
 *********************************************************************/

const streams = getPlayerStreams(new BattleStream());

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

// const p1 = new RandomPlayerAI(streams.p1, {}, true);
// const p2 = new RandomPlayerAI(streams.p2, {}, true);

// console.log("p1 is " + p1.constructor.name);
// console.log("p2 is " + p2.constructor.name);

// void p1.start();
// void p2.start();

void (async () => {
	for await (const chunk of streams.omniscient) {
		console.log(chunk);
	}
})();

const readline = require('readline');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

rl.setPrompt('');

rl.on('line', (input) => {
		void streams.omniscient.write(input);
});

void streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}
>p1 default
>p2 default
`);
