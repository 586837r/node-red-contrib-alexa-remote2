const AlexaRemote = require('alexa-remote2');
const debug = false;

module.exports = {
	logger: debug ? console.log : undefined,
	isDef: function(x) { return arguments.length > 1 ? [...arguments].every(y => this.isDef(y)) : typeof x !== 'undefined' },
	isPlainObject: x => typeof x == 'object' && x !== null && !Array.isArray(x),
	flatten: function flatten(arr) {
		return arr.reduce(function (flat, toFlatten) {
			return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
		}, []);
	},
	// callback for every set operation args (dest, source, key)
	assignBase: function (setCallback, dest, keys) {
		// console.log('ASSIGN BASE', [...arguments].map(String));
		if (dest._DEBUG_)
			console.log(arguments);

		if (!Array.isArray(keys)) {
			// keys are omitted -> all keys are copied
			let sources = [...arguments].slice(2);
			sources.reverse();
			for(source of sources) {
				Object.keys(source).forEach(key => {
					setCallback(dest, source, key);
				})
			}
		}
		else {
			let sources = [...arguments].slice(3);
			for (key of keys) {
				for (source of sources) if (this.isDef(source)) {
					setCallback(dest, source, key);
				}
			}
		}
		return dest;
	},
	assignMap: function(callback, dest, keys) {
		return this.assignBase(
			(dst, src, key) => {
				if(!this.isDef(src[key]))
					return false;
				
				dst[key] = callback(src[key]);
				return true;
			},
			...[...arguments].slice(1)
		);
	},

	// assign properties of source objects to a destination object
	// example: 
	// let source_a = { foo: 1, bar: 2, unrelated_a: 'hihi' };
	// let source_b = { bar: 'ignored', baz: 3, unrelated_b: 'hihi'};
	// let dest = {};
	// assign(dest, ['foo', 'bar', 'baz'], source_a, source_b)
	// -> { foo: 1, bar: 2, baz: 3 }
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

				if (!this.isDef(val, typ))
					return false;

				dst[val_key] = val;
				dst[typ_key] = typ;
				
				return true;
			},
			...arguments
		);
	},
	// assigns props like:
	// dest.prop = {
	//     type: source.prop_type
	//     value: source.prop_value
	// }
	assignTypedStruct: 			function (dest, props) {
		return this.assignBase(
			(dst, src, key) => {
				let val = src[`${key}_value`];
				let typ = src[`${key}_type`];

				if (!this.isDef(val, typ))
					return false;

				dst[key] = { 
					value: val,
					type: typ
				}
				return true;
			},
			...arguments
		);
	},
	assignTypedConvert: function (RED, node, msg, dest, props) { 
		return this.assignBase(
			(dst, src, key) => { 
				let val = src[`${key}_value`];
				let typ = src[`${key}_type`];

				if(!this.isDef(val, typ))
					return false;

				dst[key] = RED.util.evaluateNodeProperty(val, typ, node, msg);
				return true;
			}, 
			...[...arguments].slice(3)
		);
	},
	requireUncached: function(mod) {
		delete require.cache[require.resolve(mod)];
		return require(mod);
	},
	generateCookie: function(config, callback) {
		const alexaCookie = this.requireUncached('alexa-cookie2');
		alexaCookie.generateAlexaCookie(config.email, config.password, config, callback);
	},
	generateCookiePromise: function(config) {
		return new Promise((resolve, reject) => {
			this.generateCookie(config, (err,val) => {
				err ? reject(err) : resolve(val.cookie);
			});
		});
	},
	initAlexa: async function(alexa, config) {
		if (!config.cookie && (!config.email || !config.password))
			return Promise.reject(new Error('either cookie or email and password must be defined'));

		if(!config.cookie) {
			config.cookie = await this.generateCookiePromise(config);
		}

		// dont you dare try to resolve cookie yourself! >:(
		delete config.email;
		delete config.password;

		// dont retry authentication
		config.cookieJustCreated = true;

		return new Promise((resolve, reject) => {
			alexa.init(config, (err, val) => {
				if (err) {
					reject(err);
				}
				else {
					// alexa-remote returns no err on authentication fail, so check again
					alexa.checkAuthentication((authenticated) => {
						authenticated ? resolve(val) : reject(new Error('Authentication failed'));
					});
				}
			});
		});
	},
	nodeOnSuccess: function (node, msg, val) {
		node.status({ shape: 'dot', fill: 'green', text: 'Success' });
		msg.payload = val;
		delete msg.error;
		//console.log('onSucc');
		node.send(msg);
	},
	nodeOnError: function (node, msg, errorArgs) {
		let error = Array.isArray(errorArgs) ? errorArgs[0] : errorArgs;
		let message = error instanceof Error ? error.message : error;
		let payload = Array.isArray(errorArgs) ? errorArgs[1] : undefined;

		delete msg.payload;
		msg.error = {
			message: message,
			payload: payload
		};

		node.status({ shape: 'dot', fill: 'red', text: message });
		node.error(error);

		//console.log({ onError: error });
		
		//console.log('onErr');
		node.send(msg);
	},
	/**
	 * @callback initAndSendCb
	 * @param {AlexaRemote} alexaRemote
	 * @returns {Promise}
	 */

	/**
	 * @param {initAndSendCb} sendFun - returns Promise
	 */
	initAndSend: function (node, msg, sendFun) {
		node.status({ shape: 'ring', fill: 'grey', text: 'initializing' });

		let onSuccess = this.nodeOnSuccess.bind(this, node, msg);
		let onError = this.nodeOnError.bind(this, node, msg);
		let wrappedSendFun = (alexa) => {
			node.status({ shape: 'dot', fill: 'grey', text: 'sending' });
			// filter out "no body" because it is a false error
			return sendFun(alexa).catch((errorArgs) => {
				//console.log({ wrapped: error });
				let error = Array.isArray(errorArgs) ? errorArgs[0] : errorArgs;
				let message = error instanceof Error ? error.message : error;
				return message === 'no body' ? Promise.resolve(null) : Promise.reject(errorArgs);
			});
		};

		let msgAccount = msg['alexaRemoteAccount'];
		if (typeof msgAccount === 'object') {
			// dont retry authentication
			msgAccount.cookieJustCreated = true;

			let alexa = new AlexaRemote();
			this.initAlexa(alexa, msgAccount)
			.then(() => wrappedSendFun(alexa))
			.then(onSuccess)
			.catch(onError)
			return;
		}

		let account = node.account;

		if (!account) {
			onError(new Error('Missing account'));
			return;
		}

		//console.log('Init type is ', account.initType);

		switch(account.initType){
			case 'lazy': {
				if(account.alexa === undefined) {
					account.initAlexa()
					.then(() => wrappedSendFun(account.alexa))
					.then(onSuccess)
					.catch(onError);
				} 
				else {
					//console.log('acc already init');
					wrappedSendFun(account.alexa)
					.catch(() => {
						node.status({ shape: 'ring', fill: 'grey', text: 'initializing' });
						return account.initAlexa().then(() => wrappedSendFun(account.alexa));
					})
					.then(onSuccess)
					.catch(onError);
				}
				break;
			}
			case 'every': {
				account.initAlexa()
				.then(() => wrappedSendFun(account.alexa))
				.then(onSuccess)
				.catch(onError);
				break;
			}
			case 'manual': {
				if(account.alexa === undefined) {
					onError(new Error('Manual initialization required'));
				}
				else {
					wrappedSendFun(account.alexa)
					.then(onSuccess)
					.catch(onError);
				}
				break;
			}
			default: {
				onError(new Error('Invalid init behaviour'));
				break;
			}
		}
	}
};