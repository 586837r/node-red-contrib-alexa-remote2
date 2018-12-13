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
			if(node.alexa) {
				if(node.alexa.alexaWsMqtt) {
					node.alexa.alexaWsMqtt.removeAllListeners();
				}
				node.alexa.removeAllListeners();
			}

			node.alexa = new AlexaRemote();

			const config = { logger: tools.logger };
			tools.assign(config, ['alexaServiceHost', 'userAgent', 'amazonPage', 'useWsMqtt', 'bluetooth'], node);
			tools.assign(config, ['cookie', 'email', 'password'], node.credentials);

			return tools.initAlexa(node.alexa, config)
				.then(() => node.emitter.emit('alexa-init'))
				.catch((err) => {
					delete node.alexa;
					return Promise.reject(err);
				});
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