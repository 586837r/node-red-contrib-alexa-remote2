const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteSequenceNode(input) {
		RED.nodes.createNode(this, input);
		let node = this;

		tools.assign(node, ['sequenceInputs'], input);
		tools.assignTyped(node, ['serialOrName'], input);
		tools.assignNode(RED, node, ['account'], input);

		node.on('close', function (removed, done) { this.status({}); done(); });
		node.on('input', function (msg) {		
			let config = {};
			tools.assignTypedConvert(RED, node, msg, config, ['serialOrName'], input);

			if(msg.sequence){
				config.sequenceCommands = msg.sequence;
			}
			else{
				config.sequenceCommands = node.sequenceInputs.map(input => {
					return {
						command: input.command,
						value: RED.util.evaluateNodeProperty(input.value_value, input.value_type, node, msg)
					}
				});
			}

			tools.initAndSend(node, msg, (alexa) => {
				return new Promise((resolve, reject) => {
					// fix because callback is not called in 
					if (!alexa.find(config.serialOrName)){
						return reject(new Error('Unknown Device or Serial number'));
					}
					alexa.sendMultiSequenceCommand(config.serialOrName, config.sequenceCommands, (err, val) => {
						//console.log({node: {err: err, val: val}});
						err ? reject([err, val]) : resolve(val);
					});
				})
			})
		});
	}
	RED.nodes.registerType("alexa-remote-sequence", AlexaRemoteSequenceNode)
}