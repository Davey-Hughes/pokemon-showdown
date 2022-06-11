const net = require("net");

import {ObjectReadWriteStream} from "../../lib/streams";
import {BattlePlayer} from "../battle-stream";
import {PRNG, PRNGSeed} from "../prng";

export class IPCPlayer extends BattlePlayer {
	protected readonly move: number;
	protected readonly mega: number;
	protected readonly prng: PRNG;
	protected name;
	protected socket = null;
	protected ipc_mc = new MessageChannel();
	protected request_mc = new MessageChannel();
	protected readonly bufferNull = Buffer.from([0x0]);

	constructor(
		playerStream: ObjectReadWriteStream<string>,
		options: {
			move?: number,
			mega?: number,
			seed?: PRNG | PRNGSeed | null,
		} = {},
		debug = false,
		ipcName
	) {
		super(playerStream, debug);
		this.move = options.move || 1.0;
		this.mega = options.mega || 0;
		this.prng =
			options.seed && !Array.isArray(options.seed) ?
				options.seed :
				new PRNG(options.seed);

		this.socketConnect(ipcName);
		this.name = ipcName;
	}

	socketConnect(ipcName) {
		this.socket = net.connect("/tmp/" + ipcName, () => {
			void this.start();
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

				const msg = JSON.parse(data.slice(start, end));
				if (msg["type"] === "move") {
					this.request_mc.port2.postMessage(msg);
				} else if (msg["type"] === "exit") {
					this.ipc_mc.port2.postMessage(msg);
				}

				start = end + 1;
				cur = data.slice(start);
			}
		});

		this.socket.on("close", () => {});

		process.on("exit", () => {
			this.socket.end();
			this.ipc_mc.port1.close();
		});

		process.on("SIGINT", () => {
			process.exit();
		});

