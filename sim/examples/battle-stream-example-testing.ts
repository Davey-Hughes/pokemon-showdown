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

import {BattleStream, getPlayerStreams} from '..';
// import {RandomPlayerAI} from '../tools/random-player-ai';
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
	team: "Articuno||leftovers|pressure|electricterrain,hurricane,substitute,roost|Modest|252,,,252,4,||,,,30,30,|||]Ludicolo||lifeorb|swiftswim|surf,gigadrain,icebeam,raindance|Modest|4,,,252,,252|||||]Volbeat||damprock|prankster|tailglow,batonpass,encore,raindance|Bold|248,,252,,8,|M||||]Seismitoad||lifeorb|swiftswim|hydropump,earthpower,stealthrock,raindance|Modest|,,,252,4,252|||||]Alomomola||damprock|regenerator|wish,protect,toxic,raindance|Bold|252,,252,,4,|||||]Armaldo||leftovers|swiftswim|xscissor,stoneedge,aquatail,rapidspin|Adamant|128,252,4,,,124|||||",
};
const p2spec = {
	name: "Bot 2",
	team: "Articuno||leftovers|pressure|trickroom,hurricane,substitute,roost|Modest|252,,,252,4,||,,,30,30,|||]Ludicolo||lifeorb|swiftswim|surf,gigadrain,icebeam,raindance|Modest|4,,,252,,252|||||]Volbeat||damprock|prankster|tailglow,batonpass,encore,raindance|Bold|248,,252,,8,|M||||]Seismitoad||lifeorb|swiftswim|hydropump,earthpower,stealthrock,raindance|Modest|,,,252,4,252|||||]Alomomola||damprock|regenerator|wish,protect,toxic,raindance|Bold|252,,252,,4,|||||]Armaldo||leftovers|swiftswim|xscissor,stoneedge,aquatail,rapidspin|Adamant|128,252,4,,,124|||||",
};

// const p1 = new RandomPlayerAI(streams.p1);
// const p2 = new RandomPlayerAI(streams.p2);

// console.log("p1 is " + p1.constructor.name);
// console.log("p2 is " + p2.constructor.name);

// void p1.start();
// void p2.start();

void (async () => {
	const battle_json_dir = './battle_test_jsons';
	fs.mkdir(battle_json_dir, {recursive: true}, (err) => {
		if (err) throw err;
	});

	for await (const chunk of streams.omniscient) {
		console.log(chunk);
		// const turn = battlestream.battle.turn.toString().padStart(3, '0');
		const battle_output = JSON.stringify(battlestream.battle.toJSON(), null, 4);
		if (battle_output !== null) {
			fs.writeFileSync(`${battle_json_dir}/test.json`, battle_output);
		}
	}
})();

void streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}
>p1 team 1
>p2 team 1
>p1 move 1
>p2 move 1`);
