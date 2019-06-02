const tools = require('../tools/tools.js');

module.exports = function (RED) {
	function AlexaRemoteSequenceNode(input) {
		RED.nodes.createNode(this, input);

		tools.assign(this, ['sequenceInputs'], input);
		tools.assignTyped(this, ['serialOrName'], input);
		tools.assignNode(RED, this, ['account'], input);

		this.on('close', function () { this.status({}); });
		this.on('input', function (msg) {		
			let config = {};
			tools.assignTypedConvert(RED, this, msg, config, ['serialOrName'], input);

			if(msg.sequence) {
				config.sequenceCommands = msg.sequence;
			}
			else{
				config.sequenceCommands = this.sequenceInputs.map(input => {
					return {
						command: input.command,
						value: RED.util.evaluateNodeProperty(input.value_value, input.value_type, this, msg)
					}
				});
			}

			this.status({ shape: 'dot', fill: 'grey', text: 'sending' });
			const alexa = this.account.alexa;
			const callback = (err, val) => tools.nodeErrVal(this, msg, err, val);

			// fix because callback is not called in sendSequenceCommand
			if (!alexa.find(config.serialOrName)) {
				return tools.nodeErrVal(this, msg, new Error('Unknown Device or Serial number'));
			}

			alexa.sendMultiSequenceCommand(config.serialOrName, config.sequenceCommands, callback);
		});
	}
	RED.nodes.registerType("alexa-remote-sequence", AlexaRemoteSequenceNode)
}