		this.ipc_mc.port1.onmessage = ({data}) => {
			this.receiveIPCRequest(data);
		};
	}

	receiveIPCRequest(message: AnyObject) {
		if (message.type === "exit") {
			this.socket.end();
			this.ipc_mc.port1.close();
		}
	}

	receiveError(error: Error) {
		// If we made an unavailable choice we will receive a followup request to
		// allow us the opportunity to correct our decision.
		if (error.message.startsWith("[Unavailable choice]")) return;
		throw error;
	}

	receiveEnd() {
		this.socket.end();
		this.ipc_mc.port1.close();
	}

	receiveRequest(request: AnyObject) {
		if (request.wait) {
			// do nothing
			return;
		} else if (request.forceSwitch) {
			const pokemon = request.side.pokemon;
			const chosen: number[] = [];
			const choices = request.forceSwitch.map((mustSwitch: AnyObject) => {
				if (!mustSwitch) return `pass`;

				const canSwitch = range(1, 6).filter(
					(i) =>
						pokemon[i - 1] &&
						// not active
						i > request.forceSwitch.length &&
						// not chosen for a simultaneous switch
						!chosen.includes(i) &&
						// not fainted
						!pokemon[i - 1].condition.endsWith(` fnt`)
				);

				if (!canSwitch.length) return `pass`;
				return canSwitch.map((m) => `switch ${m}`);
			});

			const message = Buffer.from(
				JSON.stringify({
					command: "forceSwitch",
					choices: choices[0],
				})
			);

			this.socket.write(Buffer.concat([message, this.bufferNull]));

			this.request_mc.port1.onmessage = ({data}) => {
				this.choose(choices[0][data["switch"]]);
			};
		} else if (request.active) {
			let [canMegaEvo, canUltraBurst, canZMove, canDynamax] = [
				true,
				true,
				true,
				true,
			];
			const pokemon = request.side.pokemon;
			const chosen: number[] = [];
			const choices = request.active.map((active: AnyObject, i: number) => {
				if (pokemon[i].condition.endsWith(` fnt`)) return `pass`;

				canMegaEvo = canMegaEvo && active.canMegaEvo;
				canUltraBurst = canUltraBurst && active.canUltraBurst;
				canZMove = canZMove && !!active.canZMove;
				canDynamax = canDynamax && !!active.canDynamax;

				// Determine whether we should change form if we do end up switching
				const change =
					(canMegaEvo || canUltraBurst || canDynamax) &&
					this.prng.next() < this.mega;
				// If we've already dynamaxed or if we're planning on potentially dynamaxing
				// we need to use the maxMoves instead of our regular moves

				const useMaxMoves =
					(!active.canDynamax && active.maxMoves) ||
					(change && canDynamax);
				const possibleMoves = useMaxMoves ?
					active.maxMoves.maxMoves :
					active.moves;

				let canMove = range(1, possibleMoves.length)
					.filter(
						(j) =>
							// not disabled
							!possibleMoves[j - 1].disabled
						// NOTE: we don't actually check for whether we have PP or not because the
						// simulator will mark the move as disabled if there is zero PP and there are
						// situations where we actually need to use a move with 0 PP (Gen 1 Wrap).
					)
					.map((j) => ({
						slot: j,
						move: possibleMoves[j - 1].move,
						target: possibleMoves[j - 1].target,
						zMove: false,
					}));
				if (canZMove) {
					canMove.push(
						...range(1, active.canZMove.length)
							.filter((j) => active.canZMove[j - 1])
							.map((j) => ({
								slot: j,
								move: active.canZMove[j - 1].move,
								target: active.canZMove[j - 1].target,
								zMove: true,
							}))
					);
				}

				// Filter out adjacentAlly moves if we have no allies left, unless they're our
				// only possible move options.
				const hasAlly =
					pokemon.length > 1 && !pokemon[i ^ 1].condition.endsWith(` fnt`);
				const filtered = canMove.filter(
					(m) => m.target !== `adjacentAlly` || hasAlly
				);
				canMove = filtered.length ? filtered : canMove;

				const moves = canMove.map((m) => {
					let move = `move ${m.slot}`;
					// NOTE: We don't generate all possible targeting combinations.
					if (request.active.length > 1) {
						if ([`normal`, `any`, `adjacentFoe`].includes(m.target)) {
							move += ` ${1 + Math.floor(this.prng.next() * 2)}`;
						}
						if (m.target === `adjacentAlly`) {
							move += ` -${(i ^ 1) + 1}`;
						}
						if (m.target === `adjacentAllyOrSelf`) {
							if (hasAlly) {
								move += ` -${1 + Math.floor(this.prng.next() * 2)}`;
							} else {
								move += ` -${i + 1}`;
							}
						}
					}
					if (m.zMove) move += ` zmove`;
					return {choice: move, move: m};
				});

				const move_numbers = moves.map((m) => m.choice);

				const canSwitch = range(1, 6).filter(
					(j) =>
						pokemon[j - 1] &&
						// not active
						!pokemon[j - 1].active &&
						// not chosen for a simultaneous switch
						!chosen.includes(j) &&
						// not fainted
						!pokemon[j - 1].condition.endsWith(` fnt`)
				);
				const switches = active.trapped ? [] : canSwitch;

				const switch_choices = switches.map((m) => `switch ${m}`);

				return move_numbers.concat(switch_choices);
			});

			const message = Buffer.from(
				JSON.stringify({
					command: "active",
					choices: choices[0],
				})
			);

			this.socket.write(Buffer.concat([message, this.bufferNull]));

			this.request_mc.port1.onmessage = ({data}) => {
				this.choose(choices[0][data["active"]]);
			};
		} else {
			this.choose(`default`);
		}
	}
}

function range(start: number, end?: number, step = 1) {
	if (end === undefined) {
		end = start;
		start = 0;
	}
	const result = [];
	for (; start <= end; start += step) {
		result.push(start);
	}
	return result;
}
