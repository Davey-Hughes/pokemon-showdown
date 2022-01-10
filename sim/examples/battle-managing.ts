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

import {BattleStream, getPlayerStreams, Teams} from "..";
import {RandomPlayerAI} from "../tools/random-player-ai";
import {IPCPlayer} from "../tools/ipc-player";
import {IPCManager} from "../tools/ipc-manager";

/*********************************************************************
 * Run AI
 *********************************************************************/

const battleStream = new BattleStream();
const streams = getPlayerStreams(battleStream);

const spec = {
	formatid: "gen7customgame",
};

const p1spec = {
	name: "Bot 1",
	team: Teams.pack(Teams.generate("gen7randombattle")),
};
const p2spec = {
	name: "Bot 2",
	team: Teams.pack(Teams.generate("gen7randombattle")),
};

if (process.argv[3] !== undefined && process.argv[4] !== undefined) {
	const p1 = new IPCPlayer(streams.p1, {}, false, process.argv[3]);
	const p2 = new IPCPlayer(streams.p2, {}, false, process.argv[4]);
	void p1;
	void p2;
} else {
	const p1 = new RandomPlayerAI(streams.p1);
	const p2 = new RandomPlayerAI(streams.p2);

	void p1.start();
	void p2.start();
}

const manager = new IPCManager(streams.omniscient, {}, false, process.argv[2], battleStream);
void manager.start();

void streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}
`);


// setTimeout(function () {
// log() // logs out active handles that are keeping node running
// }, 10000)
