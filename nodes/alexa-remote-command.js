const tools = require('../tools/tools.js');

module.exports = function (RED) {

	function AlexaRemoteCommandNode(input) {
		RED.nodes.createNode(this, input);
	
		tools.assignTyped(this, ['serialOrName', 'command'], input);
		tools.assignNode(RED, this, ['account'], input);
		tools.assign(this, ['options'], input);

		this.on('close', function () { this.status({}); });
		this.on('input', function (msg) {
			const config = tools.assignTypedConvert(RED, this, msg, {}, ['serialOrName', 'command'], this);
			let options = tools.assignTypedStructConvert(RED, this, msg, {}, this.options[config.command]); 
			//console.log(options, node.options);

			this.status({ shape: 'dot', fill: 'grey', text: 'sending' });
			const alexa = this.account.alexa;
			const callback = (err, val) => tools.nodeErrVal(this, msg, err, val);

			alexa.sendCommand(config.serialOrName, config.command, options.value, callback);
		});
	}
	RED.nodes.registerType("alexa-remote-command", AlexaRemoteCommandNode)
}