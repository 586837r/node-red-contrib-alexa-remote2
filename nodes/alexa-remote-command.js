const tools = require('../tools/tools.js');

module.exports = function (RED) {

	function AlexaRemoteCommandNode(input) {
		RED.nodes.createNode(this, input);
		let node = this;
	
		tools.assignTyped(node, ['serialOrName', 'command'], input);
		tools.assignNode(RED, node, ['account'], input);
		tools.assign(node, ['options'], input);

		node.on('close', function (removed, done) { this.status({}); done(); });
		node.on('input', function (msg) {
			let config = tools.assignTypedConvert(RED, node, msg, {}, ['serialOrName', 'command'], node);
			let options = tools.assignTypedStructConvert(RED, node, msg, {}, node.options[config.command]); 
			console.log(options, node.options);

			tools.initAndSend(node, msg, (alexa) => 
				new Promise((resolve, reject) => 
					alexa.sendCommand(config.serialOrName, config.command, config.value, (err,val) => 
						err ? reject(err) : resolve(val)
					)
				)
			)
		});
	}
	RED.nodes.registerType("alexa-remote-command", AlexaRemoteCommandNode)
}