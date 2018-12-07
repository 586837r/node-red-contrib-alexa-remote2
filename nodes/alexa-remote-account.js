const tools = require('../tools/tools.js');
const AlexaRemote = require('alexa-remote2');
const EventEmitter = require('events');

module.exports = function (RED) {
	function AlexaRemoteAccountNode(input) {
		RED.nodes.createNode(this, input);
		let node = this;

		tools.assign(node, ['bluetooth', 'alexaServiceHost', 'userAgent', 'amazonPage', 'initType'], input);
		tools.assignTypedConvert(RED, null, null, node, ['useWsMqtt', 'bluetooth'], input);
		node.emitter = new EventEmitter();

		/**
		 * @returns {Promise<*>} promise
		 */
		node.initAlexa = function() {
			this.alexa = new AlexaRemote();
			let config = { logger: tools.logger };
			tools.assign(config, ['alexaServiceHost', 'userAgent', 'amazonPage', 'useWsMqtt', 'bluetooth'], this);
			tools.assign(config, ['cookie', 'email', 'password'], this.credentials);
			let has = (x) => config[x] !== undefined;
			if (!has('cookie') && (!has('email') || !has('password'))) {
				return Promise.reject('either cookie or email and password must be defined');
			}
			else {
				return new Promise((resolve, reject) => {
					this.alexa.init(config, (err, val) => {
						if(err){
							reject(err);
						}
						else{
							this.emitter.emit('alexa-init');
							resolve(val);
						}
					});
				});
			}
		}
    }
	RED.nodes.registerType("alexa-remote-account", AlexaRemoteAccountNode, { 
		credentials: {
            cookie: 	{ type: 'text' },
            email: 		{ type: 'text' },
            password: 	{ type: 'password' },
		}
	});
}