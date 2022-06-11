const net = require("net");

import {ObjectReadWriteStream} from "../../lib/streams";
import {BattlePlayer, BattleStream} from "../battle-stream";
import {PRNG, PRNGSeed} from "../prng";

export class IPCManager extends BattlePlayer {
	protected readonly move: number;
	protected readonly mega: number;
	protected readonly prng: PRNG;
	protected readonly bufferNull = Buffer.from([0x0]);
	protected battleStream: BattleStream;
	protected name: string;
	protected socket = null;
	protected mc: MessageChannel = new MessageChannel();
	protected turns = {};
	protected lastBattleState = null;
	protected ended = false;

	constructor(
		managerStream: ObjectReadWriteStream<string>,
		options: {
			move?: number,
			mega?: number,
			seed?: PRNG | PRNGSeed | null,
		} = {},
		debug = false,
		ipcName,
		battleStream
	) {
		super(managerStream, debug);
		this.move = options.move || 1.0;
		this.mega = options.mega || 0;
		this.prng =
			options.seed && !Array.isArray(options.seed) ?
				options.seed :
				new PRNG(options.seed);

		this.name = ipcName;
		this.socketConnect(ipcName);
		this.battleStream = battleStream;
	}

	socketConnect(ipcName) {
		this.socket = net.connect("/tmp/" + ipcName, () => {
			// void this.start();
		});

		this.socket.setMaxListeners(50);

		this.socket.on("error", (err) => {
			throw err;
		});

		this.socket.on("data", (data) => {
			let cur = data;
			let start = 0;
			while (true) {
				const end = cur.indexOf("\0");
				if (end === -1) {
					break;
				}

				this.mc.port2.postMessage(JSON.parse(data.slice(start, end)));

				start = end + 1;
				cur = data.slice(start);
			}
		});

		this.socket.on("close", () => {});

		process.on("exit", () => {
			this.socket.end();
		});

		process.on("SIGINT", () => {
			process.exit();
		});

		this.mc.port1.onmessage = ({data}) => {
			this.receiveSocketRequest(data);
		};
	}

	receiveSocketRequest(request: AnyObject) {
		if (request.method === "get") {
			const item = request.item;

			if (item === "battleState") {
				const turn = request.turn;
				let result = null;
				let message = Buffer.from(
					JSON.stringify({
						type: null,
					})
				);

				if (this.turns[turn] !== undefined) {
					result = this.turns[turn];

					message = Buffer.from(
						JSON.stringify({
							type: "battleState",
							turn: turn,
							id: result["id"],
							battleState: result["battleState"],
							winner: result["battleState"]["winner"],
						})
					);
				} else if (this.ended) {
					message = Buffer.from(
						JSON.stringify({
							type: "end",
						})
					);
				}

				this.socket.write(Buffer.concat([message, this.bufferNull]));
			}
		} else if (request.method === "set") {
			if (request.item === "exit") {
				this.socket.end();
				this.mc.port1.close();
				process.exit();
			}
		}
	}

	receiveError(error: Error) {
		// If we made an unavailable choice we will receive a followup request to
		// allow us the opportunity to correct our decision.
		if (error.message.startsWith("[Unavailable choice]")) return;
		throw error;
	}

	receiveTeamPreview() {
		// record the battle state before the first turn
		if (Object.keys(this.turns).length === 0) {
			this.addBattleJSON(0);
		}
	}

	receiveTurn(turn: AnyObject) {
		this.addBattleJSON(turn);
	}

	receiveEnd() {
		this.ended = true;
	}

	receiveRequest(request: AnyObject) {}

	addBattleJSON(turn: number): void {
		const battleJSON = this.battleStream.battle!.toJSON();
		delete battleJSON["inputLog"];
		delete battleJSON["log"];

		const savedBattleState = {
			// assigns this turn a random ID from 0 to 2^31 - 1
			id: this.getRandomInt(2147483647),
			battleState: battleJSON,
		};

		console.log(savedBattleState);
		this.turns[turn] = savedBattleState;
		this.lastBattleState = savedBattleState;
	}

	getRandomInt(max: number): number {
		return Math.floor(Math.random() * max);
	}
}
