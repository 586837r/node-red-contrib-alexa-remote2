const tools = require('../tools/tools.js');

module.exports = function (RED) {

	function AlexaRemoteInitNode(input) {
		RED.nodes.createNode(this, input);
		let node = this;

		tools.assignNode(RED, node, ['account'], input);

		node.on('close', function (removed, done) { this.status({}); done(); });
		node.on('input', function (msg) {
			if(node.account) {
				node.status({ shape: 'ring', fill: 'grey', text: 'initializing' });
				node.account.initAlexa()
				.then(val => tools.nodeOnSuccess(node, msg, val))
				.catch(err => tools.nodeOnError(node, msg, err));
			}
			else {
				tools.nodeOnError(node, msg, new Error('account missing'));
			}
		});
	}
	RED.nodes.registerType("alexa-remote-init", AlexaRemoteInitNode)
}