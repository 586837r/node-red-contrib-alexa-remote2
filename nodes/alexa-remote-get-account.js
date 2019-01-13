const tools = require('../tools/tools.js');

module.exports = function (RED) {

	function AlexaRemoteGetAccountNode(input) {
		RED.nodes.createNode(this, input);
		let node = this;

		tools.assignNode(RED, node, ['account'], input);

		node.on('close', function (removed, done) { this.status({}); done(); });
		node.on('input', function (msg) {
			if (node.account) {
				let payload = {};

				tools.assign(payload, [
					'alexaServiceHost', 
					'userAgent', 
					'amazonPage', 
					'initType',
					'useWsMqtt',
					'bluetooth', 
				], node.account);

				tools.assign(payload, [
					'cookie', 'email', 'password'
				], node.account.credentials);

				tools.nodeOnSuccess(node, msg, payload);
			}
			else {
				tools.nodeOnError(node, msg, new Error('account missing'));
			}
		});
	}
	RED.nodes.registerType("alexa-remote-get-account", AlexaRemoteGetAccountNode)
}