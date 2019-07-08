const AlexaRemoteBase = require('alexa-remote2');
const net = require('net');

function requireUncached(mod) {
	delete require.cache[require.resolve(mod)];
	return require(mod);
}
class AlexaRemote extends AlexaRemoteBase
{
	generateCookie(email, password, callback) {
        if (!this.alexaCookie) this.alexaCookie = requireUncached('alexa-cookie2');
        this.alexaCookie.generateAlexaCookie(email, password, this._options, callback);
    }

    refreshCookie(callback) {
        if (!this.alexaCookie) this.alexaCookie = requireUncached('alexa-cookie2');
        this.alexaCookie.refreshAlexaCookie(this._options, callback);
    }
}

module.exports = {
	AlexaRemote: AlexaRemote,
	isObject: x => typeof x == 'object' && x !== null && !Array.isArray(x),
	trim: (str, len) => str.length > len ? str.substring(0, len - 3) + "..." : str.substring(0, len),
	flatten: function(arr) {
		return arr.reduce(function (flat, toFlatten) {
			return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
		}, []);
	},
	tryParseJson: function(json) {
		let obj = null
		
		try {
			obj = JSON.parse(json);
			if (!obj || typeof obj !== "object") throw "not json";
		}
		catch (ex) {
			//console.log(ex);
		}
		return obj;
	},
	portInUseAsync: async function(port) {
		return new Promise((resolve, reject) => {
			const server = net.createServer((socket) => {
				socket.write('Port In Use Test\r\n');
				socket.pipe(socket);
			});
			server.on('error', (err) => {
				reject(err)
			});
			server.on('listening', () => {
				server.close();
				resolve();
			});
			server.listen(port);
		});
	},
	// assign properties of source objects to a destination object
	// example: 
	// let source_a = { foo: 1, bar: 2, unrelated_a: 'hihi' };
	// let source_b = { bar: 'ignored', baz: 3, unrelated_b: 'hihi'};
	// let dest = {};
	// assign(dest, ['foo', 'bar', 'baz'], source_a, source_b)
	// -> { foo: 1, bar: 2, baz: 3 }
	assignBase: function (callback, dest, keys) {
		// console.log({assignBase: arguments});

		if (Array.isArray(keys)) {
			let sources = [...arguments].slice(3);
			for (key of keys) {
				for (source of sources) {
					callback(dest, source, key);
				}
			}
		}
		else {
			// keys are omitted -> all keys are copied
			let sources = [...arguments].slice(2);
			sources.reverse();
			for(source of sources) {
				Object.keys(source).forEach(key => {
					callback(dest, source, key);
				})
			}
		}
		return dest;
	},
	assignMap: function(callback, dest, keys) {
		return this.assignBase(
			(dst, src, key) => {
				if(src[key] === undefined)
					return;
				
				dst[key] = callback(src[key]);
			},
			...[...arguments].slice(1)
		);
	},
	assign: 						function (dest, props) 					{ return this.assignMap(x => x, ...arguments) },
	assignNode:						function (RED, dest, props) 			{ return this.assignMap(x => RED.nodes.getNode(x), ...[...arguments].slice(1)) },
	assignTypedStructConvert: 		function (RED, node, msg, dest, props) 	{ return this.assignMap(x => RED.util.evaluateNodeProperty(x.value, x.type, node, msg), ...[...arguments].slice(3)) },
	assignTyped: function(dest, props) {
		return this.assignBase(
			(dst, src, key) => {
				let val_key = `${key}_value`;
				let typ_key = `${key}_type`;

				let val = src[val_key];
				let typ = src[typ_key];

				dst[val_key] = val;
				dst[typ_key] = typ;
			},
			...arguments
		);
	},
	assignTypedConvert: function (RED, node, msg, dest, props) { 
		return this.assignBase(
			(dst, src, key) => { 
				let val = src[`${key}_value`];
				let typ = src[`${key}_type`];

				if (val === undefined || typ === undefined)
					return false;

				dst[key] = RED.util.evaluateNodeProperty(val, typ, node, msg);
				return true;
			}, 
			...[...arguments].slice(3)
		);
	},
	nodeErrVal: function(node, msg, err, val, text = '') {
		// filter out "no body" because it is a false positive
		if(!err || err.message === 'no body') {
			msg.payload = val;
			node.status({ shape: 'dot', fill: 'green', text: text || 'success' });
			node.send(msg);
		}
		else {
			// our own way to send warnings over err,val
			if(err.warning) {
				node.status({ shape: 'dot', fill: 'yellow', text: text || this.trim(err.message, 32) });
				node.warn(err);
			}
			else {
				msg.payload = val;
				node.status({ shape: 'dot', fill: 'red', text: text || this.trim(err.message, 32) });
				node.error(err, msg);
			}
		}
	},
	executeAutomationRoutine(alexa, serialOrName, utteranceOrId, callback) {
		if (typeof utteranceOrId !== 'string') {
			return callback && callback(new Error('utteranceOrId needs to be a string'));
		}

		alexa.getAutomationRoutines((err, res) => {
			if (err) {
				return callback && callback(err, res);
			}

			let routines = res;
			let routine;

			if (utteranceOrId.match(/amzn1.alexa.automation/)) {
				// is id
				routine = routines.find(r => r.automationId === utteranceOrId);
			}
			else {
				// is utterance
				routine = routines.find(
					routine => routine.triggers.find(
						trigger => trigger.payload.utterance === utteranceOrId));
			}

			if (!routine) {
				return callback && callback(new Error('Routine not found'));
			}

			let command = {
				sequence: routine.sequence,
				automationId: routine.automationId,
				status: 'ENABLED',
			};

			alexa.sendSequenceCommand(serialOrName, command, callback);
		});
	},
	nodeSetupForStatusReporting: function(node) {
		
		node.blinkState = false;

		node._stopBlinking = function() {
			if(this.blinkInterval) {
				clearInterval(this.blinkInterval);
				this.blinkInterval = null;
			}
			this.status({}); 
		}
		node._startBlinking = function(a, b) {
			this.blinkInterval = setInterval(() => {
				this.blinkState = !this.blinkState;
				this.status(this.blinkState ? a : b);
			}, 300);
		}

		node._onStatus = (code, message) => {
			node._stopBlinking(); 
			const text = typeof message === 'string' ? (message.includes(' in your browser') ? message : this.trim(message, 32)) : '';

			switch(code) {
				case 'init-proxy': 		node.status({shape: 'dot', fill: 'grey', text: 'init with proxy' }); break;
				case 'init-cookie': 	node.status({shape: 'dot', fill: 'grey', text: 'init with cookie' }); break;
				case 'init-password': 	node.status({shape: 'dot', fill: 'grey', text: 'init with password' }); break;
				case 'refreshing': 		node.status({shape: 'dot', fill: 'blue', text: 'refreshing' }); break;
				case 'wait-proxy': 		node._startBlinking(
					{ shape: 'dot', fill: 'blue', text: text }, 
					{ shape: 'dot', fill: 'grey', text: text }); break;
				case 'stopped':			node.status({shape: 'dot', fill: 'yellow', text: 'stopped'}); break;
				case 'ready': 			node.status({shape: 'dot', fill: 'green', text: 'ready'}); break;
				case 'error':			node.status({shape: 'dot', fill: 'red', text: message}); break;
				default: 				node.status({shape: 'ring', fill: 'grey', text: 'uninitialized' }); break;
			}
		}

		node.account.emitter.removeListener('status', node._onStatus);
		node.account.emitter.addListener('status', node._onStatus);

		// initial status update
		const {code, message} = node.account.status;
		node._onStatus(code, message);

		node.on('close', function () { 
			node.account.emitter.removeListener('status', node._onStatus);
			this._stopBlinking();
		});
	}
};